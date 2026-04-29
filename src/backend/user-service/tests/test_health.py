# src/backend/user-service/tests/test_health.py
"""Smoke tests for /health endpoint."""
from starlette.testclient import TestClient
from service.main import app


def test_health_returns_ok():
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    # The shape may vary slightly per service; minimum contract is status=ok
    assert body.get("status") == "ok"
