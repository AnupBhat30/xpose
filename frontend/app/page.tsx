"use client";

import clsx from "clsx";
import Prism from "prismjs";
// Prism language components depend on each other; keep the load order stable.
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-python";
import type { ReactNode, UIEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";

type FileRecord = {
  path: string;
  content?: string | null;
  size: number;
  omitted?: boolean;
  omittedReason?: string | null;
};

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

type HighlightEntry = {
  content: string;
  html: string;
  lines: string[];
  language: string;
};

type AggregatedRow =
  | { type: "header"; key: string; text: string }
  | { type: "code"; key: string; html: string; language: string }
  | { type: "spacer"; key: string };

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const LARGE_FILE_THRESHOLD = 512_000;
const TOKEN_WARNING_THRESHOLD = 128_000;
const CODE_LINE_HEIGHT = 20;
const ALWAYS_EXCLUDED_FILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
  "go.sum",
  "go.work.sum",
  "pipfile.lock",
  "poetry.lock",
  "pdm.lock",
  "uv.lock",
  "requirements.lock",
  "mix.lock",
  "podfile.lock",
  "package.resolved",
  "packages.lock.json",
  "pubspec.lock",
]);

const isAlwaysExcluded = (path: string) => {
  const name = path.split("/").pop()?.toLowerCase();
  return name ? ALWAYS_EXCLUDED_FILES.has(name) : false;
};

const wildcardToRegExp = (pattern: string) => {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
};

const getLanguage = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "json":
      return "json";
    case "py":
      return "python";
    case "md":
    case "markdown":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    case "css":
      return "css";
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    case "diff":
      return "diff";
    case "html":
    case "htm":
      return "markup";
    default:
      return "none";
  }
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sanitizeHighlightedHtml = (value: string) => {
  if (typeof window === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  const nodes = template.content.querySelectorAll("*");
  nodes.forEach((node) => {
    if (node.tagName !== "SPAN") {
      node.replaceWith(document.createTextNode(node.textContent ?? ""));
      return;
    }
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name !== "class") {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
};

const fenceForContent = (content: string) => {
  const matches = content.match(/`+/g);
  if (!matches) return "```";
  const maxRun = Math.max(...matches.map((run) => run.length));
  return "`".repeat(Math.max(3, maxRun + 1));
};

const highlightContent = (content: string, path: string) => {
  const language = getLanguage(path);
  const grammar = Prism.languages[language];

  if (!grammar) {
    return { html: escapeHtml(content), language: "none" };
  }

  const highlighted = Prism.highlight(content, grammar, language);
  return { html: sanitizeHighlightedHtml(highlighted), language };
};

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
};

const VirtualList = <T,>({
  items,
  itemHeight,
  overscan = 8,
  className,
  renderItem,
}: VirtualListProps<T>) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateHeight = () => setViewportHeight(node.clientHeight);
    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );
  const offsetY = startIndex * itemHeight;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextTop = event.currentTarget.scrollTop;
    if (scrollFrame.current !== null) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      setScrollTop(nextTop);
      scrollFrame.current = null;
    });
  };

  useEffect(() => {
    return () => {
      if (scrollFrame.current !== null) {
        window.cancelAnimationFrame(scrollFrame.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={clsx("h-full w-full overflow-auto", className)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items
            .slice(startIndex, endIndex)
            .map((item, idx) => renderItem(item, startIndex + idx))}
        </div>
      </div>
    </div>
  );
};

const formatBytes = (value: number) => {
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const size = value / Math.pow(1024, i);
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

type PanelTab = "preview" | "aggregated";
type SortKey =
  | "name-asc"
  | "name-desc"
  | "ext-asc"
  | "ext-desc"
  | "size-desc"
  | "size-asc"
  | "path-asc"
  | "path-desc";

const getExtension = (name: string) => {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
};

const compareValues = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export default function Page() {
  const [repoUrl, setRepoUrl] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [tree, setTree] = useState<FileNode[]>([]);
  const [filterPattern, setFilterPattern] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name-asc");
  const [panelTab, setPanelTab] = useState<PanelTab>("preview");
  const [isDragging, setIsDragging] = useState(false);
  const [resizing, setResizing] = useState<null | "left">(null);
  const [leftWidth, setLeftWidth] = useState(420);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);
  const [backendStatus, setBackendStatus] = useState<
    "unknown" | "online" | "offline"
  >("unknown");
  const [copyLabel, setCopyLabel] = useState("Copy All");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const highlightCacheRef = useRef<Map<string, HighlightEntry>>(new Map());
  const hasSetInitialWidths = useRef(false);

  const isExcludedByFilter = (path: string) => {
    if (!filterPattern.trim()) return false;
    const parts = filterPattern
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.some((p) => wildcardToRegExp(p).test(path));
  };

  const pingBackend = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${BACKEND_URL}/healthz`, {
        signal: controller.signal,
      });
      setBackendStatus(response.ok ? "online" : "offline");
    } catch (error) {
      setBackendStatus("offline");
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    pingBackend();
  }, [pingBackend]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const fileMetaByPath = useMemo(() => {
    const map = new Map<string, FileRecord>();
    files.forEach((file) => {
      map.set(file.path, file);
    });
    return map;
  }, [files]);

  const filteredFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          !file.omitted &&
          selectedPaths.has(file.path) &&
          !isExcludedByFilter(file.path),
      ),
    [files, selectedPaths, filterPattern],
  );

  const compareFiles = useCallback(
    (a: FileRecord, b: FileRecord) => {
      const nameCmp = compareValues(a.path, b.path);
      const extCmp = compareValues(getExtension(a.path), getExtension(b.path));
      const sizeCmp = (a.size ?? 0) - (b.size ?? 0);

      switch (sortBy) {
        case "name-asc":
          return compareValues(
            a.path.split("/").pop() ?? a.path,
            b.path.split("/").pop() ?? b.path,
          );
        case "name-desc":
          return compareValues(
            b.path.split("/").pop() ?? b.path,
            a.path.split("/").pop() ?? a.path,
          );
        case "ext-asc":
          return extCmp || compareValues(a.path, b.path);
        case "ext-desc":
          return -extCmp || compareValues(a.path, b.path);
        case "size-asc":
          return sizeCmp || compareValues(a.path, b.path);
        case "size-desc":
          return -sizeCmp || compareValues(a.path, b.path);
        case "path-desc":
          return -nameCmp;
        case "path-asc":
        default:
          return nameCmp;
      }
    },
    [sortBy],
  );

  const sortedFilteredFiles = useMemo(() => {
    const copy = [...filteredFiles];
    copy.sort(compareFiles);
    return copy;
  }, [filteredFiles, compareFiles]);

  const selectedCount = selectedPaths.size;
  const selectableCount = useMemo(
    () =>
      files.filter((file) => !file.omitted && !isExcludedByFilter(file.path))
        .length,
    [files, filterPattern],
  );

  const aggregatedOutput = useMemo(
    () =>
      sortedFilteredFiles
        .map((file) => `=== ${file.path} ===\n${file.content ?? ""}`)
        .join("\n\n"),
    [sortedFilteredFiles],
  );

  const aggregatedMarkdown = useMemo(() => {
    if (sortedFilteredFiles.length === 0) return "";
    return sortedFilteredFiles
      .map((file) => {
        const language = getLanguage(file.path);
        const content = file.content ?? "";
        const fence = fenceForContent(content);
        const label = language === "none" ? "" : language;
        return `### ${file.path}\n\n${fence}${label ? ` ${label}` : ""}\n${content}\n${fence}`;
      })
      .join("\n\n");
  }, [sortedFilteredFiles]);

  const visibleFile = useMemo(() => {
    if (selectedFile && !selectedFile.omitted) {
      if (!isExcludedByFilter(selectedFile.path)) {
        return selectedFile;
      }
    }
    return sortedFilteredFiles[0] ?? null;
  }, [sortedFilteredFiles, selectedFile, filterPattern]);

  const previewFile = selectedFile ?? sortedFilteredFiles[0] ?? null;
  const previewIsOmitted = !!previewFile?.omitted;

  const getHighlightEntry = useCallback((file: FileRecord) => {
    const cached = highlightCacheRef.current.get(file.path);
    if (cached && cached.content === file.content) {
      return cached;
    }

    const content = file.content ?? "";
    const { html, language } = highlightContent(content, file.path);
    const entry: HighlightEntry = {
      content,
      html,
      lines: html.split("\n"),
      language,
    };

    highlightCacheRef.current.set(file.path, entry);
    return entry;
  }, []);

  const visibleHighlight = useMemo(() => {
    if (!visibleFile) return null;
    return getHighlightEntry(visibleFile);
  }, [visibleFile, getHighlightEntry]);

  const highlightedLines = useMemo(
    () => visibleHighlight?.lines ?? [],
    [visibleHighlight],
  );

  const aggregatedRows = useMemo(() => {
    if (panelTab !== "aggregated") return [];
    const rows: AggregatedRow[] = [];
    sortedFilteredFiles.forEach((file, fileIndex) => {
      rows.push({
        type: "header",
        key: `header-${file.path}`,
        text: `=== ${file.path} ===`,
      });
      const entry = getHighlightEntry(file);
      if (entry.lines.length > 0) {
        entry.lines.forEach((line, lineIndex) => {
          rows.push({
            type: "code",
            key: `code-${file.path}-${lineIndex}`,
            html: line || " ",
            language: entry.language,
          });
        });
      } else {
        rows.push({
          type: "code",
          key: `code-${file.path}-empty`,
          html: " <empty file>",
          language: "none",
        });
      }

      if (fileIndex < sortedFilteredFiles.length - 1) {
        rows.push({ type: "spacer", key: `spacer-${file.path}` });
        rows.push({ type: "spacer", key: `spacer-${file.path}-2` });
      }
    });
    return rows;
  }, [sortedFilteredFiles, getHighlightEntry, panelTab]);

  const charCount = aggregatedOutput.length;
  const tokenEstimate = Math.ceil(charCount / 4);
  const resolvedTokenCount = tokenCount ?? tokenEstimate;
  const showsTokenWarning = resolvedTokenCount > TOKEN_WARNING_THRESHOLD;

  useEffect(() => {
    if (hasSetInitialWidths.current) return;
    if (!panelsRef.current) return;
    const rect = panelsRef.current.getBoundingClientRect();
    if (rect.width > 0) {
      setLeftWidth(Math.round(rect.width * 0.4));
      hasSetInitialWidths.current = true;
    }
  }, []);

  useEffect(() => {
    const collectDirs = (nodes: FileNode[], accumulator: Set<string>) => {
      nodes.forEach((node) => {
        if (node.type === "directory") {
          accumulator.add(node.path);
          if (node.children) {
            collectDirs(node.children, accumulator);
          }
        }
      });
    };

    const roots = new Set<string>();
    collectDirs(tree, roots);
    setOpenFolders(roots);
  }, [tree]);

  useEffect(() => {
    if (!viewerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerOpen]);

  useEffect(() => {
    if (!filterPattern) return;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      files.forEach((file) => {
        if (file.omitted || isExcludedByFilter(file.path))
          next.delete(file.path);
      });
      return next;
    });
  }, [filterPattern, files]);

  useEffect(() => {
    if (!aggregatedOutput) {
      setTokenCount(0);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTokenLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/tokens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: aggregatedOutput,
            model: "gpt-4o-mini",
          }),
          signal: controller.signal,
        });
        if (response.ok) {
          const payload = (await response.json()) as { tokens: number };
          setTokenCount(payload.tokens);
        } else {
          setTokenCount(tokenEstimate);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTokenCount(tokenEstimate);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTokenLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [aggregatedOutput, tokenEstimate]);

  useEffect(() => {
    if (!resizing) return;

    const handleMove = (event: MouseEvent) => {
      if (!panelsRef.current) return;
      const rect = panelsRef.current.getBoundingClientRect();
      const minLeft = 240;
      const maxLeft = 520;

      if (resizing === "left") {
        const nextLeft = Math.min(
          Math.max(event.clientX - rect.left, minLeft),
          maxLeft,
        );
        setLeftWidth(nextLeft);
      }
    };

    const handleUp = () => setResizing(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  const handleCopy = async () => {
    if (!aggregatedOutput) return;
    try {
      await navigator.clipboard.writeText(aggregatedOutput);
      setCopyLabel("Copied!");
    } catch (error) {
      console.error(error);
      setCopyLabel("Failed");
    }
    setTimeout(() => setCopyLabel("Copy All"), 1200);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUrlError(null);
    setZipError(null);
    if (!repoUrl && !zipFile) {
      setMessage({
        type: "error",
        text: "Provide either a public GitHub URL or a .zip file.",
      });
      return;
    }

    const githubRegex =
      /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/i;
    if (repoUrl && !githubRegex.test(repoUrl.trim())) {
      setUrlError("Enter a valid GitHub URL");
      return;
    }

    const formData = new FormData();
    if (zipFile) {
      formData.append("zipFile", zipFile);
    } else if (repoUrl) {
      formData.append("repoUrl", repoUrl);
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to fetch files");
      }

      const payload = (await response.json()) as {
        files: FileRecord[];
        tree: FileNode[];
      };
      setFiles(payload.files);
      setTree(payload.tree);
      highlightCacheRef.current.clear();
      const defaultIncluded = new Set<string>();
      payload.files.forEach((file) => {
        if (
          !file.omitted &&
          file.size <= LARGE_FILE_THRESHOLD &&
          !isAlwaysExcluded(file.path)
        ) {
          defaultIncluded.add(file.path);
        }
      });
      setSelectedPaths(defaultIncluded);
      setSelectedFile(null);
      setCopyLabel("Copy All");
      setMessage({
        type: "info",
        text: `Loaded ${payload.files.length} files.`,
      });
      setBackendStatus("online");
    } catch (error) {
      if (error instanceof TypeError) {
        setBackendStatus("offline");
        setMessage({
          type: "error",
          text: "Backend unreachable. Check that the API is running.",
        });
      } else {
        const message =
          error instanceof Error
            ? error.message.replace(/\n/g, " ").trim()
            : "Failed to load repository.";
        setMessage({ type: "error", text: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInclude = (path: string) => {
    const meta = fileMetaByPath.get(path);
    if (meta?.omitted) return;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    files.forEach((file) => {
      if (
        !file.omitted &&
        !isExcludedByFilter(file.path) &&
        !isAlwaysExcluded(file.path)
      ) {
        next.add(file.path);
      }
    });
    setSelectedPaths(next);
  };

  const handleDeselectAll = () => {
    setSelectedPaths(new Set());
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      setZipError("Only .zip files are supported.");
      return;
    }
    setZipError(null);
    setZipFile(file);
    setRepoUrl("");
    setUrlError(null);
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelectFile = (path: string) => {
    const file = files.find((f) => f.path === path);
    if (file) {
      setSelectedFile(file);
      setPanelTab("preview");
    }
  };

  const getSizeForPath = (path: string) => fileMetaByPath.get(path)?.size ?? 0;

  const renderTree = (nodes: FileNode[]) => {
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      const nameCmp = compareValues(a.name, b.name);
      if (sortBy === "name-asc") return nameCmp;
      if (sortBy === "name-desc") return -nameCmp;
      if (sortBy === "ext-asc") {
        const extCmp = compareValues(
          getExtension(a.name),
          getExtension(b.name),
        );
        return extCmp || nameCmp;
      }
      if (sortBy === "ext-desc") {
        const extCmp = compareValues(
          getExtension(a.name),
          getExtension(b.name),
        );
        return -extCmp || nameCmp;
      }
      if (sortBy === "size-asc") {
        const sizeCmp = getSizeForPath(a.path) - getSizeForPath(b.path);
        return sizeCmp || nameCmp;
      }
      if (sortBy === "size-desc") {
        const sizeCmp = getSizeForPath(b.path) - getSizeForPath(a.path);
        return sizeCmp || nameCmp;
      }
      if (sortBy === "path-desc") return compareValues(b.path, a.path);
      return compareValues(a.path, b.path);
    });

    return sortedNodes.map((node) => {
      if (node.type === "directory") {
        const isOpen = openFolders.has(node.path);
        return (
          <div key={node.path} className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] font-medium text-textPrimary transition-colors hover:bg-white/5"
              onClick={() => toggleFolder(node.path)}
            >
              <span className="text-accent">{isOpen ? "▾" : "▸"}</span>
              <span className="truncate">{node.name}/</span>
            </button>
            {isOpen && node.children && (
              <div className="ml-4 border-l border-white/10 pl-3 text-textSecondary">
                {renderTree(node.children)}
              </div>
            )}
          </div>
        );
      }

      const meta = fileMetaByPath.get(node.path);
      const size = meta?.size ?? getSizeForPath(node.path);
      const isLarge = size > LARGE_FILE_THRESHOLD;
      const omitted = meta?.omitted;
      const omittedReason = meta?.omittedReason;
      const excluded =
        !!omitted ||
        !selectedPaths.has(node.path) ||
        isExcludedByFilter(node.path);

      return (
        <button
          key={node.path}
          type="button"
          onClick={() => handleSelectFile(node.path)}
          className={clsx(
            "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] font-medium transition-colors",
            "hover:bg-white/5",
            selectedFile?.path === node.path
              ? "border-l-2 border-accent bg-white/5 text-textPrimary"
              : "text-textSecondary",
          )}
        >
          <input
            type="checkbox"
            checked={!excluded}
            disabled={!!omitted}
            onChange={(event) => {
              event.stopPropagation();
              handleToggleInclude(node.path);
            }}
            className="h-4 w-4 rounded border border-white/20 bg-transparent text-accent focus:ring-0"
          />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate font-mono text-[13px]">{node.name}</span>
            <span
              className={clsx(
                "min-w-[68px] text-right text-[11px]",
                excluded ? "text-destructive" : "text-textSecondary",
              )}
            >
              {omitted
                ? omittedReason === "binary"
                  ? "Binary"
                  : "Omitted"
                : excluded
                  ? "Excluded"
                  : isLarge
                    ? ">500KB"
                    : formatBytes(size)}
            </span>
          </div>
        </button>
      );
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-textPrimary">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-14 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-30 -mx-4 -mt-2 flex flex-col gap-3 border-b border-white/10 bg-[#0a0a0ae6] px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex items-center justify-center">
              <h1 className="font-space-grotesk text-[32px] font-normal tracking-[-0.02em] text-textPrimary">
                Xpose
              </h1>
            </div>
          </header>

          {backendStatus === "offline" && (
            <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Backend is unreachable. Check that the API is running and
              `NEXT_PUBLIC_BACKEND_URL` is correct.
            </div>
          )}

          <section className="mt-6 space-y-4 rounded-2xl border border-borderSoft bg-surface p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-textSecondary">Input</p>
              </div>
              {showsTokenWarning && (
                <span className="rounded-lg border border-[#FFB020]/30 bg-[#FFB020]/10 px-3 py-1 text-xs font-medium text-[#FFB020]">
                  ⚠ Output may exceed model context
                </span>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch"
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-textSecondary">
                  GitHub URL
                </span>
                <input
                  value={repoUrl}
                  onChange={(event) => {
                    setRepoUrl(event.target.value);
                    setZipFile(null);
                    setZipError(null);
                    setUrlError(null);
                  }}
                  placeholder="https://github.com/user/repo"
                  className={clsx(
                    "w-full rounded-[10px] border bg-panel px-4 py-3 text-sm text-textPrimary placeholder:text-textSecondary transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50",
                    urlError ? "border-destructive/80" : "border-white/10",
                  )}
                />
                {urlError && (
                  <span className="text-xs text-destructive">{urlError}</span>
                )}
              </label>

              <div className="flex items-center justify-center text-xs font-medium text-textSecondary">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  OR
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-textSecondary">
                  Upload .zip
                </span>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={clsx(
                    "flex h-full min-h-[64px] items-center justify-between gap-3 rounded-[10px] border border-dashed bg-panel px-4 py-3 text-sm transition-colors",
                    isDragging
                      ? "border-accent/80 bg-accent/5"
                      : "border-white/10",
                    zipError ? "border-destructive/80" : "",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">↑</span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-textPrimary">
                        {zipFile
                          ? zipFile.name
                          : "Drop .zip or click to browse"}
                      </p>
                      <p className="text-xs text-textSecondary">
                        Max ~50MB · Only .zip accepted
                      </p>
                    </div>
                  </div>
                  <label className="rounded-[10px] border border-white/10 px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/5">
                    Choose file
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (!file.name.endsWith(".zip")) {
                          setZipError("Only .zip files are supported.");
                          return;
                        }
                        setZipError(null);
                        setZipFile(file);
                        setRepoUrl("");
                        setUrlError(null);
                      }}
                    />
                  </label>
                </div>
                {zipError && (
                  <span className="text-xs text-destructive">{zipError}</span>
                )}
              </div>

              <div className="sm:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  disabled={loading}
                  type="submit"
                  className={clsx(
                    "inline-flex w-full items-center justify-center rounded-[10px] bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0a] transition-colors duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:w-auto",
                    loading && "cursor-wait opacity-80",
                  )}
                >
                  {loading ? "Unrolling…" : "Unroll"}
                </button>
                <div
                  className={clsx(
                    "relative h-1 w-full flex-1 overflow-hidden rounded-full bg-white/5 transition sm:w-auto",
                    loading ? "opacity-100" : "opacity-0",
                  )}
                >
                  <div className="progress-shimmer absolute inset-y-0 left-0 w-1/3 bg-accent" />
                </div>
              </div>
            </form>
            {message && (
              <p
                className={clsx(
                  "text-sm font-medium",
                  message.type === "error"
                    ? "text-destructive"
                    : "text-textPrimary",
                )}
              >
                {message.text}
              </p>
            )}
          </section>

          <main
            ref={panelsRef}
            className="mt-6 grid gap-4 lg:gap-2"
            style={{
              gridTemplateColumns: isDesktop
                ? `${leftWidth}px 8px minmax(0,1fr)`
                : "minmax(0,1fr)",
            }}
          >
            <section className="flex min-h-[55vh] flex-col rounded-2xl border border-borderSoft bg-surface p-4 shadow-soft sm:min-h-[60vh] lg:min-h-[70vh]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-textSecondary">
                  File Tree
                </p>
                <span className="text-xs text-textSecondary">
                  {selectedCount}/{selectableCount} selected
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-textSecondary">
                <span>{files.length || 0} files</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="rounded-[8px] border border-white/10 px-2 py-1 text-[12px] text-textSecondary transition hover:bg-white/5"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="rounded-[8px] border border-white/10 px-2 py-1 text-[12px] text-textSecondary transition hover:bg-white/5"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={filterPattern}
                    onChange={(e) => setFilterPattern(e.target.value)}
                    placeholder="Exclude e.g. *.test.ts, docs/"
                    className="w-full rounded-[10px] border border-white/10 bg-[#0d0d0d] px-3 py-2 text-sm text-textPrimary placeholder:text-textSecondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div className="flex items-center justify-between text-[12px] text-textSecondary">
                  <span>Sorting</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="rounded-[8px] border border-white/10 bg-[#0d0d0d] px-2 py-1 text-[12px] text-textPrimary focus:border-accent focus:outline-none"
                  >
                    <option value="name-asc">Name (A → Z)</option>
                    <option value="name-desc">Name (Z → A)</option>
                    <option value="ext-asc">Extension (A → Z)</option>
                    <option value="ext-desc">Extension (Z → A)</option>
                    <option value="size-desc">Size (Large → Small)</option>
                    <option value="size-asc">Size (Small → Large)</option>
                    <option value="path-asc">Path (A → Z)</option>
                    <option value="path-desc">Path (Z → A)</option>
                  </select>
                </div>
              </div>
              <div className="relative mt-3 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-inner">
                <div className="absolute inset-0 overflow-y-auto space-y-1 px-2 py-3">
                  {tree.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-textSecondary">
                      <span className="text-xl">📁</span>
                      <p className="text-sm">No files loaded yet.</p>
                    </div>
                  ) : (
                    renderTree(tree)
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-textSecondary">
                Files over 500KB or binary files are omitted by default. Toggle
                checkboxes to include/exclude; filters also exclude from output.
              </p>
            </section>

            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={() => setResizing("left")}
              className={clsx(
                "group relative hidden cursor-col-resize items-stretch justify-center lg:flex",
                resizing === "left" && "bg-white/5",
              )}
            >
              <div className="h-full w-[2px] rounded-full bg-white/10 group-hover:bg-accent/60" />
            </div>

            <section className="flex min-h-[55vh] flex-col rounded-2xl border border-borderSoft bg-surface p-4 shadow-soft sm:min-h-[60vh] lg:min-h-[70vh]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-2 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                  <button
                    type="button"
                    onClick={() => setPanelTab("preview")}
                    className={clsx(
                      "rounded-[8px] px-3 py-2 text-sm font-medium transition-colors",
                      panelTab === "preview"
                        ? "bg-white/10 text-textPrimary"
                        : "text-textSecondary hover:bg-white/5",
                    )}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelTab("aggregated")}
                    className={clsx(
                      "rounded-[8px] px-3 py-2 text-sm font-medium transition-colors",
                      panelTab === "aggregated"
                        ? "bg-white/10 text-textPrimary"
                        : "text-textSecondary hover:bg-white/5",
                    )}
                  >
                    Aggregated
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {panelTab === "preview" &&
                    previewFile &&
                    !previewIsOmitted && (
                      <span className="rounded-[10px] border border-white/10 bg-panel px-3 py-1 text-xs text-textSecondary">
                        {(previewFile.content?.length ?? 0).toLocaleString()}{" "}
                        chars
                      </span>
                    )}
                  {((panelTab === "preview" &&
                    previewFile &&
                    !previewIsOmitted) ||
                    (panelTab === "aggregated" && aggregatedOutput)) && (
                    <button
                      type="button"
                      disabled={!aggregatedOutput && panelTab === "aggregated"}
                      onClick={() => setViewerOpen(true)}
                      className={clsx(
                        "rounded-[10px] border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                        panelTab === "aggregated" &&
                          !aggregatedOutput &&
                          "pointer-events-none opacity-40",
                      )}
                    >
                      Expand
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mt-3 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-inner">
                <div className="absolute inset-0">
                  {filteredFiles.length === 0 && !previewFile ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-textSecondary">
                      <span className="text-xl">🗂️</span>
                      <p className="text-sm">Awaiting content…</p>
                    </div>
                  ) : panelTab === "preview" &&
                    previewFile &&
                    previewIsOmitted ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-textSecondary">
                      <span className="text-xl">📄</span>
                      <p className="text-sm">
                        {previewFile.omittedReason === "binary"
                          ? "This file is binary and was omitted."
                          : "This file is large and was omitted from the payload."}
                      </p>
                    </div>
                  ) : panelTab === "preview" && visibleFile ? (
                    <VirtualList
                      items={highlightedLines}
                      itemHeight={CODE_LINE_HEIGHT}
                      overscan={12}
                      className="text-[13px] leading-[20px] text-textPrimary"
                      renderItem={(line: string, idx: number) => (
                        <div
                          key={`${visibleFile.path}-${idx}`}
                          className="grid grid-cols-[auto,1fr] gap-x-4 px-4 font-mono"
                          style={{ height: CODE_LINE_HEIGHT }}
                        >
                          <span className="select-none text-right text-[12px] text-textSecondary/70">
                            {idx + 1}
                          </span>
                          <span
                            className="whitespace-pre text-textPrimary"
                            dangerouslySetInnerHTML={{ __html: line || " " }}
                          />
                        </div>
                      )}
                    />
                  ) : (
                    <VirtualList
                      items={aggregatedRows}
                      itemHeight={CODE_LINE_HEIGHT}
                      overscan={12}
                      className="text-[13px] leading-[20px] text-textPrimary"
                      renderItem={(row) => {
                        if (row.type === "spacer") {
                          return (
                            <div
                              key={row.key}
                              style={{ height: CODE_LINE_HEIGHT }}
                            />
                          );
                        }

                        if (row.type === "header") {
                          return (
                            <div
                              key={row.key}
                              className="px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-textSecondary"
                              style={{ height: CODE_LINE_HEIGHT }}
                            >
                              {row.text}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={row.key}
                            className={clsx(
                              "px-4 font-mono text-textPrimary",
                              row.language !== "none" &&
                                `language-${row.language}`,
                            )}
                            style={{ height: CODE_LINE_HEIGHT }}
                          >
                            <span
                              className="whitespace-pre"
                              dangerouslySetInnerHTML={{ __html: row.html }}
                            />
                          </div>
                        );
                      }}
                    />
                  )}
                </div>
                {panelTab === "preview" && previewFile && !previewIsOmitted && (
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(previewFile.content ?? "")
                    }
                    className="absolute right-3 top-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-textPrimary opacity-0 transition duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 lg:opacity-100"
                  >
                    Copy
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-[#0f0f0f] p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-textSecondary">
                    Token estimate
                  </p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-semibold text-textPrimary">
                      {tokenLoading
                        ? "..."
                        : resolvedTokenCount.toLocaleString()}
                    </span>
                    <span className="text-sm text-textSecondary">
                      {charCount.toLocaleString()} chars
                    </span>
                  </div>
                  {showsTokenWarning && (
                    <p className="text-xs text-[#FFB020]">
                      ⚠ Output exceeds ~128K tokens — may exceed model context.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-white/10 bg-[#0b0b0b] p-1">
                    <button
                      type="button"
                      disabled={!aggregatedOutput}
                      onClick={handleCopy}
                      className={clsx(
                        "min-w-[110px] rounded-[10px] px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                        !aggregatedOutput && "pointer-events-none opacity-40",
                      )}
                    >
                      {copyLabel}
                    </button>
                    <button
                      type="button"
                      disabled={!aggregatedOutput}
                      onClick={() => {
                        const blob = new Blob([aggregatedOutput], {
                          type: "text/plain",
                        });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "unrolled-output.txt";
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className={clsx(
                        "min-w-[110px] rounded-[10px] px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                        !aggregatedOutput && "pointer-events-none opacity-40",
                      )}
                    >
                      Download .txt
                    </button>
                    <button
                      type="button"
                      disabled={!aggregatedMarkdown}
                      onClick={() => {
                        const blob = new Blob([aggregatedMarkdown], {
                          type: "text/markdown",
                        });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "unrolled-output.md";
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className={clsx(
                        "min-w-[110px] rounded-[10px] px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                        !aggregatedMarkdown && "pointer-events-none opacity-40",
                      )}
                    >
                      Download .md
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {viewerOpen &&
            ((previewFile && !previewIsOmitted) || aggregatedOutput) && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
                onClick={() => setViewerOpen(false)}
              >
                <div
                  className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                      {panelTab === "preview" && previewFile ? (
                        <>
                          <p className="truncate text-sm font-semibold text-textPrimary">
                            {previewFile.path}
                          </p>
                          <p className="text-xs text-textSecondary">
                            {(
                              previewFile.content?.length ?? 0
                            ).toLocaleString()}{" "}
                            chars
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="truncate text-sm font-semibold text-textPrimary">
                            Aggregated Output
                          </p>
                          <p className="text-xs text-textSecondary">
                            {filteredFiles.length} files ·{" "}
                            {charCount.toLocaleString()} chars
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (panelTab === "preview" && previewFile) {
                            navigator.clipboard.writeText(
                              previewFile.content ?? "",
                            );
                          } else {
                            navigator.clipboard.writeText(aggregatedOutput);
                          }
                        }}
                        className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        {panelTab === "preview" ? "Copy" : "Copy all"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerOpen(false)}
                        className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-textPrimary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {panelTab === "preview" && previewFile ? (
                      <pre className="min-h-full px-4 py-4 font-mono text-[13px] leading-relaxed text-textPrimary">
                        <code
                          className={clsx(
                            "whitespace-pre",
                            visibleHighlight?.language &&
                              visibleHighlight.language !== "none" &&
                              `language-${visibleHighlight.language}`,
                          )}
                          dangerouslySetInnerHTML={{
                            __html:
                              visibleHighlight?.html ??
                              escapeHtml(previewFile.content ?? ""),
                          }}
                        />
                      </pre>
                    ) : (
                      <VirtualList
                        items={aggregatedRows}
                        itemHeight={CODE_LINE_HEIGHT}
                        overscan={14}
                        className="text-[13px] leading-[20px] text-textPrimary"
                        renderItem={(row) => {
                          if (row.type === "spacer") {
                            return (
                              <div
                                key={row.key}
                                style={{ height: CODE_LINE_HEIGHT }}
                              />
                            );
                          }

                          if (row.type === "header") {
                            return (
                              <div
                                key={row.key}
                                className="px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-textSecondary"
                                style={{ height: CODE_LINE_HEIGHT }}
                              >
                                {row.text}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={row.key}
                              className={clsx(
                                "px-4 font-mono text-textPrimary",
                                row.language !== "none" &&
                                  `language-${row.language}`,
                              )}
                              style={{ height: CODE_LINE_HEIGHT }}
                            >
                              <span
                                className="whitespace-pre"
                                dangerouslySetInnerHTML={{ __html: row.html }}
                              />
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
