# ft_transcendence — Wiki Home

> Real-time Pong platform built for 42 School. Group project — 5 developers.

---

## Quick Navigation

| Topic | Description |
|-------|-------------|
| [Milestones](Milestones) | Sprint plan and feature delivery timeline |
| [Troubleshooting](Troubleshooting) | Common setup issues and fixes |

---

## What Is This Project?

ft_transcendence is the final Common Core project at 42 School. The goal is to build a **fully functional web application** with:

- A real-time **Pong game** (local + remote + AI opponent)
- **User management**: registration, login (JWT), profiles
- **Real-time chat** via WebSockets
- A **microservices** backend (FastAPI / Python)
- A **React** single-page frontend
- **PostgreSQL** database
- **TLS** termination via nginx

---

## Architecture at a Glance

```
Browser (HTTPS :8443)
    │
    ▼
nginx (reverse proxy + TLS)
    ├── /api/users/ ──► user-service:8001   (auth, profiles)
    ├── /api/game/  ──► game-service:8002   (pong, AI, tournament)
    ├── /api/chat/  ──► chat-service:8003   (WebSocket chat)
    └── /*          ──► frontend:3000       (React + Vite)

Adminer (DB admin UI) ── :8888
```

All services share a PostgreSQL 16 database on an internal Docker network.

---

## Quick Start

```bash
git clone <repo> ft_transcendence
cd ft_transcendence
cp .env.example .env
# fill in credentials in .env
make
```

Visit **https://localhost:8443** (accept the self-signed certificate warning).

---

## Team

| Name | Role |
|------|------|
| [Bira Lavor](https://github.com/biralavor) | Project Manager · Scrum Master · DevOps · Developer |
| [Mauricio Rodrigues](https://github.com/RedJocker) | Technical Lead · Architect · Developer |
| [Lis](https://github.com/solismesmo) | Product Owner · Developer |
| [Bruno Lameirinha](https://github.com/Bruno-Gomes-Lameirinha) | Developer |
| [Bruno Thorstensen](https://github.com/brunothors) | Developer |

---

## Key Documentation (in repo)

| File | Purpose |
|------|---------|
| `README.md` | Evaluator-facing overview |
| `docs/DEV_DOC.md` | Developer setup and build guide |
| `docs/ARCHITECTURE.md` | System diagram and service routing |
| `docs/MICROSERVICES.md` | Backend service layout and import patterns |
| `docs/CONTRIBUTING.md` | Git workflow, branching, Conventional Commits |
| `docs/GitHub-Projects.md` | Board guide, squads, sprint schedule |
