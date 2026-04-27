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

The end of `make check` prints a **Test Pyramid Health** summary: mock %, smoke %, pure-logic %, API E2E file count. Aim for **70-80% mock / 10-20% smoke / ≥3 API E2E files**. Anyone running the full suite can see whether we're drifting.

---

## 📋 What to test next — open gaps the team can pick up

A short, prioritized list of concrete tests that would move the pyramid health forward. Pick one, write it, open a PR. Each entry links to the file or feature, names the test layer, and gives a rough effort estimate.

### Highest impact (closes the API E2E gap — currently 1 file, target ≥3)

**1. `tests/api_e2e/test_friend_flow_e2e.py`** — friend request lifecycle
- **Layer:** API E2E
- **Effort:** ~4 hours
- **Journey:** register two users → user A sends friend request to B → B accepts → both see `first_friend` achievement in `/api/game/achievements/{id}` → A removes B → both see updated friend count
- **Why:** exercises user-service `/friends/*` endpoints + cross-service achievement awarding (game-service writes the achievement based on user-service friendship state) + WS notification path
- **Recipe:** copy `test_match_flow_e2e.py` and replace the matches calls with `/api/users/friends/*` calls

**2. `tests/api_e2e/test_chat_flow_e2e.py`** — DM chat between two users
- **Layer:** API E2E
- **Effort:** ~6 hours (involves WebSocket coordination)
- **Journey:** register two users → A sends a DM message via WS → B's WS receives the message → A blocks B → B sends another message → A's WS does NOT receive it
- **Why:** exercises chat-service WS router, persistence (message storage), block enforcement, and DM-room slug generation
- **Recipe:** use `websockets.connect()` from `conftest.py`; capture pre-state of `/api/chat/blocked` before the block and verify state after

**3. `tests/api_e2e/test_tournament_flow_e2e.py`** — tournament creation + bracket advance
- **Layer:** API E2E
- **Effort:** ~6 hours
- **Journey:** register 4 users → user A creates a 4-player tournament → all 4 join → A starts → finish round 1 matches → verify bracket advances to round 2 → finish round 2 → verify a winner is recorded
- **Why:** exercises the most complex single workflow in game-service; covers tournament endpoints + match finish hooks + winner persistence

### Backend (medium priority, fills documented gaps)

**4. `chat-service/tests/test_main.py`** — REST endpoint smoke tests
- **Layer:** Backend smoke (REAL-DB) + a few MOCK
- **Effort:** ~1 day
- **What:** test `/dm/{friend_id}`, `/block/{user_id}`, `/unblock/{user_id}`, `/blocked`, `/rooms`, `/room/{slug}/active`
- **Pattern:** mirror `user-service/tests/test_router.py` — `client` fixture with high-ID seeded users + `auth_client` for authenticated routes

**5. `user-service/tests/test_notification_ws.py`** — WS edge cases
- **Layer:** Backend MOCK (extending existing file)
- **Effort:** ~0.5 day per test, ~2 days total
- **What to add:**
  - `test_notification_handles_concurrent_broadcasts` — two broadcasts in flight simultaneously
  - `test_notification_drops_broadcast_to_offline_user` — user has no active WS → broadcast silently drops
  - `test_notification_keeps_online_with_other_active_tabs` — multi-tab user disconnects one tab → other tab still receives broadcasts

**6. `user-service/tests/test_presence_ws.py`** — WS edge cases
- Same pattern as #5: concurrent disconnects, multi-tab last-disconnect transition, presence transition timing

### Frontend (lower priority, narrower bug surface)

**7. `Components/PongCanvasMultiplayer.test.jsx`** — the hardest single file to test
- **Layer:** MOCK+UI
- **Effort:** ~2 days
- **What:** mock the `WebSocket` constructor + canvas context. Assert on: state-frame handler updates ball/paddle positions, input frames sent on keypress, disconnect handler triggers reconnect attempt
- **Why:** this is the largest untested frontend file and load-bearing for every multiplayer match
- **Hint:** look at `Components/PongCanvas.test.jsx` (single-player) for the canvas-mock pattern

**8. `pages/Home.test.jsx` (extension)** — once issue #229 (Live Match dynamic pill) lands
- **Layer:** MOCK+UI
- **Effort:** ~0.5 day
- **What:** verify the pill is hidden when `/api/games/live` returns `[]`, becomes a clickable Link to the most-spectated game, polls every 10s

### Convention skips (don't write tests for these)
SQLAlchemy models (`models/*.py` — 12 files), tiny components (`AuthLoading.jsx`, `About.jsx`), logger helpers (`wsLogger.js`, `ws_logger.py`), settings loader (`shared/config/settings.py`). See `docs/superpowers/specs/2026-04-26-test-landscape-and-e2e-proposal.md` §3.3 for the full skip list.

---

## 0. Mock tests vs Smoke tests — pick the right tool

Within every layer above (Backend Unit, Frontend Unit, etc.) each individual test falls into one of two broad categories. Knowing which you're writing — and **why** — keeps the suite balanced.

### Mock tests
Run the system under test (SUT) **in isolation**. All its dependencies (DB, network, file I/O, other services, time) are replaced with stand-ins (mocks/stubs/fakes) that return programmable responses.

**How to recognize one in this codebase:**
- Backend (Python/pytest): `MagicMock`, `AsyncMock`, `unittest.mock`, the `mock_db_session` fixture (auto-injected by `conftest.py`), `app.dependency_overrides[get_db] = ...`
- Frontend (Vitest): `vi.mock(...)`, `vi.fn()`, `vi.spyOn(global, 'fetch')`, mocked `useAuth`/`useNotifications` contexts, `MemoryRouter` in place of the real router

**Strengths**
- Fast — no I/O, runs in milliseconds
- Deterministic — no flaky DB/network state
- Hermetic — each test isolated; failures point to one unit
- Cheap to run on every commit/CI iteration

**Weaknesses**
- Tests the contract you *think* a dependency has, not its real behavior. Mock drift is a common bug class (e.g., mock returns a shape that no longer matches the real DB).
- Doesn't catch integration bugs: wrong SQL, wrong serializer, wrong route registration, wrong CORS, wrong WS frame format.
- Encourages over-fitting to implementation details — tests can pass while the user-visible feature is broken.

**Use a mock test when:**
- You're testing branching logic, validation, or pure transformations
- The real dependency is slow, flaky, or has side effects you don't want
- You need to simulate failure modes the real dep makes hard to reproduce (timeout, malformed response, race condition)

### Smoke tests (a.k.a. integration / system / live tests)
Run the SUT against **real dependencies** — real DB, real HTTP transport, real WebSocket connection. Set up just enough state to exercise an end-to-end path within a *single service or a small group of services*.

**How to recognize one in this codebase:**
- Backend: `create_async_engine(...)`, `_TestSession`, `NullPool`, `async with engine.begin()`, real PostgreSQL connection from inside the Docker container
- The `db` fixture in `game-service/tests/test_persistence.py:30` (savepoint-rollback isolation against real DB)
- The `client` fixture in `game-service/tests/test_router.py:33` (real `AsyncClient` hitting a real DB-backed FastAPI app)
- The `tests/TranscendenceHealthCheck.sh` script (cross-service event-driven smoke test through the actual nginx + multiple services)

**Strengths**
- Catches real-world bugs: SQL syntax errors, FK violations, JSON shape mismatches, missing indexes, route typos, CORS misconfig
- Validates the actual ORM/SQL/HTTP/WS contracts — no drift
- High signal: a passing smoke test is strong evidence the feature really works

**Weaknesses**
- Slow (seconds per test, full suite can be minutes)
- Stateful — DB state accumulates across runs (see the no-`TRUNCATE` rule below)
- Order-sensitive — relative-assertion patterns required
- Need real infrastructure (Docker containers, DB) — harder to run from a fresh checkout

**Use a smoke test when:**
- The SQL query, JSON shape, or HTTP route is itself the thing you want to verify
- You're verifying inter-service contracts (e.g., game-service writes to the `notifications` table, user-service reads it)
- You're testing a WebSocket frame format or event sequence
- A passing mock test would still leave you uncertain whether the feature works end-to-end

### Test pyramid — the healthy ratio

A healthy suite is mostly mock (fast, many) with a smaller layer of smoke (slow, focused):

```
        ▲
       ╱ ╲       E2E (browser-driven, full stack)
      ╱   ╲      → small number of golden-path tests
     ╱─────╲
    ╱       ╲    Smoke / Integration (real DB, real HTTP)
   ╱─────────╲   → critical paths per service
  ╱           ╲
 ╱─────────────╲ Mock / Unit (isolated logic)
                 → bulk of the suite, runs on every commit
```

**Default to mock.** Only reach for smoke when a mock test wouldn't tell you what you actually need to know.

### Decision tree — "I just wrote X, what test do I add?"

Use this when adding tests alongside a feature:

```
What did you just write?
│
├── A pure function with no I/O (utilities, formatters, validators, math)
│   └── PURE test (no mocks, no DB, no network)
│       Example: tests/test_order_util.py, utils/jwtUtils.test.js
│
├── A new SQLAlchemy persistence helper (`get_*`, `save_*`, `find_*`)
│   └── REAL-DB test in test_persistence.py using the savepoint `db` fixture
│       Example: game-service/tests/test_persistence.py, chat-service/tests/test_persistence.py
│
├── A new FastAPI REST endpoint
│   ├── If the endpoint just calls a persistence helper (thin layer):
│   │   └── REAL-DB test in test_router.py using the `client` fixture
│   │       Example: game-service/tests/test_router.py
│   └── If the endpoint has branching logic / validation / mocking-friendly deps:
│       └── MOCK test using `mock_db_session` autouse fixture
│           Example: user-service/tests/test_authenticate.py
│
├── A new WebSocket handler / event
│   └── MOCK test using `make_ws()` pattern from shared/ws/tests/test_manager.py
│       Wrap callback invocations in act() for React; use AsyncMock for backend
│
├── A new React component (no fetch, no WS, no router)
│   └── MOCK+UI test rendering with @testing-library/react
│       Example: Components/XpBar.test.jsx, Components/BadgeGrid.test.jsx
│
├── A new React page (uses fetch, useNavigate, contexts)
│   └── MOCK+UI test mocking external modules at the top of the file
│       Mock `useAuth`, `useNotifications`, vi.spyOn(global, 'fetch')
│       Example: pages/Profile.test.jsx, pages/Leaderboard.test.jsx
│
├── A multi-service flow (game finish writes XP, user-service reads it)
│   └── API E2E test in tests/api_e2e/
│       Use register_user(api) helper, capture pre-state, assert on observable side effects
│       Example: tests/api_e2e/test_match_flow_e2e.py
│
└── Everything else (dispatching, registry, hooks, contexts)
    └── MOCK test — start with mocks, escalate to REAL-DB only if a mock would lie
```

**The most common mistake:** writing a MOCK test for SQL-heavy code. If your test is mostly `mock.execute.return_value = ...` and asserts on shape, a real schema change won't break it. Use REAL-DB instead.

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

### Pre-PR test checklist

Before opening a PR, run through this list. It takes ~2 minutes and catches the most common review feedback.

- [ ] **Did I add tests for the new code?** Use the decision tree in §0.
- [ ] **Does my test actually verify the behavior?** A test that asserts on mock-call-counts but never exercises the real code path is a no-op.
- [ ] **Will my test fail if someone deletes my implementation?** TDD-style red→green confirms the test discriminates. (See `test_leaderboard_order_xp_desc_sorts_by_xp` for the canonical example.)
- [ ] **No `TRUNCATE` in any new test.** If you needed to clean up state, refactor to use the high-ID seed pattern or savepoint isolation. See §3 backend rule #7.
- [ ] **High-ID convention respected for new test users.** Pick fresh IDs in your service's range (5001+, 70000+, 80000+, 90000+) that no other test has used. Add them to the `client` fixture seed list if your test creates them.
- [ ] **Relative assertions for accumulated state.** Never assert "user has exactly N wins" — use `>=` or capture pre-state and assert the delta. State accumulates across runs.
- [ ] **`make check` passes locally.** Run the full thing once, not just your new test. The 4 known-flaky tests (Chat History Persistence, Match History) are documented; anything else is on you.
- [ ] **Pyramid health didn't regress.** The summary at the end of `make check` shows mock %, smoke %, API E2E count. If your PR pushed mock % above 90% or removed an API E2E file, justify it in the PR description.
- [ ] **Naming follows convention.** `test_<unit_being_tested>` — file matches the source name when possible (`order.py` → `test_order_util.py`; the `_util` suffix is fine for disambiguation).
- [ ] **Tests are isolated from other tests.** Each test sets up its own data; no `assert previous_test_did_X` patterns.
- [ ] **For frontend: the test file lives next to the source.** `Foo.jsx` → `Foo.test.jsx` in the same directory.

If a checkbox doesn't apply (e.g., you didn't change any behavior, only renamed a CSS class), say so in the PR description.

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

## 5b. API-Level E2E Tests (`tests/api_e2e/`)

This is a layer **between** per-service smoke tests and full browser-driven E2E. The tests run against the **live running stack** through real HTTP/WebSocket — no Python or JS mocks. They drive complete user journeys (register → login → play → verify side effects) and run as part of `make check`.

### When to add an API E2E test (vs the alternatives)

Pick the right layer for what you're testing:

| You want to verify... | Use this layer | Where |
|----------------------|----------------|-------|
| One function's logic in isolation | Mock unit test | `<service>/tests/test_*.py` (MOCK) or vitest test |
| One endpoint's SQL / response shape against real DB | Backend smoke test | `<service>/tests/test_router.py` (REAL-DB) |
| A multi-service flow (game-service writes → user-service reads) | **API E2E** | `tests/api_e2e/` |
| The same flow as a user clicking through the UI | Browser E2E (Playwright) | not yet implemented — see `docs/superpowers/specs/2026-04-26-test-landscape-and-e2e-proposal.md` |

The test pyramid still applies: most of your tests should be MOCK, fewer should be REAL-DB, even fewer should be API E2E. A good rule of thumb: **one API E2E test per major user journey**, not one per endpoint.

### Conventions

Follow these or future tests will collide with each other.

#### 1. Use `register_user(api)` for fresh test users
Don't reuse seeded users (`alice=1`, `bob=2`) or other suite users (5001-5999, 9000+). The helper picks a unique high-ID username per call (`e2e_<ms_timestamp>`):

```python
from conftest import register_user

async def test_my_flow(api):
    alice = await register_user(api)         # {'username': 'e2e_1234567', 'user_id': 60001, 'token': '...', 'password': '...'}
    bob = await register_user(api)           # different user, different id
    # ... use alice['token'] for authenticated requests
```

This avoids cross-test interference: state accumulates in the long-lived database, but each test only touches its own users.

#### 2. Capture pre-state before assertions
Because state accumulates across runs, **never assert absolute counts** ("user has exactly 1 win"). Instead:
- Snapshot the value before the action
- Perform the action
- Assert the **delta** or use `>=`

```python
# ✗ Bad — fails as soon as the test runs twice
assert (await api.get(f"/api/game/xp/{user_id}")).json()["xp"] == 25

# ✓ Good — robust across runs
pre_xp = (await api.get(f"/api/game/xp/{user_id}")).json()["xp"]
# ... finish a match ...
post_xp = (await api.get(f"/api/game/xp/{user_id}")).json()["xp"]
assert post_xp - pre_xp == 25
```

#### 3. Hit the public API only
Tests use `https://nginx` (the public TLS-terminated endpoint), not `http://game-service:8002` directly. This keeps the tests testing the **same stack a user hits**, including nginx routing, TLS, and CORS.

#### 4. Drop the assertion to a relative one when reaching far into shared state
If you must assert against the leaderboard or global stats, page through up to a few pages and find your user. Don't assume you'll be at rank 1.

```python
# Walk pages until we find our test user (or hit last_page)
for page_idx in range(5):
    lb = await api.get(f"/api/game/leaderboard?order=xp:desc&limit=100&page={page_idx}")
    body = lb.json()
    found = next((r for r in body["results"] if r["user_id"] == alice["user_id"]), None)
    if found is not None or page_idx >= body["last_page"]:
        break
assert found is not None
```

### File layout

```
tests/api_e2e/
├── conftest.py            # `api` fixture, register_user/login/whoami_id helpers
├── pytest.ini             # asyncio_mode=auto, terse output
├── requirements.txt       # pytest, pytest-asyncio, httpx, websockets
├── test_match_flow_e2e.py # ← example: 2-tests covering register→match→XP→leaderboard
└── README.md              # how to run + write conventions
```

When adding a new feature:
1. Create `test_<feature>_e2e.py` with one focused user journey
2. Use the `api` fixture and `register_user(api)` helper from `conftest.py`
3. Keep tests under ~50 lines each — if you need more, split into multiple `test_*` functions

### Running

API E2E tests run automatically as part of `make check` (under the "API E2E Tests" suite name). For faster local iteration:

```bash
docker run --rm \
  --network transcendence_network \
  -v "$(pwd)/tests/api_e2e:/work" \
  -w /work \
  python:3.12-slim \
  bash -c "pip install -q -r requirements.txt && pytest"
```

See `tests/api_e2e/README.md` for more.

### Recipe: writing your first API E2E test

The goal is **one test per major user journey**. Here's a fill-in-the-blank skeleton so you don't need to start from scratch:

```python
"""End-to-end test of the <FEATURE> flow."""
import pytest
from conftest import register_user, auth_headers


@pytest.mark.asyncio
async def test_<feature>_<observable_outcome>(api):
    # 1. Set up the test users (use fresh registrations to avoid collisions)
    alice = await register_user(api)
    bob = await register_user(api)

    # 2. Capture pre-state — anything you'll assert on later
    pre_state = await api.get(f"/api/<some-endpoint>/{alice['user_id']}")
    pre_value = pre_state.json().get("<key>", 0)

    # 3. Perform the user-visible action through the public API
    resp = await api.post("/api/<endpoint>", json={...},
                          headers=auth_headers(alice["token"]))
    assert resp.status_code == 200, f"action failed: {resp.text[:200]}"

    # 4. Verify the side effect via a separate endpoint (proves it persisted)
    post_state = await api.get(f"/api/<some-endpoint>/{alice['user_id']}")
    post_value = post_state.json().get("<key>", 0)
    delta = post_value - pre_value
    assert delta == <expected_change>, (
        f"expected <key> to change by <expected_change>, got {delta} "
        f"(pre={pre_value}, post={post_value})"
    )
```

### What journeys are worth a dedicated API E2E?

A test belongs in `tests/api_e2e/` if it satisfies **at least two** of these:

1. **Crosses service boundaries** (game-service writes, user-service reads — or vice versa)
2. **Has observable side effects** that aren't visible from the request itself (achievement unlock, leaderboard rank change, notification fires)
3. **Is part of a documented module** in the project subject (chat, friends, tournaments, leaderboard, gamification, spectator mode)

If a test only exercises one service's endpoints, it's a **backend smoke test** (`<service>/tests/test_router.py`), not an API E2E.

### Concrete journey ideas (open backlog)

These are documented in detail in §"📋 What to test next" near the top of this doc — pick one to grab next:

- **Friend lifecycle E2E** — request → accept → achievement unlock → remove
- **Chat DM with block enforcement** — message → block → blocked message dropped
- **Tournament bracket advance** — create → join → finish round → advance → winner
- **Game invite flow** — invite → notification → accept → game starts → finish → XP awarded

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
