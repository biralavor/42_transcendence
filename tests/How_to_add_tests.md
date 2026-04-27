# How to Add Tests

This guide explains how to add and run tests for both the backend and frontend of the 42 Transcendence project.

## Overview

We prioritize automated testing to ensure the stability and correctness of our microservices and SPA.
- **Backend:** Python 3.12, `pytest`, `pytest-asyncio`, `httpx`, `Starlette TestClient`.
- **Frontend:** React 18, `vitest`, `@testing-library/react`, `jsdom`.

### Test Architecture Overview

Transcendence uses a **layered test strategy**:

```
┌─────────────────────────────────────────────────────────┐
│  E2E Integration Tests (Event-Driven, Full Stack)       │
│  Location: tests/TranscendenceHealthCheck.sh            │
│  Purpose: Verify services work together (game invites,  │
│           WebSocket communication, notifications)       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Backend Unit Tests (Per Service)                       │
│  Location: src/backend/<service>/tests/test_*.py        │
│  Purpose: Test API endpoints, business logic, DB        │
│  Frameworks: pytest, httpx.AsyncClient, mocking         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Frontend Unit + Component Tests                        │
│  Location: src/frontend/src/**/*.test.jsx/.js          │
│  Purpose: Test React components, user flows             │
│  Frameworks: vitest, @testing-library/react, userEvent  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Docker Health Checks                                   │
│  Location: make check                                   │
│  Purpose: Verify all containers running, basic routes   │
└─────────────────────────────────────────────────────────┘
```

**Run all tests together:**
```bash
make check  # Runs: Backend Unit → Frontend Unit → E2E Integration → Health Checks
```

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

**Example conftest.py available at:**
- `src/backend/user-service/tests/conftest.py`
- `src/backend/game-service/tests/conftest.py`
- `src/backend/chat-service/tests/conftest.py`

**Fixtures you can use in your tests:**
```python
# From conftest.py (autouse, provides mock DB session)
mock_db_session  # Mock SQLAlchemy AsyncSession

# Custom pytest markers
@pytest.mark.asyncio  # For async tests (though asyncio_mode=auto often not needed)
```

### How to Run Tests

#### Full Test Suite (Recommended)
Prefer calling `make check` from the project root, which runs all unit tests and health checks:
```bash
make check
```

#### Service-Specific Tests

**Inside Docker (Recommended - matches production environment):**
```bash
# Replace <service> with user-service, game-service, or chat-service
docker exec <service> pytest tests/ -v
```

**Locally:**
Ensure you have the required dependencies installed (`pip install -r requirements.txt requirements-test.txt`).
```bash
cd src/backend/<service>
pytest tests/ -v
```

**Watch mode for development:**
```bash
cd src/backend/<service>
pytest tests/ -v --tb=short -x  # -x stops on first failure
```

### Writing a Basic Endpoint Test

**Simple synchronous endpoint:**
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

**Async endpoints with AsyncClient (Updated httpx API):**
For async endpoints, use `httpx.AsyncClient` with `ASGITransport`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_async_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/users/profile")
        assert response.status_code == 200
```

**⚠️ Avoid:** The old `AsyncClient(app=app)` API is deprecated. Always use `ASGITransport` wrapper.

### Writing an Async Test with DB Mocking
Our project uses `asyncio_mode = auto` in `shared/pytest.ini`, so `async def` tests are automatically handled. The `mock_db_session` fixture is autouse in `conftest.py`:
```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_profile_update(mock_db_session: AsyncSession):
    # mock_db_session is provided by autouse fixture in conftest.py
    # It automatically replaces FastAPI's get_db dependency
    
    # Configure expected behavior
    mock_user = MagicMock(id=4, username='joao')
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = mock_user
    # Optionally configure additions, deletions, etc.
    
    # Import and test your function
    from service.service import update_user_profile
    result = await update_user_profile(4, {'email': 'joao@example.com'}, mock_db_session)
    
    # Verify the mock was called correctly
    assert result.email == 'joao@example.com'
```

---

## 2. Frontend Tests (React/Vitest)

Frontend tests are located alongside the components or utilities they test.

### Location & Naming
- **Components:** `src/frontend/src/Components/<ComponentName>.test.jsx`
- **Pages:** `src/frontend/src/pages/<PageName>.test.jsx`
- **Utilities:** `src/frontend/src/utils/<utilName>.test.js`

### How to Run Tests
Tests are run using `vitest` inside the frontend container.

**All frontend tests:**
```bash
docker exec frontend npm run test
```

**Single test file (recommended for development):**
```bash
docker exec frontend npm run test -- src/pages/GameWaitingRoom.test.jsx
```

**Watch mode (auto-rerun on changes):**
```bash
docker exec frontend npm run test -- --watch src/Components/MyComponent.test.jsx
```

**Coverage report:**
```bash
docker exec frontend npm run test -- --coverage
```

### Writing a Component Test

**Basic component test:**
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

**Component with user interactions:**
```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import MyForm from './MyForm';

describe('MyForm', () => {
  let user;
  
  beforeEach(async () => {
    user = userEvent.setup();  // Fresh user instance per test
  });
  
  it('submits form data', async () => {
    render(<MyForm />);
    
    const input = screen.getByLabelText('Email');
    await user.type(input, 'test@example.com');
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Success/i)).toBeInTheDocument();
    });
  });
});
```

---

## 3. Best Practices

### Backend
1. **Mock Externals:** Always mock database calls and external API requests (use `httpx.AsyncClient` with `ASGITransport` and `unittest.mock`).
2. **Test Isolation:** Ensure tests do not depend on each other's state. Use fixtures to reset state between tests.
3. **Naming:** Use descriptive test names that explain the "what" and "why" (e.g., `test_update_profile_fails_with_invalid_email`).
4. **Coverage:** Aim to cover both "happy paths" and edge cases/error conditions.
5. **Clean Up:** If you create any temporary data in a real DB (rare), ensure it is cleaned up via teardown fixtures.
6. **Async/await:** Always mark async tests with `@pytest.mark.asyncio` (though `asyncio_mode = auto` often handles this).
7. **🚫 NEVER use `TRUNCATE` queries in tests.** Tests share a long-lived database between runs (no per-test reset). `TRUNCATE` would wipe data other tests depend on, breaking the suite. Use these patterns instead:
   - **Rollback isolation** — see `game-service/tests/test_persistence.py:30` (`db` fixture). Wraps each test in a transaction + savepoint that gets rolled back on teardown. Best for unit-level tests of `persistence.py` functions.
   - **High-ID seed pattern** — see `game-service/tests/test_router.py:33` (`client` fixture). Pre-seed test users with high IDs (5001+) that don't collide with prod-like data. Best for HTTP/endpoint tests. When adding new tests, pick fresh IDs that no other test has used (check existing fixture seed list).
   - **Relative assertions** — instead of asserting absolute counts ("user has exactly 1 win"), assert relative ordering ("user X appears before user Y") or use `>=` for accumulated counters. State accumulates across runs, so absolute assertions are flaky.
   - If you find yourself reaching for `TRUNCATE`, your test design is wrong. Refactor to one of the patterns above. If you genuinely need a clean slate, file an issue to discuss adding a test-only DB schema/container — don't `TRUNCATE` shared state.

### Frontend
1. **Mock Modules Early:** Mock external modules (`react-router-dom`, API clients) at the top of the file, before rendering components.
2. **useLocation State:** Mock `useLocation` hook directly for components that need `location.state`—don't rely on MemoryRouter's `initialEntries`.
3. **WebSocket Callbacks:** Wrap WebSocket handler invocations in `act()` and follow with `await waitFor()` for reliable assertions.
4. **User Interactions:** Use `userEvent` instead of `fireEvent` for realistic behavior (respects disabled state, async updates, etc.).
5. **Flexible Selectors:** Find elements by container/card when text is split across multiple elements.
6. **Avoid Fragile Tests:** Don't assert on internal implementation details (e.g., variable names); assert on user-visible behavior.
7. **Normalize Data Types:** When comparing IDs from different sources (string vs number), normalize to the same type.

---

## 4. Advanced Frontend Testing Patterns

### Testing Components with React Router State (useLocation)

When testing components that rely on React Router's `useLocation()` to access navigation state (e.g., `location.state.currentUser`), MemoryRouter's `initialEntries` alone won't pass state through. Instead, mock the hook directly:

```javascript
import { useLocation } from 'react-router-dom'
import { vi } from 'vitest'

// At module level
let mockLocationState = {}

// Mock the entire module
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(() => ({
      pathname: '/current/path',
      state: mockLocationState,  // Will be set by test
      hash: '',
      search: '',
      key: 'default',
    })),
  }
})

// In your test helper
function renderWithRouter(roomId = '123', locationState = {}) {
  mockLocationState = locationState  // Set the state before rendering
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/game/waiting/${roomId}` }]}>
      <Routes>
        <Route path="/game/waiting/:roomId" element={<YourComponent />} />
      </Routes>
    </MemoryRouter>
  )
}
```

**Why this matters:** Hard refresh or direct navigation in tests loses router state. Mocking ensures state is always available to the component.

### Testing WebSocket Handlers with act() and waitFor()

WebSocket callbacks (like `onMessage`) trigger React state updates that won't be observed by vitest unless wrapped in `act()`. Always wrap async callback invocations:

```javascript
import { act, waitFor } from '@testing-library/react'

// ❌ BAD: React state updates aren't tracked
wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })
expect(screen.getByText('Ready')).toBeInTheDocument()  // May fail

// ✅ GOOD: State updates tracked by vitest
act(() => {
  wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })
})
await waitFor(() => {
  expect(screen.getByText('Ready')).toBeInTheDocument()
})
```

**Why this matters:** React state updates in callbacks are microtasks. `act()` ensures vitest observes them. `waitFor()` polls for assertions (with default 1000ms timeout) and handles timing issues.

### userEvent vs fireEvent

Use `userEvent` for more realistic user interactions. It's higher-level and plays well with disabled buttons and async state:

```javascript
import userEvent from '@testing-library/user-event'

// ❌ fireEvent may click disabled buttons or not trigger proper event flow
fireEvent.click(readyButton)

// ✅ userEvent respects disabled state and triggers realistic event chains
const user = userEvent.setup()
await user.click(readyButton)
```

**Setup in beforeEach:**
```javascript
let user

beforeEach(async () => {
  user = userEvent.setup()  // Creates fresh user instance per test
  // ... other setup
})
```

### Finding Elements by Card/Container Pattern

When testing components with nested card structures, avoid fragile assertions on inner text. Instead, find the container and assert on its content:

```javascript
// ❌ FRAGILE: Text may be split across elements
expect(screen.getByText(/You are ready/)).toBeInTheDocument()

// ✅ ROBUST: Find card by distinctive content, then check status
const playerCards = screen.getAllByText(/Player (one|two)/i)
  .map(el => el.closest('article'))
const mariaCard = playerCards.find(card => card?.textContent.includes('maria'))
expect(mariaCard?.textContent).toMatch(/Ready/)  // Passes if "Ready" anywhere in card
```

**Why this matters:** UI text is often split across multiple divs for styling. Searching the entire card container is more resilient to layout changes.

### Mocking fetch() for Hard Refresh Scenarios

Components often fetch data on hard refresh when navigation state is lost. Mock fetch to simulate the `/auth/me` endpoint:

```javascript
global.fetch = vi.fn((url) => {
  if (url.includes('/auth/me')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 4, username: 'joao' })
    })
  }
  return Promise.reject(new Error(`Unknown URL: ${url}`))
})
```

### String vs Number ID Normalization

When backend sends numeric IDs but your state has strings (or vice versa), normalize for comparison:

```javascript
// Component code
const incomingUserId = String(data.user_id ?? '')  // Normalize to string
const currentUserId = String(currentUser.id ?? '')  // Normalize to string

// Test ensures both string and number IDs work
wsConnectHandler.onMessage?.({
  type: 'player_ready',
  user_id: 5,  // Number from backend
})
// Component should still match String(5) === String('5')
```

---

## 5. Health Checks

We also have a global health check script that verifies all services are up and responding:
```bash
make check
```
This script runs `tests/TranscendenceHealthCheck.sh` and saves the report to `release.txt`.

---

## 6. Common Testing Patterns & Recipes

### Backend: Testing Async API Endpoints

**Recipe: POST endpoint that creates a record**
```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_create_game_invite(mock_db_session):
    # Setup: Mock database behavior
    mock_invite = MagicMock(id=1, from_user_id=1, to_user_id=2, status='pending')
    mock_db_session.execute.return_value.scalar.return_value = mock_invite
    
    # Execute: Make request
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/game/invites",
            json={"to_user_id": 2},
            headers={"Authorization": "Bearer test-token"}
        )
    
    # Assert: Check response
    assert response.status_code == 201
    assert response.json()["id"] == 1
```

**Recipe: GET endpoint with authentication**
```python
async def test_list_my_invites_authenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/game/invites",
            headers={"Authorization": "Bearer valid-token"}
        )
        
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_list_my_invites_unauthorized():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/game/invites")
        
    assert response.status_code == 401
```

### Frontend: Testing Components with Complex State

**Recipe: Component with WebSocket **
```javascript
// test_GameWaitingRoom.test.jsx
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

// Mock the WebSocket module
let wsConnectHandler = {}
vi.mock('../utils/wsClient', () => ({
  createWsClient: vi.fn((url, handlers) => {
    wsConnectHandler = handlers
    return {
      send: vi.fn(),
      close: vi.fn(),
    }
  }),
}))

// Mock useLocation to provide navigation state
let mockLocationState = {}
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(() => ({
      pathname: '/game/waiting/123',
      state: mockLocationState,
    })),
  }
})

describe('GameWaitingRoom', () => {
  it('sends ready message when button clicked', async () => {
    const user = userEvent.setup()
    mockLocationState = {
      currentUser: { id: 4, username: 'joao' },
      opponent: { id: 5, username: 'maria' },
    }
    
    const { mockWs, wsConnectHandler } = setupTest()
    
    // Simulate WebSocket connected
    act(() => {
      wsConnectHandler.onOpen?.()
    })
    
    // User clicks ready
    await user.click(screen.getByRole('button', { name: /Ready/i }))
    
    // Verify message sent
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'player_ready' })
    )
  })
  
  it('updates UI when opponent ready message received', async () => {
    setupTest()
    
    // Simulate opponent ready message
    act(() => {
      wsConnectHandler.onMessage?.({
        type: 'player_ready',
        user_id: 5,
        username: 'maria',
      })
    })
    
    // UI should reflect opponent ready
    await waitFor(() => {
      const playerCards = screen.getAllByText(/Player (one|two)/)
        .map(el => el.closest('article'))
      const opponentCard = playerCards.find(card => 
        card?.textContent.includes('maria')
      )
      expect(opponentCard?.textContent).toMatch(/Ready/)
    })
  })
})
```

---

## 7. Troubleshooting & Common Issues

### Backend Issues

**Problem:** `TypeError: object is not subscriptable` when accessing response
```
error ❯ response.json()["key"]
```
**Solution:** Check response status first. Mock API responses might be failing.
```python
# Debug: print the response
print(f"Status: {response.status_code}, Body: {response.text}")
assert response.status_code in [200, 201, 204]
```

**Problem:** `Failed to resolve module specifier '@app'`
**Solution:** Make sure `conftest.py` includes path shims. Check `sys.path.insert(0, ...)` in conftest.

**Problem:** Tests pass locally but fail in Docker
**Solution:** Docker might have different dependencies. Always test inside Docker:
```bash
docker exec user-service pytest tests/test_profile.py -v
```

### Frontend Issues

**Problem:** `Unable to find an element with the text:` assertion times out
**Solution:** Text might be split across elements. Use container pattern:
```javascript
// ❌ Fragile (fails for split text)
expect(screen.getByText(/You are ready/)).toBeInTheDocument()

// ✅ Robust (works even if split across divs)
const cards = screen.getAllByText(/Player/i).map(el => el.closest('article'))
const card = cards.find(c => c?.textContent.includes('Ready'))
expect(card).toBeDefined()
```

**Problem:** WebSocket handler not triggering state update
**Solution:** Wrap handlers in `act()` and use `waitFor()` for assertions:
```javascript
// ❌ State update not tracked
wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })
expect(...).toBeInTheDocument()  // May fail

// ✅ State update properly tracked
act(() => {
  wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })
})
await waitFor(() => {
  expect(...).toBeInTheDocument()
})
```

**Problem:** `Not implemented: navigation` error in jsdom
**Solution:** Mock `window.location` before rendering:
```javascript
beforeEach(() => {
  delete window.location
  window.location = { href: '' }
})
```

**Problem:** Test spy not called when clicking button
**Solution:** Use `userEvent` instead of `fireEvent`, and ensure button is enabled:
```javascript
// ❌ fireEvent ignores disabled state
fireEvent.click(button)

// ✅ userEvent respects disabled state
const user = userEvent.setup()
await user.click(button)  // Waits if button disabled
```

---

## 8. Reference: Test File Locations & Real Examples

### Backend Test Examples
- **User Service:** `src/backend/user-service/tests/`
  - `test_notifications.py` - Test DB notifications
  - `test_ws_push.py` - Test WebSocket message sending
  - `test_*.py` - Various endpoint tests

- **Game Service:** `src/backend/game-service/tests/`
  - `test_ws.py` - WebSocket game logic tests

- **Chat Service:** `src/backend/chat-service/tests/`
  - `test_*.py` - Chat and notification tests

### Frontend Test Examples
- **Components:** `src/frontend/src/Components/*.test.jsx`
  - `GameInviteModal.test.jsx` - Navigation state + mocking
  - `FriendsSidebar.test.jsx` - List rendering + user events
  
- **Pages:** `src/frontend/src/pages/*.test.jsx`
  - `GameWaitingRoom.test.jsx` - WebSocket + Router state (complex example)

---

## 9. CI/CD Integration

Tests run automatically in two ways:

### 1. Local Development
```bash
# Run everything
make check

# Or run specific test suite
docker exec frontend npm run test
docker exec user-service pytest tests/ -v
```

### 2. Docker Build
When running `make` or `make up`, all containers start with tests included.  
Check logs with:
```bash
docker logs frontend    # See frontend test output
docker logs user-service  # See backend test output
```

### 3. GitHub Actions (Future)
Tests can be configured to run on every PR via GitHub Actions workflow (not yet implemented).

---

## 10. Best Practices Summary

| Aspect | Backend | Frontend |
|--------|---------|----------|
| **Mock Externals** | httpx.AsyncClient + ASGITransport | vi.mock() for modules |
| **DB Mocking** | mock_db_session fixture | N/A |
| **Async Handling** | @pytest.mark.asyncio | act() + waitFor() |
| **User Interactions** | TestClient requests | userEvent (not fireEvent) |
| **State Assertions** | Query DB mock | Screen queries + act() |
| **Naming** | `test_endpoint_scenario()` | `test_action_expected_outcome()` |
| **Coverage** | Aim 80%+ | Aim 70%+ |
| **Run All Tests** | `make check` | `make check` |
