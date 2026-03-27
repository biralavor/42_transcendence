# ft_transcendence

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

> Real-time multiplayer Pong platform with chat, user management, AI opponent, and tournament system — built as the final 42 Common Core project.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (JavaScript) + WebSockets |
| Backend | FastAPI (Python) + uvicorn |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose · nginx (TLS 1.2/1.3) · Alpine Linux |

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

### Minor Modules (1 pt each)

| Module | Category |
|--------|----------|
| Frontend Framework | Web |
| Backend Framework | Web |
| ORM for Database | Web |
| Notification System | Web |
| Advanced Search | Web |
| File Upload & Management | Web |
| Browser Compatibility | Accessibility |
| Additional Browser Support | Accessibility |
| Game Statistics & Match History | User Management |
| User Activity Analytics & Insights Dashboard | User Management |
| Tournament System | Gaming & UX |
| Game Customization | Gaming & UX |
| Gamification System | Gaming & UX |
| Spectator Mode | Gaming & UX |
| Data Export and Import | Data & Analytics |

> **7 Major × 2 pts + 15 Minor × 1 pt = 29 pts total**
> Subject minimum: 14 pts — this build provides a comfortable evaluation buffer.

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

See [docs/DEV_DOC.md](docs/DEV_DOC.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/MICROSERVICES.md](docs/MICROSERVICES.md) · [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

## Contributing

Contributions are welcome! Please follow these steps:
1. Review the [Architecture Documentation](docs/ARCHITECTURE.md) to understand the microservice boundaries.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Ensure your code passes the `bash tests/TranscendenceHealthCheck.sh` suite.
4. Open a Pull Request detailing your changes and which module they impact.