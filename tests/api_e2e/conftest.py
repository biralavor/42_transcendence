"""Shared fixtures for API-level E2E tests.

These tests run against the LIVE running services through nginx (or directly
against service containers when joining the docker-compose network). They
exercise complete user journeys via real HTTP/WS — no Python/JS mocks.

Run from the repo root with `make check` (or `make e2e`), which invokes
tests/TranscendenceHealthCheck.sh; that script spins up a throwaway python
container, joins it to the `transcendence_network` docker network, and
executes the pytest suite in this directory.

NOTE: Tests share the same long-lived database as the rest of the suite.
Use HIGH user IDs (60000+) when registering ad-hoc users so you don't collide
with seeded fixtures (alice=1, bob=2, ...) or other suite users (5001-5999,
9000+).
"""
from __future__ import annotations

import os
import uuid
import pytest
import pytest_asyncio
import httpx


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

# When run from inside the docker network, hit nginx directly (HTTPS terminated there).
# When run from the host, override with E2E_BASE_URL=https://localhost:8443
BASE_URL = os.getenv("E2E_BASE_URL", "https://nginx")

# Self-signed certs in dev — disable verification.
HTTPX_KWARGS = {"verify": False, "follow_redirects": True, "timeout": 15.0}


# --------------------------------------------------------------------------- #
# HTTP client fixture
# --------------------------------------------------------------------------- #

@pytest_asyncio.fixture
async def api():
    """Yield an unauthenticated httpx.AsyncClient pointed at the public API base."""
    async with httpx.AsyncClient(base_url=BASE_URL, **HTTPX_KWARGS) as client:
        yield client


# --------------------------------------------------------------------------- #
# Auth helpers
# --------------------------------------------------------------------------- #

def _unique_username(prefix: str = "e2e") -> str:
    """Return a username unique to this test run.

    Uses uuid4 hex (12 chars of entropy) so concurrent test files and parallel
    runs (pytest-xdist) cannot collide on a 409 "User already exists". Total
    length stays within the 32-char registration validator.
    """
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


async def register_user(api: httpx.AsyncClient, username: str | None = None,
                         password: str = "P@ssw0rd123!") -> dict:
    """Register a new user via /api/users/auth/register.

    Returns: {'username': str, 'password': str, 'user_id': int, 'token': str}
    Raises: AssertionError if registration fails.
    """
    if username is None:
        username = _unique_username()

    resp = await api.post("/api/users/auth/register", json={
        "username": username,
        "password": password,
    })
    assert resp.status_code in (200, 201), (
        f"register failed: {resp.status_code} {resp.text[:200]}"
    )

    # Some backends return tokens directly on register; others require a follow-up login.
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    token = body.get("access_token")
    if not token:
        token = await login(api, username, password)

    user_id = await whoami_id(api, token)
    return {
        "username": username,
        "password": password,
        "user_id": user_id,
        "token": token,
    }


async def login(api: httpx.AsyncClient, username: str, password: str) -> str:
    """Login and return the access_token."""
    resp = await api.post("/api/users/auth/login", json={
        "username": username, "password": password,
    })
    assert resp.status_code == 200, f"login failed: {resp.status_code} {resp.text[:200]}"
    token = resp.json().get("access_token")
    assert token, f"no access_token in login response: {resp.text[:200]}"
    return token


async def whoami_id(api: httpx.AsyncClient, token: str) -> int:
    """Resolve the current user's id from /auth/me."""
    resp = await api.get("/api/users/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"/auth/me failed: {resp.status_code} {resp.text[:200]}"
    user_id = resp.json().get("id")
    assert user_id is not None, f"no id in /auth/me response: {resp.text[:200]}"
    return user_id


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
