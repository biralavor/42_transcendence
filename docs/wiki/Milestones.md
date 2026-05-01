# Milestones — ft_transcendence

> 10 sprints · Feb 21 – May 1 2026 · 5 milestones (every 2 sprints)
>
> **Status as of 2026-05-01 (end of Sprint 10).** Module selection (per `CLAUDE.md`):
> Major Web (Real-Time Features, User Interaction) · Minor Web (Frontend Framework, Backend Framework, ORM, Notifications, Advanced Search, File Upload) ·
> Minor Accessibility (Browser Compatibility, Additional Browser Support) ·
> Major UserMgmt (Standard Auth) · Minor UserMgmt (Game Stats & Match History, Activity Analytics Dashboard) ·
> Major AI (AI Opponent) · Major Gaming (Pong, Remote Players) ·
> Minor Gaming (Tournament, Customization, Gamification, Spectator) ·
> Major DevOps (Microservices) · Minor DataAnalytics (Data Export/Import).

---

## Overview

| Milestone | Sprints | Target date | Theme | Status |
|-----------|---------|-------------|-------|--------|
| M1 | 1–2 | ~Mar 7 | Foundation | Done with deviations |
| M2 | 3–4 | ~Mar 21 | Core Gameplay | Done |
| M3 | 5–6 | ~Apr 4 | Real-time + AI + Tournaments | Done |
| M4 | 7–8 | ~Apr 18 | Platform Features | Done |
| M5 | 9–10 | ~May 1 (today) | Polish + Evaluation | In progress — deviations |

---

## Milestone 1 — Foundation `Sprint 1–2`

**Theme:** Infrastructure, auth, and project skeleton.

| Feature | Service | Status | Evidence |
|---------|---------|--------|----------|
| Docker Compose + 3 microservices | DevOps | Done | `docker-compose.yml`, `services/{user,game,chat}-service/` |
| TLS nginx reverse proxy | DevOps | Done | `services/nginx/nginx.conf.template` |
| JWT authentication (register / login / refresh) | user-service | Done | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `GET /auth/me` |
| Database schema (users, games, tournaments, chat) | db | Done | per-service `models/` + Alembic histories |
| React + Vite frontend scaffold | frontend | Done | `src/frontend/` + React Router in `App.jsx` |
| Privacy Policy page (`/privacy`) | frontend | **Not shipped** | Only checkbox label in `RegisterForm.jsx` — no route, no page |
| Terms of Service page (`/terms`) | frontend | **Not shipped** | Only checkbox label in `RegisterForm.jsx` — no route, no page |
| Health check endpoints | DevOps | Done | `GET /health` on each service |
| Forgot-password flow | user-service + frontend | **Partial** | Frontend page `ForgotPassword.jsx` exists; no backend reset endpoint found |

> **Risk for evaluation (subject §III.2):** Privacy Policy and Terms of Service pages are mandatory. The current build only requires acceptance via checkboxes in the register form, but no actual pages exist at `/privacy` and `/terms`. **Action required before defence.**

**Exit criteria:** `make` boots the stack, health checks pass, register/login works. **Met**, except for the Privacy/ToS pages noted above.

---

## Milestone 2 — Core Gameplay `Sprint 3–4`

**Theme:** Playable Pong, profiles, WebSocket foundation.

| Feature | Service | Module | Status | Evidence |
|---------|---------|--------|--------|----------|
| Local Pong (keyboard, 2 players) | game-service + frontend | Major Gaming (Pong) | Done | `game/pongEngine.js`, `Components/PongCanvas.jsx`, `pages/Play.jsx` |
| WebSocket infrastructure (shared) | shared | Major Web (Real-Time) | Done | `shared/ws/`, ConnectionManager + tests |
| User profile (view + edit) | user-service + frontend | Major UserMgmt (Standard Auth) | Done | `GET/PUT /profile/{user_id}`, `pages/Profile.jsx` |
| Basic chat (rooms, send/receive) | chat-service | Major Web (User Interaction) | Done | `POST/GET /rooms`, WS chat router, `pages/Chat.jsx` |
| Game stats persisted per match | game-service + db | Minor UserMgmt (Game Stats) | Done | `POST /matches`, `GET /matches/history`, `GET /stats/{user_id}` |

**Exit criteria:** Two people can play Pong on one keyboard. Chat sends/receives. Profiles visible. **All met.**

---

## Milestone 3 — Real-time + AI + Tournaments `Sprint 5–6`

**Theme:** AI, remote multiplayer, full chat, tournaments.

| Feature | Service | Module | Status | Evidence |
|---------|---------|--------|--------|----------|
| Friends list + online status | user-service | Major Web (User Interaction) | Done | `/friends/me`, `/friends/me/requests`, presence WS |
| Direct messages between users | chat-service | Major Web (User Interaction) | Done | `POST /dm/{friend_id}` |
| Block users | chat-service | Major Web (User Interaction) | Done | `POST/DELETE /block/{user_id}`, `GET /blocked` |
| Tournament system + matchmaking | game-service + frontend | Minor Gaming (Tournament) | Done | `/tournaments`, `/tournaments/{id}/{join,start,leave,withdraw}`, `pages/Tournament.jsx` |
| Remote players (WS game) | game-service | Major Gaming (Remote) | Done | `ws/router.py` game session, `PongCanvasMultiplayer.jsx`, `GameWaitingRoom.jsx` |
| AI opponent (vs CPU) | game-service | Major AI (AI Opponent) | Done | `ai.py` (predict_intercept_y, update_ai_paddle), `POST /ws/ai`, `Components/VsCpuCard.jsx` |

**Notes from late-sprint fixes:**
- Tournament concurrent walkover and ready-timeout race conditions fixed (PRs around #352, #354).
- Non-host paddle freeze in tournament matches fixed (#341/#342).

**Exit criteria:** Player can play vs AI, invite a remote player, and join a tournament; chat persists; presence works. **All met.**

---

## Milestone 4 — Platform Features `Sprint 7–8`

**Theme:** Platform extras — uploads, search, notifications, spectator, customization, gamification.

| Feature | Service | Module | Status | Evidence |
|---------|---------|--------|--------|----------|
| File upload (avatars) | user-service | Minor Web (Upload) | Done | `POST/DELETE /avatar`, `avatars_data` Docker volume, `avatar.py` |
| Notification system | user-service + frontend | Minor Web (Notifications) | Done | `GET /notifications`, read/read-all/delete endpoints, `Components/NotificationPanel.jsx` |
| Advanced search (users + matches) | user-service + game-service | Minor Web (Advanced Search) | Done | `GET /search` (users), `GET /matches/history` with filters, `pages/Search.jsx`, navbar magnifier (PR #345) |
| Spectator mode (live games) | game-service + frontend | Minor Gaming (Spectator) | Done | `GET /games/live`, `spectator_count` in WS state, `pages/GamesLive.jsx` (PRs #349, #350) |
| Game customization (themes) | frontend | Minor Gaming (Customization) | Done | `pongRenderer.js`, `themeLoader.js`; 4 themes in `public/themes/` (neon-pong, neon-central-paddle, neon-two-paddle, wood) |
| Gamification (XP, badges, achievements) | user-service + game-service | Minor Gaming (Gamification) | Done | `GET /achievements/{id}`, `/xp/{id}`, `/xp-leaderboard`, `XpBar.jsx`, `BadgeGrid.jsx`, `AchievementToast.jsx` |
| Game invites integrated with notifications | user/game | — | Done | `POST /game-invites`, `POST /game-invite/response`, `GameInviteModal.jsx` |

**Exit criteria:** Users can search, upload avatars, get notifications, pick themes, watch live games, and earn badges. **All met.**

---

## Milestone 5 — Polish + Evaluation `Sprint 9–10` *(current)*

**Theme:** Analytics, security, compatibility, data, evaluation readiness.

| Feature | Service | Module | Status | Evidence |
|---------|---------|--------|--------|----------|
| Match history + stats dashboard | frontend | Minor UserMgmt (Game Stats) | Done | `pages/Profile.jsx`, `pages/Leaderboard.jsx`, `Components/XpBar.jsx`, `BadgeGrid.jsx` |
| User activity analytics dashboard | user-service + frontend | Minor UserMgmt (Activity Analytics) | Done | `GET /activity`, `Components/ActivityCharts.jsx`, `pages/ActivityDashboard.jsx` |
| Admin aggregate-stats view | user-service + frontend | Minor UserMgmt (Activity Analytics) | Done | `GET /admin/activity`, `pages/Admin.jsx` (PRs #340, #354 for filters/graphs) |
| Browser compatibility (Chrome + 2nd browser) | frontend | Minor Accessibility | **Not verified** | No documented browser-compatibility test pass; no module doc note recording results |
| Data export / import | user-service | Minor DataAnalytics | **Not shipped** | No `/export` or `/import` endpoint found in any service; no frontend export UI |
| Security audit | all | — | Partial | bcrypt + JWT + nginx TLS in place; ~80 `console.*` calls still in non-test frontend code |
| Final documentation pass | docs | — | In progress | Wiki pages (Home, Milestones, Evaluation-Guide, Troubleshooting) being refreshed; module docs exist for all 17 |
| Test coverage (unit + e2e) | all | — | Done | Backend pytest + `tests/api_e2e/`; frontend Vitest tests; `tests/TranscendenceHealthCheck.sh`; PRs #338, #339 |
| Evaluation dry run | all | — | **Not started** | Plan is here, nothing run yet |

### Outstanding items before defence

1. **Privacy Policy + Terms of Service pages** — required by subject §III.2. Currently only checkbox labels in the register form. Add `/privacy` and `/terms` routes with real content and link them in the Footer.
2. **Data export/import (Minor DataAnalytics)** — counted in the module list but not implemented. Either ship it (`GET /api/users/export`, `POST /api/users/import`, plus CSV match history) or drop the module from the scoring.
3. **Browser compatibility (Minor Accessibility — Browser Compat + Additional Browser Support)** — no recorded pass on a second browser. Need a manual run on Firefox (or Safari/Edge), confirming no `console.error`/`console.warn`, and document the result.
4. **Console-output cleanup** — ~80 `console.log/warn/error` calls remain in non-test frontend code. Subject §III.2 forbids visible console errors/warnings; remove or gate behind dev-only logger.
5. **Forgot-password backend** — frontend page exists, no backend endpoint. Either wire it up or hide the link.
6. **Evaluation dry run** — full checklist (clean clone → `make` → register → local Pong → vs AI → remote game → tournament → disconnect/reconnect → two browsers).

---

## Module Points Summary (selected modules only)

| Category | Module | Points | Shipped |
|----------|---------|--------|---------|
| Major Web | Real-Time Features (WebSockets) | 2 | Yes |
| Major Web | User Interaction (Chat + Profile + Friends) | 2 | Yes |
| Minor Web | Frontend Framework | 1 | Yes |
| Minor Web | Backend Framework | 1 | Yes |
| Minor Web | ORM | 1 | Yes |
| Minor Web | Notification System | 1 | Yes |
| Minor Web | Advanced Search | 1 | Yes |
| Minor Web | File Upload & Management | 1 | Yes |
| Minor Accessibility | Browser Compatibility | 1 | Not verified |
| Minor Accessibility | Additional Browser Support | 1 | Not verified |
| Major UserMgmt | Standard User Management & Auth | 2 | Yes |
| Minor UserMgmt | Game Statistics & Match History | 1 | Yes |
| Minor UserMgmt | User Activity Analytics Dashboard | 1 | Yes |
| Major AI | AI Opponent | 2 | Yes |
| Major Gaming | Web-Based Pong | 2 | Yes |
| Major Gaming | Remote Players | 2 | Yes |
| Minor Gaming | Tournament System | 1 | Yes |
| Minor Gaming | Game Customization | 1 | Yes |
| Minor Gaming | Gamification | 1 | Yes |
| Minor Gaming | Spectator Mode | 1 | Yes |
| Major DevOps | Backend as Microservices | 2 | Yes |
| Minor DataAnalytics | Data Export / Import | 1 | **Not shipped** |
| **Total selected** | | **28** | **24 confirmed shipped, 3 at risk (browser ×2, export/import)** |

> Minimum required: **14 points**. Even with the 3 at-risk modules dropped, confirmed-shipped score is **25** (24 listed + the 1 confirmed Browser Compat once a manual pass is run). Comfortable buffer above the 14-point minimum.
