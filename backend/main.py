from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
import zipfile
from pathlib import Path
from typing import Dict, List, Set
from urllib.parse import urlparse

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from pydantic import BaseModel
import tiktoken

SKIP_DIRS = {
    '.git',
    'node_modules',
    '__pycache__',
    'build',
    '.venv',
    'venv',
    '.next',
    'dist',
    'out',
    'coverage',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',
    '.idea',
    '.vscode',
    '.cache'
}
ALLOWED_GIT_HOSTS = {
    host.strip().lower()
    for host in os.getenv('ALLOWED_GIT_HOSTS', 'github.com,www.github.com').split(',')
    if host.strip()
}
MAX_ZIP_BYTES = int(os.getenv('MAX_ZIP_BYTES', str(50 * 1024 * 1024)))
MAX_EXTRACT_BYTES = int(os.getenv('MAX_EXTRACT_BYTES', str(200 * 1024 * 1024)))
MAX_FILE_BYTES = int(os.getenv('MAX_FILE_BYTES', str(512_000)))
MAX_TOKEN_TEXT_CHARS = int(os.getenv('MAX_TOKEN_TEXT_CHARS', str(2_000_000)))
GIT_CLONE_TIMEOUT_SECONDS = int(os.getenv('GIT_CLONE_TIMEOUT_SECONDS', '60'))

app = FastAPI(title='Codex Repo Unroller')
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger('codex.repo_unroller')


def get_allowed_origins() -> List[str]:
    raw = os.getenv('ALLOWED_ORIGINS', '').strip()
    if raw:
        return [origin.strip() for origin in raw.split(',') if origin.strip()]
    return ['http://localhost:3000', 'http://127.0.0.1:3000']


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=['*'],
    allow_headers=['*']
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware('http')
async def request_logging(request: Request, call_next):
    start = time.perf_counter()
    request_id = request.headers.get('x-request-id') or uuid.uuid4().hex
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.exception(
            json.dumps(
                {
                    'event': 'request_error',
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.url.path,
                    'duration_ms': duration_ms,
                    'client': request.client.host if request.client else None
                }
            )
        )
        raise

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        json.dumps(
            {
                'event': 'request_complete',
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'duration_ms': duration_ms,
                'client': request.client.host if request.client else None
            }
        )
    )
    response.headers['X-Request-ID'] = request_id
    return response


def is_binary_file(path: Path, sample_size: int = 1024) -> bool:
    try:
        with path.open('rb') as reader:
            chunk = reader.read(sample_size)
            if not chunk:
                return False
            if b'\x00' in chunk:
                return True
            text_chars = set(range(32, 127)) | {9, 10, 13}
            non_text = sum(1 for byte in chunk if byte not in text_chars)
            return (non_text / len(chunk)) > 0.3
    except (UnicodeDecodeError, OSError):
        return True


def contains_skipped_segment(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def normalize_repo_url(repo_url: str) -> str:
    if len(repo_url) > 2048:
        raise ValueError('Repo URL is too long')
    parsed = urlparse(repo_url)
    if parsed.scheme not in {'http', 'https'}:
        raise ValueError('Only http/https repo URLs are allowed')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Repo URL contains unsupported credentials or query params')
    host = parsed.netloc.split(':')[0].lower()
    if host not in ALLOWED_GIT_HOSTS:
        raise ValueError('Repo host is not allowed')
    parts = [part for part in parsed.path.split('/') if part]
    if len(parts) < 2:
        raise ValueError('Repo URL must include owner/repo')
    owner, repo = parts[0], parts[1]
    if repo.endswith('.git'):
        repo = repo[:-4]
    if not owner or not repo:
        raise ValueError('Repo URL must include owner/repo')
    return f'https://{host}/{owner}/{repo}.git'


def clone_repository(repo_url: str, dest: Path) -> None:
    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'
    env['GIT_ASKPASS'] = 'echo'
    env['GIT_SSH_COMMAND'] = 'ssh -oBatchMode=yes'
    process = subprocess.run(
        ['git', 'clone', '--depth', '1', repo_url, str(dest)],
        capture_output=True,
        text=True,
        check=False,
        timeout=GIT_CLONE_TIMEOUT_SECONDS,
        env=env
    )
    if process.returncode != 0:
        raise ValueError(process.stderr.strip() or 'Git clone failed')
    shutil.rmtree(dest / '.git', ignore_errors=True)


def is_symlink(info: zipfile.ZipInfo) -> bool:
    return (info.external_attr >> 16) & 0o170000 == 0o120000


def safe_extract_zip(source_file: Path, destination: Path, max_total_bytes: int) -> None:
    with zipfile.ZipFile(source_file) as archive:
        root = destination.resolve()
        total_size = 0
        for member in archive.infolist():
            if is_symlink(member):
                raise ValueError('Zip contains symlinks')
            target = destination / member.filename
            if not str(target.resolve()).startswith(str(root)):
                raise ValueError('Zip contains invalid paths')
            if member.file_size < 0:
                raise ValueError('Zip contains invalid file size')
            total_size += member.file_size
            if total_size > max_total_bytes:
                raise ValueError('Zip exceeds allowed total size')
        archive.extractall(destination)


def recursively_collect(root: Path, rel_path: Path) -> tuple[List[Dict], List[Dict]]:
    tree_nodes: List[Dict] = []
    file_records: List[Dict] = []

    for entry in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if contains_skipped_segment(rel_path / entry.name):
            continue

        if entry.is_symlink():
            continue

        node_path = (rel_path / entry.name).as_posix().lstrip('./')
        if entry.is_dir():
            children_tree, children_files = recursively_collect(entry, rel_path / entry.name)
            tree_nodes.append(
                {
                    'name': entry.name,
                    'path': node_path,
                    'type': 'directory',
                    'children': children_tree
                }
            )
            file_records.extend(children_files)
        elif entry.is_file():
            size = entry.stat().st_size
            if is_binary_file(entry):
                file_records.append(
                    {
                        'path': node_path,
                        'size': size,
                        'omitted': True,
                        'omittedReason': 'binary'
                    }
                )
                tree_nodes.append({'name': entry.name, 'path': node_path, 'type': 'file'})
                continue
            if size > MAX_FILE_BYTES:
                file_records.append(
                    {
                        'path': node_path,
                        'size': size,
                        'omitted': True,
                        'omittedReason': 'large'
                    }
                )
                tree_nodes.append({'name': entry.name, 'path': node_path, 'type': 'file'})
                continue

            content = entry.read_text(encoding='utf-8', errors='replace')
            file_records.append(
                {
                    'path': node_path,
                    'size': size,
                    'omitted': False,
                    'omittedReason': None,
                    'content': content
                }
            )
            tree_nodes.append({'name': entry.name, 'path': node_path, 'type': 'file'})

    return tree_nodes, file_records


class ParsedFile(BaseModel):
    path: str
    size: int
    omitted: bool
    omittedReason: str | None = None
    content: str | None = None


class ParsedResponse(BaseModel):
    files: List[ParsedFile]
    tree: List[Dict]


class TokenRequest(BaseModel):
    text: str
    model: str | None = None


class TokenResponse(BaseModel):
    tokens: int


def count_tokens(text: str, model: str | None) -> int:
    try:
        encoding = tiktoken.encoding_for_model(model) if model else tiktoken.get_encoding('cl100k_base')
    except KeyError:
        encoding = tiktoken.get_encoding('cl100k_base')
    return len(encoding.encode(text))


async def stream_upload_to_file(upload: UploadFile, destination: Path, max_bytes: int) -> None:
    size = 0
    with destination.open('wb') as writer:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                raise HTTPException(status_code=413, detail='Zip exceeds allowed size')
            writer.write(chunk)


@app.post('/parse', response_model=ParsedResponse)
async def parse_repo(
    repoUrl: str | None = Form(None),
    zipFile: UploadFile | None = File(None)
) -> ParsedResponse:
    if not repoUrl and not zipFile:
        raise HTTPException(status_code=422, detail='Provide either a repo URL or .zip file')

    with tempfile.TemporaryDirectory() as workspace:
        root_dir = Path(workspace) / 'project'
        root_dir.mkdir()

        if zipFile is not None:
            if not zipFile.filename.lower().endswith('.zip'):
                raise HTTPException(status_code=400, detail='Upload a .zip archive')
            temp_zip = Path(workspace) / 'upload.zip'
            await stream_upload_to_file(zipFile, temp_zip, MAX_ZIP_BYTES)
            try:
                safe_extract_zip(temp_zip, root_dir, MAX_EXTRACT_BYTES)
            except (zipfile.BadZipFile, ValueError) as exc:
                raise HTTPException(status_code=400, detail=str(exc))
        elif repoUrl:
            try:
                normalized_url = normalize_repo_url(repoUrl)
                await asyncio.to_thread(clone_repository, normalized_url, root_dir)
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=504, detail='Git clone timed out')
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

        tree, files = await asyncio.to_thread(recursively_collect, root_dir, Path())
        files_sorted = sorted(files, key=lambda record: record['path'])

        return ParsedResponse(files=files_sorted, tree=tree)


@app.post('/tokens', response_model=TokenResponse)
async def tokens(payload: TokenRequest) -> TokenResponse:
    if len(payload.text) > MAX_TOKEN_TEXT_CHARS:
        raise HTTPException(status_code=413, detail='Text exceeds allowed size')
    tokens_count = await asyncio.to_thread(count_tokens, payload.text, payload.model)
    return TokenResponse(tokens=tokens_count)


@app.get('/healthz')
async def healthz() -> Dict[str, str]:
    return {'status': 'ok'}
