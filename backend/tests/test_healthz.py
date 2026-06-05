from fastapi.testclient import TestClient

from main import app, get_allowed_origins


def test_healthz_ok():
    client = TestClient(app)
    response = client.get('/healthz')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_healthz_allows_production_origin():
    client = TestClient(app)
    response = client.get(
        '/healthz',
        headers={'Origin': 'https://xpose.anupbhat.com'},
    )
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == (
        'https://xpose.anupbhat.com'
    )


def test_allowed_origins_include_defaults_and_strip_trailing_slash(monkeypatch):
    monkeypatch.setenv(
        'ALLOWED_ORIGINS',
        'https://preview.example.com/, https://xpose.anupbhat.com/',
    )

    assert get_allowed_origins() == [
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://xpose.anupbhat.com',
        'https://preview.example.com',
        'https://xpose.anupbhat.com',
    ]
