# API-Level E2E Tests

This directory contains **end-to-end tests** that drive complete user
journeys through the running services via real HTTP/WebSocket — no Python
or JS mocks. They sit between the per-service smoke tests (`test_router.py`)
and full browser-driven E2E (which would use Playwright/Puppeteer).

## What they cover

- Multi-service flows (game-service ↔ user-service ↔ chat-service)
- Real authentication (JWT minted by user-service, validated by game-service)
- Side effects of HTTP requests (XP awarding, achievement unlocking, notifications)
- Response shape contracts at the public API boundary

## What they do NOT cover

- React rendering, click flow, CSS layout, browser-specific bugs
  (those need Playwright/Puppeteer — see the proposal in
  `docs/superpowers/specs/2026-04-26-test-landscape-and-e2e-proposal.md`)

## Running

### As part of `make check` (the only supported way in CI)
```bash
make check
```

The full `make check` flow includes a section called **"API E2E Tests"** that
spins up a throwaway `python:3.12-slim` container, joins it to
`transcendence_network`, mounts this directory into `/work`, installs the
requirements, and runs `pytest`. The pass/fail count is rolled into the suite
totals printed at the end.

### Manually for local iteration (faster than full `make check`)
```bash
docker run --rm \
  --network transcendence_network \
  -v "$(pwd)/tests/api_e2e:/work" \
  -w /work \
  python:3.12-slim \
  bash -c "pip install -q -r requirements.txt && pytest"
```

### From the host (against localhost — needs deps installed locally)
```bash
cd tests/api_e2e
pip install -r requirements.txt
E2E_BASE_URL=https://localhost:8443 pytest
```

## Adding a new test

1. Create `test_<feature>_e2e.py` in this directory.
2. Use the `api` fixture (HTTP client) from `conftest.py`.
3. Use `register_user(api)` to create fresh test users (the helper picks
   a unique high-ID username per call so there's no collision).
4. Drive the same path the frontend would: call the same endpoints, in
   the same order, with the same shapes.
5. Assert on observable effects (response shape, side-effect endpoints
   like `/xp/{id}` after a match).

## DB state convention

Tests share a long-lived database with all other suites. **Never** use
`TRUNCATE`. The `register_user(api)` helper picks a unique-per-call
username to avoid collisions. Achievement unlocks accumulate across
runs — when asserting on "newly unlocked", capture state BEFORE the
action and compare to AFTER.
