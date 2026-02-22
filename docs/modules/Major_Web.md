# Major Modules: Web

> **Points available**: 4 modules × 2 pts = **8 points**

## Overview
Web modules form the technical backbone of any ft_transcendence project. They define the full-stack architecture, real-time communication layer, social interaction system, and external API surface. Choosing the right web majors early is critical — many other modules depend on them.

---

## Modules in This Category

### Module 1: Full-Stack Framework — 2 pts
**Requirements**
- Use a **frontend framework**: React, Vue, Angular, Svelte, etc.
- Use a **backend framework**: Express, Fastify, NestJS, Django, Flask, Ruby on Rails, etc.
- Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as **both** if you use their full capabilities.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — foundational module.

---

### Module 2: Real-Time Features (WebSockets) — 2 pts
**Requirements**
- Real-time updates across all connected clients.
- Handle connection/disconnection events gracefully.
- Efficient message broadcasting to multiple subscribers.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — but strongly enables Gaming, Chat, and Notifications.

---

### Module 3: User Interaction (Chat + Profile + Friends) — 2 pts
**Requirements**
- **Basic chat**: send/receive messages between users.
- **Profile system**: view user information and stats.
- **Friends system**: add/remove friends, see friends list and online status.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None — but this module is a hard prerequisite for Advanced Chat (Gaming Minor) | — |

**Dependencies**: None — but is a **prerequisite** for the Advanced Chat Minor module.

---

### Module 4: Public API — 2 pts
**Requirements**
- Secured API key with rate limiting.
- Full documentation (e.g., Swagger/OpenAPI).
- At least 5 endpoints covering GET, POST, PUT, DELETE.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: Benefits from ORM Minor and Framework Major.

---

## Cross-Domain Analysis

### Web
These are the core web modules. The framework choice shapes your entire stack. WebSockets are non-negotiable for real-time game sync and live chat. The Public API creates a clean integration surface for blockchain, external services, and third-party consumers. Stacking all 4 Web Majors gives 8 pts and a solid full-stack foundation.

### Accessibility and Internationalization
- Framework choice determines how accessible your app can be (React: great a11y libs; Angular: built-in ARIA support).
- WebSocket events must trigger accessible status updates (ARIA live regions).
- The chat system must support keyboard navigation and screen readers to pass WCAG AA.
- Public API must return i18n-ready content structures.

### User Management
- The User Interaction module (chat + friends + profile) directly overlaps with the Standard User Management Major — implement them together.
- The friends list and online status are shared features between Web and User Management modules.
- Public API endpoints naturally expose user management CRUD operations.

### Artificial Intelligence
- WebSockets are essential for streaming LLM responses in real time.
- The chat interface is the natural entry point for RAG/LLM interactions.
- Public API can expose AI-powered endpoints to external consumers.
- Real-time events feed AI recommendation engines with behavioral signals.

### Cybersecurity
- The Public API MUST be secured: API keys, rate limiting, input validation, HTTPS everywhere.
- WebSocket connections require proper JWT/session authentication.
- Chat input must be sanitized server-side to prevent XSS.
- Framework choice impacts the security surface area (NestJS has built-in guards, pipes).

### Gaming and User Experience
- Real-Time WebSockets are **essential** for any multiplayer game (Pong, Card Games, Chess).
- The User Interaction module enables in-game chat and direct game challenge invitations.
- Public API can expose live game state for spectator clients.
- Framework rendering performance directly impacts game smoothness.

### DevOps
- Framework choice determines containerization strategy.
- WebSocket servers need load balancer sticky sessions (e.g., Nginx `ip_hash`).
- Public API requires documentation deployment (Swagger UI container).
- Next.js/Nuxt.js SSR impacts deployment configuration.

### Data and Analytics
- Public API is the primary interface for analytics data consumption.
- WebSockets can push real-time analytics updates to dashboards.
- Chat metadata (timestamps, counts) feeds behavioral analytics.
- ORM integration (Minor) makes analytics queries easier to write.

### Blockchain
- The Public API can call smart contract functions (Avalanche/Solidity).
- WebSockets can stream blockchain transaction confirmations to the UI.
- **Warning**: SSR (Minor Web) is **incompatible** with the ICP blockchain backend.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Full-Stack Framework | ✅ Essential | P1 | Foundation for everything |
| Real-Time WebSockets | ✅ Essential | P1 | Game state sync |
| User Interaction | ✅ High | P2 | Chat + game challenges |
| Public API | ⚠️ Optional | P3 | Useful for leaderboard exposure |

**Recommended combo**: Framework + WebSockets + User Interaction = 6 pts (solid Pong base)

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Full-Stack Framework | ✅ Essential | P1 | Foundation |
| User Interaction | ✅ High | P1 | Peer practice sessions |
| Real-Time WebSockets | ✅ High | P2 | Live lesson collaboration |
| Public API | ✅ High | P2 | Dictionary/translation API integration |

**Recommended combo**: All 4 Web Majors = 8 pts (comprehensive platform)

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Full-Stack Framework | ✅ Essential | P1 | Foundation |
| User Interaction | ✅ High | P1 | Adopter ↔ shelter messaging |
| Public API | ✅ High | P2 | Expose listings to external apps |
| Real-Time WebSockets | ⚠️ Medium | P3 | Adoption status notifications |

**Recommended combo**: Framework + User Interaction + Public API = 6 pts

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Full-Stack Framework | ✅ Essential | P1 | Foundation |
| Real-Time WebSockets | ✅ Essential | P1 | Card game turn sync |
| User Interaction | ✅ High | P2 | Chat + game invitations |
| Public API | ✅ High | P2 | Leaderboard/stats API |

**Recommended combo**: All 4 Web Majors = 8 pts (complete arena)
