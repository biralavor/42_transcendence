# ft_transcendence

This project has been created as part of the 42 curriculum by *maurodri*, *umeneses*, *dgomes-l*, *livieira*, *bnespoli*.

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

> Real-time multiplayer Pong platform with chat, user management, AI opponent, and tournament system — built as the final 42 Common Core project.

<img width="904" height="654" alt="image" src="https://github.com/user-attachments/assets/a72e420b-66a8-4a9e-972d-b8212770732f" />

---

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | React (JavaScript) + Vite (with Hot Module Replacement)| Component-based UI, rapid development with hot module reloading, mature ecosystem for real-time apps |
| Backend | FastAPI (Python) + uvicorn | Async-first framework enabling real-time WebSockets; automatic API documentation; strong type hints for reliability |
| Database | PostgreSQL 16 | Robust ACID compliance for transaction integrity; JSON support for flexible schemas; superior to MySQL for complex queries |
| Infrastructure | Docker Compose · nginx (TLS 1.2/1.3) · Alpine Linux | Reproducible multi-service deployment; Alpine reduces image size; TLS termination at nginx for security |
| Real-time | WebSockets (asyncio) | Instant notifications and live game state—essential for multiplayer Pong and chat |
| ORM | SQLAlchemy + Alembic | Type-safe queries; schema versioning; cross-service data integrity without duplicate migrations |

---

## Project Management Approach

**Methodology:** Trunk-Based Development (TBD) with 1-week Agile sprints (10 sprints, Feb 21 – May 1 2026).

- **Sprint Cycle:** Monday-Saturday; Scrum Master merges `develop` → `main` every Sunday
- **Board:** GitHub Projects (one shared board for all 5 team members) with custom Squad field (DB, BE, FE)
- **Workflow:** GitHub Issues → feature branches (`#N-issue-name`) → Pull Requests → `develop` → `main`
- **Automation:** Auto-link PRs to project; auto-set Sprint on PR creation; close Issues on merge
- **Milestones:** 
  - 10 Sprints
  - Milestones Phases:
    - #1 Foundations- Hello World with Auth login
    - #2 Core Gamepley - Basic Pong Game + Chat + Stats
    - #3 Tournaments + AI
    - #4 Platform Features
    - #5 Final Polishment
- **Tracking:** Burndown via GitHub Projects milestone progress (open vs closed Issues) - 200 Issues, 180 PRs

---

## Chosen Modules

### Major Modules (2 pts each)

| Module | Category |
|--------|----------|
| Real-Time Features — WebSockets | Web |
| User Interaction — Chat + Profile + Friends | Web |
| Standard User Management & Authentication | User Management |
| AI Opponent | Artificial Intelligence |
| Web-Based Game (Pong) | Gaming & UX |
| Remote Players | Gaming & UX |
| Backend as Microservices | DevOps |
| Advanced analytics dashboard with data visualization | Data & Analytics |

### Minor Modules (1 pt each)

| Module | Category |
|--------|----------|
| Frontend Framework | Web |
| Backend Framework | Web |
| ORM for Database | Web |
| Notification System | Web |
| Advanced Search | Web |
| File Upload & Management | Web |
| Game Statistics & Match History | User Management |
| User Activity Analytics & Insights Dashboard | User Management |
| Tournament System | Gaming & UX |
| Game Customization | Gaming & UX |
| Gamification System | Gaming & UX |
| Spectator Mode | Gaming & UX |

> **7 Major × 2 pts + 14 Minor × 1 pt = 28 pts total**
> Subject minimum: 14 pts — this build provides a comfortable evaluation buffer.

---

## Database Schema

PostgreSQL 16 with three independent Alembic migration histories (one per service).

| Service | Owned Tables | Purpose |
|---------|--|---|
| **user-service** | `users` | User accounts (username, hashed password via credentials.id FK, avatar URL, profile fields) |
| | `credentials` | Local authentication (username, email, password hash) |
| | `tokens` | Refresh token records (hash, expiration, revocation tracking) |
| | `friendships` | Friend connections (bidirectional with status) |
| | `notifications` | In-app notifications (game invites, friend requests, messages, achievements, tournaments, chat messages) |
| | `achievements` | Badge templates (e.g., "First Win", "Streak Master") |
| | `user_login_days` | Per-day activity for analytics (games count, messages count, login timestamp) |
| **game-service** | `matches` | Pong match records (player IDs, scores, winner, timestamp, AI flag) |
| | `tournaments` | Tournament metadata (name, state, participant count, created_at) |
| | `tournament_participants` | Many-to-many: users in tournaments |
| | `tournament_matches` | Round-robin matches within a tournament |
| **chat-service** | `chat_rooms` | Chat rooms (name, type: DM/group, created_at) |
| | `messages` | Chat messages (room_id, user_id, sender_name, content, created_at) |
| | `blocks` | Blocked user pairs (prevents DMs and room visibility) |

**Data Access:**
- Each service owns its tables and issues migrations via its own Alembic history.
- Cross-service reads happen via shared engine (e.g., `chat-service` reads `users`).
- Cross-service writes go through HTTP (e.g., `game-service` → `user-service` for notifications).

**Recommended Indexes:** Explicit indexes exist on FK columns (e.g., requester_id/addressee_id in friendships, blocker_id in blocks). Consider adding indexes on:
- `created_at` columns for time-range queries (user activity, match history)
- `user_id` on messages and matches tables for per-user lookups
- `room_id` on messages for efficient message retrieval
- `tournament_id` on tournament_matches for tournament-specific queries

---

## Quick Start

```bash
git clone <repo-url> ft_transcendence
cd ft_transcendence
cp .env.example .env        # fill in credentials
make                         # build images + start all containers
```

Visit **https://localhost** (accept the self-signed TLS certificate).
Visit **http://localhost:8888** for Adminer — System: `PostgreSQL`, Server: `db`.

```bash
make ps                      # check container status
bash tests/TranscendenceHealthCheck.sh   # run health checks
make fclean                  # full teardown
```

See [docs/DEV_DOC.md](docs/DEV_DOC.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/MICROSERVICES.md](docs/MICROSERVICES.md) · [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for developer guides.

## Documentation

| Resource | Description |
|----------|-------------|
| [Wiki — Home](https://github.com/biralavor/42_transcendence/wiki/Home) | Project overview and quick start |
| [Wiki — Milestones](https://github.com/biralavor/42_transcendence/wiki/Milestones) | Sprint plan and delivery timeline |
| [Wiki — Troubleshooting](https://github.com/biralavor/42_transcendence/wiki/Troubleshooting) | Common setup and runtime issues |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram and service routing |
| [docs/MICROSERVICES.md](docs/MICROSERVICES.md) | Backend service layout |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Git workflow and branching strategy |
| [docs/SQLAlchemy_vs_Alembic.md](docs/SQLAlchemy_vs_Alembic.md) | Alembic migration guide — changelog, rollback, workflow and explanation about SQLAlchemy |

---

## Features Implemented

| Feature | Module | Category | Key Components |
|---------|--------|----------|--------|
| **JWT Authentication** | Standard User Mgmt | Auth | Register, login, refresh, token revocation |
| **User Profiles** | Standard User Mgmt | UX | Profile pages, display name, bio, avatar upload |
| **Friend System** | User Interaction | Social | Add/remove friends, friend requests, status tracking |
| **Real-Time Chat** | Real-Time Features | Web | DMs, group rooms, instant notifications, WebSockets |
| **Pong Game (Local)** | Web-Based Game | Gaming | 2-player local match, paddle physics, score tracking |
| **Online Multiplayer** | Remote Players | Gaming | Match invites, live opponent sync, game state broadcast |
| **AI Opponent** | AI Opponent | Gaming | Difficulty levels (easy/medium/hard) with parameter-based paddle prediction (error rate, reaction delay, noise) |
| **Tournaments** | Tournament System | Gaming | Create, join, round-robin bracket, notifications |
| **Match History** | Game Statistics | Analytics | Per-user stats, win/loss tracking, paginated match query with date/result filters |
| **Leaderboard** | Game Statistics | Analytics | XP ranking, seasonal boards, pagination |
| **Game Customization** | Game Customization | Gaming | Theme switcher (4 themes: neon, wood, central paddle, two-paddle) |
| **Spectator Mode** | Spectator Mode | Gaming | Watch live matches, spectator count, read-only state |
| **Gamification** | Gamification System | Gaming | Achievements (badges), XP progression, streaks |
| **Activity Dashboard** | Activity Analytics | Analytics | User login history, games/messages per day, admin aggregate view |
| **Advanced Search** | Advanced Search | Web | Search users by username; filter matches by date/opponent |
| **File Upload** | File Upload & Management | Web | Avatar upload/delete, persistent storage in Docker volume |
| **Notification System** | Notification System | Web | In-app notifications (game invites, friend requests, tournament updates) |
| **Microservices** | Backend as Microservices | DevOps | 3 independent FastAPI services (user, game, chat) |
| **Privacy Policy** | Standard Auth | Compliance | `/privacy` page with data collection terms |
| **Terms of Service** | Standard Auth | Compliance | `/terms` page with usage rules |
| **Browser Compatibility** | Browser Compatibility | Accessibility | Tested on Chrome, Firefox, Safari; responsive design |
| **Data Export** | Data Analytics | Analytics | `GET /export` CSV endpoint for user data and match history |

---

## Team and Individual Contributions 

### **Lis** (Product Owner) [@solismesmo](https://github.com/solismesmo)
- **Role:** Product direction, visual identity, game narrative
- **Key Contributions:**
  - Shaped the product vision and overall user experience goals
  - Defined the visual identity and arcade-inspired presentation
  - Contributed to the Pong history/storytelling and thematic framing
  - Supported product decisions around feature scope and evaluation readiness

### **Mauricio Rodrigues** (Technical Lead & Architect) [@RedJocker](https://github.com/RedJocker)
- **Role:** System design, backend architecture, API contracts, DevOps oversight
- **Key Contributions:**
  - Designed 3-service microservices topology with shared PostgreSQL
  - Implemented shared code library (`shared/`) for cross-service utilities
  - Led technical reviews and code quality standards
  - Designed inter-service communication patterns (HTTP + async events)
  - Pagination for Match History, Learderboard, User Search
  - Implemented Game Achievements, Authentication
  - Implemented **Pong game engine** (physics, collision detection, AI opponent logic)

### **Bira Lavor** (Project Manager, DevOps & Scrum Master) [@biralavor](https://github.com/biralavor)
- **Role:** Sprint planning, team coordination, CI/CD infrastructure, DevOps, user-facing experience
- **Key Contributions:**
  - Established Trunk-Based Development workflow with GitHub Projects automation
  - Built GitHub Actions workflows (health checks, auto-linking PRs, closing issues, auto-delete branches)
  - Setup Docker Compose orchestration and nginx routing
  - Architected event-driven WebSocket notification system (50x latency improvement)
  - Configured Docker images and build pipelines
  - Managed release schedule (10 sprints, Sundays for main merges)
  - Mentored team on Agile ceremonies and retrospectives
  - Troubleshooting infrastructure and environment setup
  - Created theme system (4 selectable themes with CSS variables)

### **Bruno Gomes Lameirinha** (Full-Stack Developer) [@Bruno-Gomes-Lameirinha](https://github.com/Bruno-Gomes-Lameirinha)
- **Role:** Backend APIs, business logic, game mechanics
- **Key Contributions:**
  - Implemented **user-service** endpoS for mints (auth, profiles, friends, activity tracking)
  - Built achievement and XP system with badge logic
  - Designed login streak calculation and activity analytics aggregation
  - Designed responsive pages (Profile, Leaderboard, Chat, Tournament)
  - Built game UI components and private routes (PongCanvas, GameWaitingRoom, Spectator view, Tournaments)

### **Bruno Thorstensen** (Full-Stack Developer) [@brunothors](https://github.com/brunothors) 
- **Role:** UI/UX, React components, frontend integration, game rendering
- **Key Contributions:**
  - Built React app scaffold with Vite and React Router
  - Implemented **Pong game engine** (physics, collision detection, AI opponent logic)
  - Integrated real-time WebSocket state management for multiplayer sync
  - Implemented admin dashboard queries for site-wide stats
  - Wrote Alembic migrations for user-service schema evolution
  - Implemented Advanced Analytics Dashboard

---

