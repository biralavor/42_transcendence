# Milestones — ft_transcendence

> 10 sprints · Feb 21 – May 1 2026 · 5 milestones (every 2 sprints)
>
> **Note:** AI opponent is delivered in Milestone 3 (moved up from M4 to keep gameplay features together).

---

## Overview

| Milestone | Sprints | Target date | Theme |
|-----------|---------|-------------|-------|
| M1 | 1–2 | ~Mar 7 | Foundation |
| M2 | 3–4 | ~Mar 21 | Core Gameplay |
| M3 | 5–6 | ~Apr 4 | Real-time + AI |
| M4 | 7–8 | ~Apr 18 | Platform Features |
| M5 | 9–10 | ~May 1 | Polish + Evaluation |

---

## Milestone 1 — Foundation `Sprint 1–2`

**Theme:** Infrastructure, auth, and project skeleton.

| Feature | Service | Status |
|---------|---------|--------|
| Docker Compose + 3 microservices | DevOps | ✅ Done |
| TLS nginx reverse proxy | DevOps | ✅ Done |
| JWT authentication (register / login) | user-service | ✅ Done |
| Database schema (users, games, chat) | db | ✅ Done |
| React + Vite frontend scaffold | frontend | ✅ Done  |
| Privacy Policy + Terms of Service pages | frontend | ⬜ Todo |
| Health check endpoints (all services) | DevOps | ✅ Done |

> ⚠️ **Privacy Policy and Terms of Service are mandatory** (subject §III.2). Missing or empty pages = project rejection.

### Database schema
> Foundation for everything — do first.

1. Users table: `id`, `email`, `password_hash`, `username`, `avatar_url`, `created_at`
2. Chat rooms table: `id`, `name`, `created_at`
3. Messages table: `id`, `room_id`, `sender_id`, `content`, `created_at`
4. Games table: `id`, `player1_id`, `player2_id`, `winner_id`, `score`, `created_at`
5. Alembic migrations for all services (user, game, chat)

### React + Vite frontend scaffold
> Parallel to DB schema — both can be done at the same time.

1. React Router setup (SPA: `Back`/`Forward` buttons must work)
2. CSS framework integration (Bootstrap or Tailwind — pick one, document it)
3. Shared layout: Navbar + Footer components
4. Login page (form + frontend validation)
5. Register page (form + frontend validation)
6. 404 / fallback page

### Privacy Policy + Terms of Service
> Simple pages, mandatory — unblock early so they're never forgotten.

1. `/privacy` route with real content (data collected, storage, usage)
2. `/terms` route with real content (rules, acceptable use)
3. Link both in Footer (visible from every page)

### JWT Authentication
> Depends on DB schema and frontend scaffold.

1. Backend: `POST /api/users/register` — validate input, hash+salt password (bcrypt), store user
2. Backend: `POST /api/users/login` — verify credentials, return JWT
3. Frontend: call register/login endpoints, store JWT (secure, not plain localStorage)
4. JWT middleware protecting all non-public routes
5. Frontend input validation: required fields, email format, password min length

**Exit criteria:** `make` starts all containers, health check passes, user can register and log in. Privacy Policy and Terms of Service pages exist with real content.

---

## Milestone 2 — Core Gameplay `Sprint 3–4`

**Theme:** Playable Pong game + user profiles + WebSocket foundation.

| Feature | Service | Module |
|---------|---------|--------|
| Local Pong game (keyboard, 2 players) | game-service + frontend | Major Gaming |
| WebSocket infrastructure | chat-service + game-service | Major Web |
| User profile (view + edit) | user-service + frontend | Major UserMgmt |
| Basic chat (send/receive messages) | chat-service | Major Web |
| Game statistics stored per match | game-service + db | Minor UserMgmt |

### Local Pong Game
- The game can be real-time multiplayer (e.g., Pong, Chess, Tic-Tac-Toe, Card games, etc.).
- Players must be able to play live matches.
- The game must have clear rules and win/loss conditions.
- The game can be 2D or 3D.

### Websocket infrastructure
- Real-time updates across clients.
- Handle connection/disconnection gracefully.
- Efficient message broadcasting.

### User profile
1. View profile information (username, avatar).
2. Edit profile information (username, avatar).
3. Store user preferences.

### Basic chat
> Build sequence is deliberate: real-time messaging first validates the full WebSocket stack end-to-end before adding persistence, then identity and social graph on top of a proven foundation.

1. Send and receive messages in real-time.
2. Store chat history in the database.
3. A profile system (view user information).
4. A friends system (add/remove friends, see friends list).

### Game statistics
1. Track user game statistics (wins, losses, ranking, level, etc.).
2. Display match history (1v1 games, dates, results, opponents).
3. Leaderboard integration.
4. Show achievements and progression.

**Exit criteria:** Two people can play Pong on the same keyboard. Chat sends messages. Profiles visible.

---

## Milestone 3 — Tournaments + AI `Sprint 5–6`

**Theme:** AI opponent, remote multiplayer, full chat, and tournaments.

| Feature | Service | Module |
|---------|---------|--------|
| Friends list + online status | user-service | Major Web |
| Real-time chat enhancements | chat-service | Major Web |
| Tournament system + matchmaking | game-service + frontend | Minor Gaming |
| Remote players (WebSocket game) | game-service | Major Gaming |
| AI opponent (vs CPU) | game-service | **Major AI** |

> **Why AI in M3?** The AI opponent depends only on the game engine (delivered M2). Grouping it with remote players and tournaments keeps all gameplay enhancement features in one milestone and leaves M4 free for platform-level features.

### Friends list + online status
> Simpler backend, no game dependency — do first.

1. `POST /api/users/friends/request` — send friend request
2. `GET/PUT /api/users/friends/requests` — list + accept/decline incoming requests
3. `GET /api/users/friends` — list friends
4. `DELETE /api/users/friends/{id}` — remove friend
5. Frontend: Friends page (list, pending requests, add by username)
6. WebSocket presence: broadcast online/offline events on connect/disconnect
7. Show online status dot in friends list

### Real-time chat enhancements
> Extends M2 basic chat — needs friends to be done first for DMs.

1. Direct messages between friends (1-on-1 rooms)
2. Online status indicator next to usernames in chat
3. Click username in chat → view their profile (satisfies M2 item 3 too)
4. Block users: `POST /api/chat/block/{user_id}` — blocked users cannot send you messages
5. Typing indicator (emit `typing` event, show "User is typing...")
6. Game/tournament invite notification in chat (wire up in M3 after remote players done)

### Tournament system
> Depends on local Pong (M2). No network game required yet.

1. Tournament creation: name, max participants (4 or 8)
2. Player registration / join tournament
3. Bracket generation (single elimination, auto-seeded)
4. Record match result → advance winner in bracket
5. Tournament standings page (bracket visualization)
6. Matchmaking: auto-assign next match when both players are ready

### Remote players
> Depends on local game engine (M2) and WebSocket infrastructure (M2).

1. Game invite flow: Player A invites Player B (via friend list or chat)
2. Waiting room: both players confirm ready
3. Server-authoritative game state (game loop on backend, state pushed to both clients)
4. Handle network latency (timestamp-based sync or client-side prediction)
5. Graceful disconnect: pause game, wait N seconds for reconnect
6. Reconnection logic: rejoin in-progress game if reconnected within timeout
7. Game over screen with result for both players

### AI opponent
> Most complex — depends on full game engine and customization hooks. Do last.

1. Define AI behavior model (rule-based: predict ball trajectory, move paddle)
2. Add imperfection: occasional missed shots, reaction delay (simulate human)
3. Difficulty levels: easy (more misses), medium, hard (less delay, fewer misses)
4. AI respects game customization options (ball speed, power-ups) if implemented
5. AI can win occasionally — test and tune win rate
6. Solo play mode: select "vs CPU" from game menu

**Exit criteria:** Player can start a game vs AI, invite a remote player, and join a tournament. Chat persists history, friends list shows online status.

---

## Milestone 4 — Platform Features `Sprint 7–8`

**Theme:** Enriching the platform — search, uploads, notifications, and game extras.

| Feature | Service | Module |
|---------|---------|--------|
| File upload & management (avatars) | user-service | Minor Web |
| Notification system | frontend + backend | Minor Web |
| Advanced search (users, games) | user-service + game-service | Minor Web |
| Spectator mode (watch live games) | game-service + frontend | Minor Gaming |
| Game customization (skins, themes) | game-service + frontend | Minor Gaming |
| Gamification (rewards, badges) | game-service + user-service | Minor Gaming |

### File upload & management
> Enables avatars — unblocks full user profile completeness. Do first.

1. Backend: `POST /api/users/avatar` — accept image, validate type (jpg/png/webp) and size (max 2MB)
2. Secure storage: save to Docker volume, serve via nginx with access control
3. Only the owner can replace or delete their avatar
4. Frontend: file picker + preview before saving, progress indicator during upload
5. `DELETE /api/users/avatar` — reset to default avatar
6. Default avatar assigned on register (fallback image)

### Notification system
> Depends on friends (M3) and game invites (M3) — wire all events together.

1. DB: `notifications(id, user_id, type, message, read, created_at)`
2. Emit notification on: friend request received/accepted, game invite, tournament match scheduled, match result
3. Real-time delivery via WebSocket push to recipient's connection
4. Navbar: notification bell with unread count badge
5. Dropdown: last 10 notifications
6. `PUT /api/notifications/{id}/read` + mark-all-read
7. Notification history page

### Advanced search
> No hard dependency — can run in parallel with notifications.

1. `GET /api/users/search?q=&page=&sort=` — search users by username with pagination
2. `GET /api/games/search?player=&date_from=&date_to=&result=` — filter match history
3. Sorting options: by date, username, result
4. Frontend: search bar in Navbar (users) + filter controls in match history page
5. Paginated results (previous / next)

### Spectator mode
> Depends on remote game WebSocket (M3). Simple read-only view.

1. `GET /api/games/live` — list games currently in progress
2. Spectator joins game's WebSocket room (read-only — no game inputs accepted from spectator)
3. Receives same real-time game state broadcast as players
4. Live games list page with "Watch" button
5. Spectator count shown to players
6. Optional: spectator-only chat channel in the game view

### Game customization
> Depends on game engine (M2). Applies to local, remote, and AI games.

1. Define options: paddle color, ball speed multiplier, map theme (default always available)
2. DB: `user_game_preferences(user_id, paddle_color, ball_speed, theme)`
3. `GET/PUT /api/users/game-preferences`
4. Frontend: customization settings page in user profile
5. Apply preferences in game engine at game start
6. AI opponent uses same customization options when applicable

### Gamification
> Most complex — depends on game stats (M2) and match history. Do last.

1. DB: `achievements(id, key, name, description, icon)`, `user_achievements(user_id, achievement_id, earned_at)`, `user_xp(user_id, xp, level)`
2. XP/level system: earn XP on game events (win=50, loss=10, tournament win=100)
3. At least 3 achievements: First Win, 10 Wins, Tournament Champion, Add 5 Friends
4. Unlock logic: evaluate conditions after each relevant event
5. Leaderboard page: global ranking by XP or wins
6. Frontend: XP progress bar + badge display on profile, toast notification on achievement unlock

**Exit criteria:** Users can search, upload avatars, receive notifications, choose game skins, watch live games, and earn badges.

---

## Milestone 5 — Polish + Evaluation `Sprint 9–10`

**Theme:** Security, compatibility, analytics, data, and final readiness.

| Feature | Service | Module |
|---------|---------|--------|
| Browser compatibility (Chrome + secondary) | frontend | Minor Accessibility |
| Data export / import | user-service | Minor DataAnalytics |
| Match history + stats dashboard | frontend | Minor UserMgmt |
| User activity analytics dashboard | frontend | Minor UserMgmt |
| Security audit (TLS, hashing, input validation) | all | — |
| Final documentation pass | all | — |
| Evaluation dry run | all | — |

### Browser compatibility
> No code dependency — start immediately, run in parallel with other tasks.

1. Test all pages and flows in Firefox
2. Test all pages and flows in Safari (or Edge as alternative)
3. Fix browser-specific CSS issues (flexbox quirks, scrollbar styling, etc.)
4. Test WebSocket behavior in each browser (reconnect, error handling)
5. Verify no `console.error` or `console.warn` in any browser (mandatory: subject §III.2)
6. Document any known browser-specific limitations in README

### Data export / import
> Simple standalone feature — no dependencies on complex M4 features.

1. `GET /api/users/export` — export own profile data as JSON (username, email, avatar, created_at)
2. `GET /api/games/export?format=csv` — export personal match history as CSV
3. `POST /api/users/import` — import user data with validation (reject malformed or conflicting records)
4. Bulk export: all owned data in one ZIP (profile + match history + chat history)
5. Frontend: "Export my data" and "Import data" buttons on profile/settings page

### Match history + stats dashboard
> Extends game statistics from M2 — now presented as a full dashboard.

1. Match history page: list all games (date, opponent, score, result), sortable and filterable
2. Personal stats panel: total games, win/loss ratio, current rank, current level
3. Win rate over time chart (line chart per week/month)
4. Head-to-head stats against specific opponents
5. Achievements showcase section on profile page
6. Leaderboard page (global, links from profile)

### User activity analytics dashboard
> Depends on activity tracking being wired into auth and game events.

1. Track activity events: login timestamps, games played count, messages sent count
2. `GET /api/users/activity` — return aggregated stats for the logged-in user
3. Frontend: activity dashboard page
   - Games played per day (bar chart)
   - Messages sent over time (line chart)
   - Last login + active streak
4. Admin view (optional): aggregate stats across all users

### Security audit
> Cross-cutting — review everything before evaluation.

1. Audit all forms: required fields, email format, password strength (frontend + backend)
2. Verify password hashing: bcrypt + salt, minimum cost factor 10
3. SQL injection: confirm all queries go through ORM (no raw string interpolation)
4. XSS: no `dangerouslySetInnerHTML`, no unescaped user content in DOM
5. Auth: all non-public API routes require valid JWT; verify 401 on missing/invalid token
6. HTTPS: confirm no HTTP fallback in nginx config; all service-to-service calls use HTTPS or internal network
7. Secrets: confirm `.env` is in `.gitignore` and no credentials in git history
8. Remove all `console.log` / debug output from production code

### Final documentation pass
> After code is stable — last thing before dry run.

1. Privacy Policy page: complete, real content, accessible from footer
2. Terms of Service page: complete, real content, accessible from footer
3. README.md: roles, module list, quick-start (`make`), team members
4. Wiki: update status of all milestone items
5. Git history: meaningful commits from all team members

### Evaluation dry run
> Simulate an evaluation

1. `make` from a clean clone — verify single command starts everything
2. Register + login as a new user
3. Play a local Pong game to completion
4. Start a game vs AI
5. Play a remote game between two browsers
6. Create and run a tournament
7. Send chat messages, check history persists after refresh
8. Test disconnect/reconnect: close browser mid-game — game must not crash
9. Test simultaneous users: two browsers logged in at the same time
10. Demo all claimed modules — have an explanation ready for each

**Exit criteria:** Full evaluation checklist passes. No crashes on disconnect/lag. No browser console errors. Security check clean. All team members can explain every module.

---

## Module Points Summary

| Category | Module | Points | Ready |
|----------|---------|--------|-------|
| Major Web | Real-Time Features | 2 | ✅ |
| Major Web | User Interaction | 2 | ✅ |
| Minor Web | Frontend Framework | 1 | ✅ |
| Minor Web | Backend Framework | 1 | ✅ |
| Minor Web | ORM | 1 | ✅ |
| Minor Web | Search | 1 | ❌ |
| Minor Web | Upload | 1 | ❌ |
| Minor Web | Notifications | 1 | ❌ |
| Minor Accessibility | Browser Compat. | 1 | ❌ |
| Major UserMgmt | Standard Auth | 2 | ❌ |
| Minor UserMgmt | Stats | 1 | ❌ |
| Minor UserMgmt | Activity Analytics | 1 | ❌ |
| Major AI | AI Opponent | 2 | ❌ |
| Major Gaming & UX | Web-Based Game | 2 | ✅ |
| Major Gaming & UX | Remote Players | 2 | ❌ |
| Minor Gaming | Tournament | 1 | ❌ |
| Minor Gaming | Customization | 1 | ❌ |
| Minor Gaming | Gamification | 1 | ❌ |
| Minor Gaming | Spectator | 1 | ❌ |
| Major DevOps | Microservices | 2 | ✅ |
| Minor DataAnalytics (Export/Import) | 1 | ❌ |
| **Total** | - | **28** | 25% (7/28) |

> Minimum required: **14 points**. Target: **16–18 points**. This plan targets **28** — buffer for anything that doesn't fully pass evaluation.
