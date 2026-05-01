# ft_transcendence — Wiki Home

> Real-time multiplayer Pong platform with chat, AI opponent, tournaments, and analytics. Final 42 Common Core project — 5-person team, 10 sprints (21 Feb 2026 → 1 May 2026).

---

## Quick Navigation

| Topic | Description |
|-------|-------------|
| [Milestones](Milestones) | Sprint plan and feature delivery timeline |
| [Evaluation Guide](Evaluation-Guide) | What evaluators check and how |
| [Troubleshooting](Troubleshooting) | Common setup and runtime issues |

---

## Quick Start

```bash
git clone <repo-url> ft_transcendence
cd ft_transcendence
cp .env.example .env        # fill in credentials
make                         # build images + start all containers
```

Visit **https://localhost:8443** (accept the self-signed TLS certificate).
Adminer (DB UI): **http://localhost:8888** — System: `PostgreSQL`, Server: `db`.

```bash
make ps                      # container status
make check                   # wait + run integration health check
make fclean                  # full teardown
```

---

## Architecture at a Glance

```
Browser (HTTPS :8443)
    │
    ▼
nginx (reverse proxy + TLS)
    ├── /api/users/ ──► user-service:8001   (auth, profiles, friends, presence)
    ├── /api/game/  ──► game-service:8002   (pong, AI, tournaments, history)
    ├── /api/chat/  ──► chat-service:8003   (WebSocket chat)
    └── /*          ──► frontend:3000       (React + Vite)

Adminer ── :8888           PostgreSQL 16 (shared) ── internal :5432
```

All backend services share PostgreSQL 16 (separate Alembic histories) and a shared Python package on the internal Docker network.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite (JavaScript), native WebSockets, Vitest + Testing Library |
| Backend | FastAPI (Python 3.12) — 3 microservices: user, game, chat |
| Database | PostgreSQL 16 + SQLAlchemy (async) + Alembic |
| Reverse Proxy | nginx 1.28 (TLS termination, location-based routing) |
| Infrastructure | Docker + Docker Compose (Linux & Windows compatible), Alpine images |
| CI / Automation | GitHub Actions (labeler, PR-to-project, health-check on PR) |

---

## Team

| Name | Role | GitHub |
|------|------|--------|
| Lis | Product Owner · Developer | [@solismesmo](https://github.com/solismesmo) |
| Mauricio Rodrigues | Technical Lead · Architect · Developer | [@RedJocker](https://github.com/RedJocker) |
| Bira Lavor | Project Manager · Scrum Master · Developer | [@biralavor](https://github.com/biralavor) |
| Bruno Gomes Lameirinha | Developer | [@Bruno-Gomes-Lameirinha](https://github.com/Bruno-Gomes-Lameirinha) |
| Bruno Thorstensen | Developer | [@brunothors](https://github.com/brunothors) |

---

## Chosen Modules

### Major (2 pts each)

| Module | Category |
|--------|----------|
| Real-Time Features — WebSockets | Web |
| User Interaction — Chat + Profile + Friends | Web |
| Standard User Management & Authentication | User Management |
| AI Opponent | Artificial Intelligence |
| Web-Based Game (Pong) | Gaming & UX |
| Remote Players | Gaming & UX |
| Backend as Microservices | DevOps |

### Minor (1 pt each)

| Module | Category |
|--------|----------|
| Frontend Framework · Backend Framework · ORM | Web |
| Notification System · Advanced Search · File Upload | Web |
| Browser Compatibility | Accessibility |
| Game Statistics & Match History | User Management |
| User Activity Analytics & Insights Dashboard | User Management |
| Tournament System · Game Customization · Gamification · Spectator Mode | Gaming & UX |
| Data Export and Import | Data & Analytics |

> 7 Major × 2 + 14 Minor × 1 = **28 pts** (subject minimum: 14).
> Per-module specs: [`docs/modules/`](../modules).

---

## Key Documentation

| Doc | Purpose |
|-----|---------|
| [README.md](../../README.md) | Evaluator-facing overview |
| [docs/DEV_DOC.md](../DEV_DOC.md) | Dev setup, make targets, Alembic, LAN sharing |
| [docs/ARCHITECTURE.md](../ARCHITECTURE.md) | System diagram and service routing |
| [docs/MICROSERVICES.md](../MICROSERVICES.md) | Service layout, import patterns, adding services |
| [docs/AUTHENTICATION.md](../AUTHENTICATION.md) | Auth flow, token design, DB schema |
| [docs/PONG_GAME_MECHANICS.md](../PONG_GAME_MECHANICS.md) | Game rules, controls, tournament system |
| [docs/EVENT_DRIVEN_NOTIFICATIONS.md](../EVENT_DRIVEN_NOTIFICATIONS.md) | Notification fan-out + WS events |
| [docs/WEBSOCKET_LOGGING.md](../WEBSOCKET_LOGGING.md) | WS observability conventions |
| [docs/CONTRIBUTING.md](../CONTRIBUTING.md) | Git workflow, branching, Conventional Commits |
| [docs/GitHub-Projects.md](../GitHub-Projects.md) | Board guide: 3 squads, 10 sprints, 5 milestones |

---

## Project Rhythm

- **10 sprints**, 21 Feb 2026 → 1 May 2026
- **5 milestones**, one every 2 sprints (demo + retrospective)
- **3 squads**: Database · Backend · Frontend
- Branch strategy: feature branches → `develop` → `main` (Conventional Commits)
