# Admin Dashboard — Date Range Filter + Per-Day Graphs

**Date:** 2026-04-28
**Branch:** `253-module-user-analytics-dashboard`
**Scope:** add a date-range filter (max 30 days back) and per-day graphs for games and messages to the admin dashboard.

## Goals

1. Admin can pick any date range within the last 30 days.
2. The 3 existing aggregate counters (active users / games / messages) reflect the selected range.
3. Per-day "Games" (bar) and "Messages" (line) charts render for the selected range, matching the user dashboard's chart style.

## Backend changes — `src/backend/user-service`

### `schemas.py` — replace `AdminActivityResponse`

```python
class AdminActivityResponse(BaseModel):
    """Site-wide aggregate stats for the admin dashboard."""
    range_start: date
    range_end: date
    active_users: int            # users with last_login_at within [start, end]
    games_total: int             # matches with started_at within [start, end]
    messages_total: int          # messages with created_at within [start, end]
    games_per_day: list[DailyCount]
    messages_per_day: list[DailyCount]
```

This is a breaking change to the response shape. The frontend and tests are updated in lockstep.

### `main.py` — `/admin/activity` endpoint

- Accept `start: date | None = None`, `end: date | None = None` query params.
- Default range when missing: `end = today` (UTC), `start = today - 29` (i.e., last 30 days).
- Validation (400 with detail on failure):
  - `start <= end`
  - `end <= today`
  - `(today - start).days <= 29`  (cap at 30-day window)
- Three queries, all bounded `>= start AND < end + 1 day` (half-open) to handle naive `messages.created_at` and tz-aware `matches.started_at` consistently:
  - `active_users` — `SELECT COUNT(*) FROM users WHERE last_login_at >= :start AND last_login_at < :end_excl`
  - `games_per_day` — `SELECT date_trunc('day', started_at)::date AS d, COUNT(*) FROM matches WHERE started_at >= :start AND started_at < :end_excl GROUP BY d`
  - `messages_per_day` — same pattern against `messages.created_at`
- Fill the day buckets in Python so empty days appear with `count=0`.
- `games_total` / `messages_total` derived as `sum(p.count for p in ...)` — no extra query.

### `tests/test_admin_activity.py`

- Update `test_admin_activity_returns_aggregate_counts` to assert the new shape and that day buckets are emitted (mock the 3 `db.execute` results: scalar for active users, row-list for games per day, row-list for messages per day).
- Add `test_admin_activity_default_range_is_last_30_days` — no query params → response covers exactly 30 days ending today.
- Add `test_admin_activity_rejects_range_over_30_days` — start older than today-29 → 400.
- Add `test_admin_activity_rejects_inverted_range` — start > end → 400.
- Keep the existing 401/403 tests untouched.

## Frontend changes — `src/frontend/src`

### Extract shared chart code → `Components/ActivityCharts.jsx`

The user dashboard already builds these charts inline. Pulling them out is a justified refactor because the new admin dashboard reuses them verbatim.

Exports:
- `GamesPerDayChart({ points })` — bar chart (teal)
- `MessagesPerDayChart({ points })` — line chart (pink)
- `ChartA11yTable({ caption, rows })` — already inlined; move here

Internal helpers stay private: `formatDateLabel`, `baseChartOptions`, the Chart.js registration call.

### `pages/ActivityDashboard.jsx`

- Replace inline chart blocks with `<GamesPerDayChart points={games}/>` and `<MessagesPerDayChart points={messages}/>`.
- Drop the now-unused chart helpers and chart.js imports from this file.

### `pages/Admin.jsx`

- Add `start` / `end` state, defaulting to (today-29, today) in UTC.
- UI: two `<input type="date">` controls + a "Reset" button restoring the default range. Both inputs constrained with `min={today-29}` / `max={today}`.
- On any range change: abort the in-flight request, refetch immediately. Polling continues at 5 s on the current range.
- Send `?start=YYYY-MM-DD&end=YYYY-MM-DD` to `/api/users/admin/activity`.
- Stat cards: switch to "Active users", "Games", "Messages" (drop the "today"/"7 days" suffixes since they're now range-relative). Add a small caption showing the active range.
- Below the cards, render `<GamesPerDayChart points={stats.games_per_day}/>` and `<MessagesPerDayChart points={stats.messages_per_day}/>` in the same panel layout as `ActivityDashboard`.

## Out of scope

- Filter presets ("Last 7d", "This week"). Easy to add later if needed.
- Backfilling historical `messages.user_id` (already discussed earlier — the per-user dashboard fix only attributes new messages).
- Tracking active *distinct* users via a sessions/login-events table — we keep using `last_login_at` for now.
- Admin-only mutating actions (e.g., banning a user) — not in this task.

## Acceptance check

1. Open `/admin` as an admin user. Default view shows "last 30 days" with two charts populated.
2. Change start to today; both totals and charts collapse to today's data only.
3. Try start older than today-29 (via dev tools or curl) → backend responds 400.
4. With a friend chatting, send a message; within 5 s the message bar bumps for today.
