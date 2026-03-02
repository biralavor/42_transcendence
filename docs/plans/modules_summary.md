# 42_transcendence — Module Summary

42 ft_transcendence. This project involves undertaking tasks maybe the team have never done before. Remember the beginning of our journey in computer science. Let's see if it's time to shine!

---

## Module Documentation

Detailed analysis of every available module — including cross-domain impact, dependencies, and project-specific fit — is organized in the files below.

### Major Modules (2 pts each)
| File | Category | Modules | Max pts |
|------|----------|---------|---------|
| [Major_Web.md](docs/modules/Major_Web.md) | Web | Framework, WebSockets, User Interaction, Public API | 8 |
| [Major_Accessibility.md](docs/modules/Major_Accessibility.md) | Accessibility | WCAG 2.1 AA Compliance | 2 |
| [Major_UserManagement.md](docs/modules/Major_UserManagement.md) | User Management | Standard Auth, Advanced Permissions, Organization | 6 |
| [Major_AI.md](docs/modules/Major_AI.md) | Artificial Intelligence | AI Opponent, RAG, LLM Interface, Recommendation | 8 |
| [Major_Cybersecurity.md](docs/modules/Major_Cybersecurity.md) | Cybersecurity | WAF/ModSecurity + HashiCorp Vault | 2 |
| [Major_Gaming.md](docs/modules/Major_Gaming.md) | Gaming & UX | Web Game, Remote Players, Multiplayer 3+, 2nd Game, 3D | 10 |
| [Major_DevOps.md](docs/modules/Major_DevOps.md) | DevOps | ELK Stack, Prometheus+Grafana, Microservices | 6 |
| [Major_DataAnalytics.md](docs/modules/Major_DataAnalytics.md) | Data & Analytics | Advanced Analytics Dashboard | 2 |
| [Major_Blockchain.md](docs/modules/Major_Blockchain.md) | Blockchain | Tournament Scores on Blockchain (Avalanche/Solidity) | 2 |

### Minor Modules (1 pt each)
| File | Category | Modules | Max pts |
|------|----------|---------|---------|
| [Minor_Web.md](docs/modules/Minor_Web.md) | Web | Frontend FW, Backend FW, ORM, Notifications, Collaborative, SSR, PWA, Design System, Search, File Upload | 10 |
| [Minor_Accessibility.md](docs/modules/Minor_Accessibility.md) | Accessibility | i18n (3+ languages), RTL Support, Additional Browsers | 3 |
| [Minor_UserManagement.md](docs/modules/Minor_UserManagement.md) | User Management | Game Stats, OAuth 2.0, 2FA, Activity Analytics | 4 |
| [Minor_AI.md](docs/modules/Minor_AI.md) | Artificial Intelligence | Content Moderation, Voice/Speech, Sentiment, Image Recognition | 4 |
| [Minor_Gaming.md](docs/modules/Minor_Gaming.md) | Gaming & UX | Advanced Chat, Tournament, Customization, Gamification, Spectator | 5 |
| [Minor_DevOps.md](docs/modules/Minor_DevOps.md) | DevOps | Health Check + Status Page + Backups | 1 |
| [Minor_DataAnalytics.md](docs/modules/Minor_DataAnalytics.md) | Data & Analytics | Data Export/Import, GDPR Compliance | 2 |
| [Minor_Blockchain.md](docs/modules/Minor_Blockchain.md) | Blockchain | ICP Backend (**incompatible with SSR**) | 1 |

> **Total available**: 46 Major pts + 30 Minor pts = **76 pts total**
> **Minimum to pass**: 14 pts — aim for **16–18 pts** as evaluation buffer.

---

## Module Dependency Map

```
REQUIRES A GAME FIRST (Gaming Major: "Complete Web-Based Game"):
  ├─ AI: AI Opponent
  ├─ Gaming Major: Multiplayer 3+
  ├─ Gaming Major: Add Another Game
  ├─ User Mgmt Minor: Game Statistics & Match History
  ├─ Gaming Minor: Tournament System
  ├─ Gaming Minor: Game Customization Options
  └─ Gaming Minor: Spectator Mode

REQUIRES BASIC CHAT FIRST (Web Major: "User Interaction"):
  └─ Gaming Minor: Advanced Chat Features

INCOMPATIBLE COMBINATIONS:
  SSR (Web Minor)  ←X→  ICP Backend (Blockchain Minor)
```

---

## Constraints Modules Matrix

> Complete filtered view of hard and soft constraints across every module. Use this before finalising your module selection.

**Legend:**
- 🔴 Hard constraint — violating it = 0 pts or module rejected
- 🟡 Soft constraint — violating it = evaluation risk or partial rejection

| Module | Type | Pts | Constraint Type | Constraint | Risk if Violated |
|--------|------|-----|----------------|-----------|-----------------|
| **— Web —** | | | | | |
| Full-Stack Framework | Major | 2 | — | None | — |
| WebSockets | Major | 2 | — | None | — |
| User Interaction | Major | 2 | — | None — unlocks Advanced Chat | — |
| Public API | Major | 2 | — | None | — |
| Frontend Framework | Minor | 1 | — | None | — |
| Backend Framework | Minor | 1 | — | None | — |
| ORM | Minor | 1 | — | None | — |
| Notifications | Minor | 1 | — | None | — |
| Collaborative Features | Minor | 1 | — | None | — |
| SSR | Minor | 1 | 🔴 Hard Incompatibility | Cannot combine with ICP Backend (Blockchain Minor) | Both modules at risk |
| PWA | Minor | 1 | — | None | — |
| Custom Design System | Minor | 1 | 🟡 Minimum Threshold | 10+ reusable components required | Partial rejection |
| Advanced Search | Minor | 1 | — | None | — |
| File Upload | Minor | 1 | — | None | — |
| **— Accessibility —** | | | | | |
| WCAG 2.1 AA | Major | 2 | — | None | — |
| i18n | Minor | 1 | 🟡 Minimum Threshold | At least 3 complete language translations | Partial rejection |
| RTL Support | Minor | 1 | — | None | — |
| Additional Browsers | Minor | 1 | 🟡 Minimum Threshold | Full compatibility with 2+ additional browsers | Partial rejection |
| **— User Management —** | | | | | |
| Standard Auth | Major | 2 | — | None | — |
| Advanced Permissions | Major | 2 | — | None | — |
| Organization System | Major | 2 | — | None | — |
| Game Statistics | Minor | 1 | 🔴 Hard Prerequisite | Web-Based Game must be implemented first | 0 pts |
| OAuth 2.0 | Minor | 1 | — | None | — |
| 2FA | Minor | 1 | — | None | — |
| Activity Analytics | Minor | 1 | — | None | — |
| **— Artificial Intelligence —** | | | | | |
| AI Opponent | Major | 2 | 🔴 Hard Prereq · 🟡 Eval Demo · 🟡 Cross-dep | Web-Based Game · Must explain AI at evaluation · Must use Customization if implemented | 0 pts / Fail at eval |
| RAG System | Major | 2 | — | None | — |
| LLM Interface | Major | 2 | — | None | — |
| Recommendation System | Major | 2 | — | None | — |
| Content Moderation | Minor | 1 | — | None | — |
| Voice/Speech | Minor | 1 | — | None | — |
| Sentiment Analysis | Minor | 1 | — | None | — |
| Image Recognition | Minor | 1 | — | None | — |
| **— Cybersecurity —** | | | | | |
| WAF/ModSecurity + Vault | Major | 2 | — | None | — |
| **— Gaming & UX —** | | | | | |
| Web-Based Game | Major | 2 | — | None — foundational, unlocks all Gaming prerequisites | — |
| Remote Players | Major | 2 | 🔴 Hard Prerequisite | Web-Based Game + WebSockets (Web Major) | 0 pts |
| Multiplayer 3+ | Major | 2 | 🔴 Hard Prerequisite | Web-Based Game | 0 pts |
| Add Another Game | Major | 2 | 🔴 Hard Prerequisite | Web-Based Game | 0 pts |
| 3D Graphics | Major | 2 | — | None (recommended with a game, not required) | — |
| Advanced Chat | Minor | 1 | 🔴 Hard Prerequisite | User Interaction Major (basic chat) must exist | 0 pts |
| Tournament System | Minor | 1 | 🔴 Hard Prerequisite | Web-Based Game | 0 pts |
| Game Customization | Minor | 1 | 🔴 Hard Prereq · 🟡 Cross-dep | Web-Based Game · AI Opponent must use it if both implemented | 0 pts |
| Gamification | Minor | 1 | 🟡 Minimum Threshold | 3+ features · DB-persistent · visual feedback required | Partial rejection |
| Spectator Mode | Minor | 1 | 🔴 Hard Prerequisite | Web-Based Game + WebSockets (Web Major) | 0 pts |
| **— DevOps —** | | | | | |
| ELK Stack | Major | 2 | — | None | — |
| Prometheus + Grafana | Major | 2 | — | None | — |
| Microservices | Major | 2 | — | None | — |
| Health Check + Backups | Minor | 1 | — | None | — |
| **— Data & Analytics —** | | | | | |
| Analytics Dashboard | Major | 2 | — | None | — |
| Data Export/Import | Minor | 1 | — | None | — |
| GDPR Compliance | Minor | 1 | — | None | — |
| **— Blockchain —** | | | | | |
| Tournament Scores on Blockchain | Major | 2 | 🔴 Hard Prerequisite | Web-Based Game + Tournament System (Minor) | 0 pts |
| ICP Backend | Minor | 1 | 🔴 Hard Incompatibility | Cannot combine with SSR (Web Minor) | Both modules at risk |

---

## Project Comparison

| Dimension | Pong Game | Language Learning | Pet Adoption | Card Game Arena |
|-----------|:---------:|:-----------------:|:------------:|:---------------:|
| Core difficulty | Medium | High | Medium | High |
| Team fun factor | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Best AI fit | AI Opponent | RAG + LLM + Rec. | Recommendation | AI Opponent |
| Best DevOps fit | Prometheus | Full ELK+Micro | Prometheus | ELK + Prometheus |
| Blockchain fit | High | None | None | High |
| WCAG difficulty | Hard (canvas) | Easy | Easy | Medium |
| Recommended pts | 26 | 27 | 25 | 27 |
| Risk level | Low | Medium | Low | Medium |
| Subject example | Yes (V.1) | Yes (V.6) | Yes (V.6) | Yes (V.2) |

---

## Key Rules

- Need **14 points** minimum to pass
- Major module = **2 pts** each; Minor module = **1 pt** each
- Non-functional or incomplete modules = **0 pts** during evaluation
- All claimed modules must be demonstrated live during evaluation
- SSR (Web Minor) is **incompatible** with ICP Backend (Blockchain Minor)
- Gaming AI/Tournament/Customization/Spectator/Stats modules **require a game first**
- Advanced Chat **requires basic chat** (User Interaction Major) first

> See [modules_impact_effort_samples.md](modules_impact_effort_samples.md) for per-project Impact/Effort analysis.
