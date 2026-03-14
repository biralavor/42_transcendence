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
| Database schema (users, games, chat) | db | ⬜ In progress |
| React + Vite frontend scaffold | frontend | ⬜ In progress |
| Health check endpoints (all services) | DevOps | ✅ Done |

**Exit criteria:** `make` starts all containers, health check passes, user can register and log in.

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
- View and edit profile information (username, avatar).
- Store user preferences.

### Basic chat
- Send and receive messages in real-time.
- Store chat history in the database.
- A profile system (view user information).
- A friends system (add/remove friends, see friends list).

### Game statistics
- Track user game statistics (wins, losses, ranking, level, etc.).
- Display match history (1v1 games, dates, results, opponents).
- Show achievements and progression.
- Leaderboard integration.

**Exit criteria:** Two people can play Pong on the same keyboard. Chat sends messages. Profiles visible.

---

## Milestone 3 — Real-time + AI `Sprint 5–6`

**Theme:** AI opponent, remote multiplayer, full chat, and tournaments. ← *AI moved here from M4*

| Feature | Service | Module |
|---------|---------|--------|
| AI opponent (vs CPU) | game-service | **Major AI** |
| Remote players (WebSocket game) | game-service | Major Gaming |
| Tournament system + matchmaking | game-service + frontend | Minor Gaming |
| Real-time chat (full: rooms, history) | chat-service | Major Web |
| Friends list + online status | user-service | Major Web |

**Exit criteria:** Player can start a game vs AI, invite a remote player, and join a tournament. Chat persists history.

> **Why AI in M3?** The AI opponent depends only on the game engine (delivered M2). Grouping it with
> remote players and tournaments keeps all gameplay enhancement features in one milestone and
> leaves M4 free for platform-level features.

---

## Milestone 4 — Platform Features `Sprint 7–8`

**Theme:** Enriching the platform — search, uploads, notifications, and game extras.

| Feature | Service | Module |
|---------|---------|--------|
| Advanced search (users, games) | user-service + game-service | Minor Web |
| File upload & management (avatars) | user-service | Minor Web |
| Notification system | frontend + backend | Minor Web |
| Game customization (skins, themes) | game-service + frontend | Minor Gaming |
| Gamification (rewards, badges) | game-service + user-service | Minor Gaming |
| Spectator mode (watch live games) | game-service + frontend | Minor Gaming |

**Exit criteria:** Users can search, upload avatars, receive notifications, choose game skins, and earn badges.

---

## Milestone 5 — Polish + Evaluation `Sprint 9–10`

**Theme:** Security, compatibility, analytics, data, and final readiness.

| Feature | Service | Module |
|---------|---------|--------|
| Browser compatibility (Chrome + secondary) | frontend | Minor Accessibility |
| Security audit (TLS, hashing, input validation) | all | Major Cybersecurity |
| Match history + stats dashboard | frontend | Minor UserMgmt |
| User activity analytics dashboard | frontend | Minor UserMgmt |
| Data export / import | user-service | Minor DataAnalytics |
| Final documentation pass | all | — |
| Evaluation dry run | all | — |

**Exit criteria:** Full evaluation checklist passes. No crashes on disconnect/lag. Security check clean.

---

## Module Points Summary

| Category | Modules | Points |
|----------|---------|--------|
| Major Web (WebSockets + Chat + Profiles) | 3 | 6 |
| Major UserMgmt (Standard Auth) | 1 | 2 |
| Major AI (AI Opponent) | 1 | 2 |
| Major Gaming (Pong + Remote) | 2 | 4 |
| Major DevOps (Microservices) | 1 | 2 |
| Minor Web (Framework + ORM + Search + Upload + Notifications) | 5 | 5 |
| Minor Accessibility (Browser Compat) | 1 | 1 |
| Minor UserMgmt (Stats + Activity Analytics) | 2 | 2 |
| Minor Gaming (Tournament + Customization + Gamification + Spectator) | 4 | 4 |
| Minor DataAnalytics (Export/Import) | 1 | 1 |
| **Total** | **21** | **29** |

> Minimum required: **14 points**. Target: **16–18 points**. This plan targets **29** — buffer for anything that doesn't fully pass evaluation.
