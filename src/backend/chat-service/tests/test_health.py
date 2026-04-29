# src/backend/chat-service/tests/test_health.py
"""Smoke tests for /health and / endpoints."""
from starlette.testclient import TestClient
from main import app


def test_health_returns_ok_with_service_name():
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("status") == "ok"
    assert body.get("service") == "chat-service"


def test_root_returns_message():
    """The `/` endpoint is a public landing pong — used by smoke tools."""
    with TestClient(app) as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert "Chat Service" in resp.json().get("message", "")
