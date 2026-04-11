# How to Add Tests

This guide explains how to add and run tests for both the backend and frontend of the 42 Transcendence project.

## Overview

We prioritize automated testing to ensure the stability and correctness of our microservices and SPA.
- **Backend:** Python 3.12, `pytest`, `pytest-asyncio`, `httpx`, `Starlette TestClient`.
- **Frontend:** React 18, `vitest`, `@testing-library/react`, `jsdom`.

---

## 1. Backend Tests (Python/Pytest)

Backend tests are organized per microservice and located in their respective `tests/` directories.

### Location & Naming
- **Directory:** `src/backend/<service-name>/tests/`
- **Files:** `test_*.py` (e.g., `test_auth.py`, `test_profile.py`)
- **Functions:** `test_*()` (e.g., `async def test_login_success()`)

### Shared Infrastructure
- **`conftest.py`:** Located in each service's `tests/` folder. It handles:
  - **Path Shims:** Allows `pytest` to import the `service` module correctly.
  - **DB Mocking:** Automatically overrides FastAPI's `get_db` dependency with a mock `AsyncSession`.
  - **Auth Mocking:** Overrides `get_current_user` to return a default test user (ID: 9999).

### How to Run Tests
Prefer calling `make check` from the project root, which runs all tests across services.

For service-specific testing: use either of the following methods.

#### Inside Docker (Recommended)
This ensures the environment matches exactly what's running in production.
```bash
# Replace <service> with user-service, game-service, or chat-service
docker compose exec <service> sh -c "cd /app/service && pytest tests/ -v"
```

#### Locally
Ensure you have the required dependencies installed (`pip install -r requirements-test.txt`).
```bash
cd src/backend/<service>
pytest tests/ -v
```

### Writing a Basic Endpoint Test
```python
import pytest
from starlette.testclient import TestClient
from main import app

def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/users/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

### Writing an Async Test with DB Mocking
Our project uses `asyncio_mode = auto` in `shared/pytest.ini`, so `async def` tests are automatically handled.
```python
import pytest
from unittest.mock import AsyncMock, MagicMock

async def test_profile_update(mock_db_session):
    # mock_db_session is provided by the autouse fixture in conftest.py
    from service.main import update_user_profile
    
    # Configure your mock session behavior if needed
    # ...
    
    # Run your test logic
    # ...
```

---

## 2. Frontend Tests (React/Vitest)

Frontend tests are located alongside the components or utilities they test.

### Location & Naming
- **Components:** `src/frontend/src/Components/<ComponentName>.test.jsx`
- **Pages:** `src/frontend/src/pages/<PageName>.test.jsx`
- **Utilities:** `src/frontend/src/utils/<utilName>.test.js`

### How to Run Tests
Tests are run using `vitest`.
```bash
cd src/frontend
npm test        # Runs all tests once
npm run dev     # (In another terminal) Vitest often runs in watch mode during development
```

### Writing a Component Test
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeDefined();
  });
});
```

---

## 3. Best Practices

1.  **Mock Externals:** Always mock database calls and external API requests (use `httpx` and `unittest.mock`).
2.  **Test Isolation:** Ensure tests do not depend on each other's state.
3.  **Naming:** Use descriptive test names that explain the "what" and "why" (e.g., `test_update_profile_fails_with_invalid_email`).
4.  **Coverage:** Aim to cover both "happy paths" and edge cases/error conditions.
5.  **Clean Up:** If you create any temporary data in a real DB (rare), ensure it is cleaned up.

---

## 4. Health Checks

We also have a global health check script that verifies all services are up and responding:
```bash
make check
```
This script runs `tests/TranscendenceHealthCheck.sh` and saves the report to `release.txt`.
