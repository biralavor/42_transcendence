# Major Modules: DevOps

> **Points available**: 3 modules × 2 pts = **6 points**

## Overview
DevOps modules bring production-grade infrastructure to your ft_transcendence project. They cover centralized log management (ELK), metrics and alerting (Prometheus + Grafana), and architectural decomposition (Microservices). High effort but high credibility — especially for backend-focused teams.

---

## Modules in This Category

### Module 1: ELK Stack Log Management — 2 pts
**Requirements**
- **Elasticsearch**: store and index application logs.
- **Logstash**: collect and transform logs from all services.
- **Kibana**: visualization dashboards for log analysis.
- Log retention and archiving policies.
- Secure access to all ELK components.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: Works best with Microservices (more log sources).

---

### Module 2: Monitoring with Prometheus + Grafana — 2 pts
**Requirements**
- Set up Prometheus to collect metrics from all services.
- Configure exporters and integrations (Node exporter, custom metrics).
- Create custom Grafana dashboards for your application.
- Set up alerting rules (email/Slack on threshold breach).
- Secure access to Grafana UI.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — works with monolith or microservices.

---

### Module 3: Backend as Microservices — 2 pts
**Requirements**
- Design loosely-coupled services with clear interfaces.
- Use REST APIs or message queues for inter-service communication.
- Each service has a single responsibility (auth, game, chat, notification services).
- Services can be independently deployed and scaled.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: Significantly increases complexity of all other modules.

---

## Cross-Domain Analysis

### Web
- Microservices architecture separates the backend into independent services.
- WebSocket servers may need Redis pub/sub for broadcasting across microservice instances.
- API Gateway pattern routes requests from frontend to appropriate microservices.
- ELK captures HTTP access logs from all web services.
- Prometheus monitors request rates, response times, and error rates.

### Accessibility and Internationalization
- Low direct impact — DevOps modules are infrastructure-level.
- Monitoring can track performance metrics affecting accessibility (slow page loads, timeouts).
- ELK can log accessibility-related errors.

### User Management
- Auth service can be a dedicated microservice handling all authentication/authorization.
- Vault (Cybersecurity Major) pairs with microservices — each service gets its own Vault policy.
- User session data may need Redis or distributed cache across microservice instances.
- Prometheus tracks authentication failure rates (security monitoring).

### Artificial Intelligence
- AI inference services (LLM, RAG, Recommendation) are natural microservice candidates.
- GPU-intensive AI workloads can be isolated in dedicated containers.
- Prometheus monitors AI API response times and error rates.
- ELK logs AI queries for analysis and model improvement.

### Cybersecurity
- ELK log aggregation is essential for security incident detection.
- WAF logs (ModSecurity) should flow into ELK for centralized analysis.
- Prometheus alerts on suspicious traffic patterns.
- Microservices reduce attack surface — each service is minimal and focused.
- Vault (Cybersecurity Major) integrates naturally: each microservice authenticates to Vault for secrets.

### Gaming and User Experience
- Game server can be an independent microservice.
- ELK captures game event logs (match starts, ends, disconnections).
- Prometheus monitors active game sessions, WebSocket connection count, game latency.
- Real-time alerting on game server crashes enables fast recovery.

### DevOps
All three DevOps Majors form a complete observability and infrastructure stack:
1. **ELK**: What happened (logs).
2. **Prometheus + Grafana**: How the system performs (metrics).
3. **Microservices**: How the system is structured (architecture).

Together: full production-grade infrastructure. Combined with Health Check Minor = 7 pts DevOps.

### Data and Analytics
- ELK Kibana dashboards overlap with the Analytics Dashboard (Data Major) — consider combining.
- Prometheus metrics can feed into custom analytics pipelines.
- Microservices generate more data points for analytics.

### Blockchain
- Blockchain node connections (Avalanche RPC) can be monitored via Prometheus.
- ELK logs all blockchain transaction calls for audit trails.
- Blockchain services can be isolated as microservices.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| ELK Stack | ⚠️ Medium | P4 | Logs are useful but high setup cost |
| Prometheus + Grafana | ✅ Medium | P3 | Monitor game server health and WebSocket count |
| Microservices | ❌ Low | — | Overkill for Pong; adds complexity without benefit |

**Recommended**: Prometheus + Grafana only (2 pts) — monitor game server performance

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| ELK Stack | ✅ High | P3 | Log user learning sessions, AI tutoring errors |
| Prometheus + Grafana | ✅ High | P3 | Monitor AI response times and platform performance |
| Microservices | ✅ High | P3 | AI tutor, course service, auth as separate services |

**Recommended**: All 3 DevOps Majors (6 pts) — fits a complex multi-service platform

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| ELK Stack | ⚠️ Medium | P4 | Log adoption process events |
| Prometheus + Grafana | ✅ Medium | P3 | Monitor platform health |
| Microservices | ❌ Low | — | Premature complexity for this scope |

**Recommended**: Prometheus + Grafana (2 pts) — platform health monitoring

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| ELK Stack | ✅ High | P3 | Log game events, detect cheating patterns |
| Prometheus + Grafana | ✅ High | P2 | Monitor concurrent games and WebSocket health |
| Microservices | ✅ Medium | P3 | Game service, tournament service, chat service |

**Recommended**: Prometheus + Grafana + ELK (4 pts) — arena needs strong observability
