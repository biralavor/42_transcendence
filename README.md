# 42_transcendence

42 ft_transcendence. This project involves undertaking tasks maybe the team have never done before. Remember the beginning of our journey in computer science. Let's see if it's time to shine!

---

## Module Documentation

Detailed analysis of every available module — including cross-domain impact, dependencies, and project-specific fit — is organized in the files below.

### Major Modules (2 pts each)
| File | Category | Modules | Max pts |
|------|----------|---------|---------|
| [Major_Web.md](Modules/Major_Web.md) | Web | Framework, WebSockets, User Interaction, Public API | 8 |
| [Major_Accessibility.md](Modules/Major_Accessibility.md) | Accessibility | WCAG 2.1 AA Compliance | 2 |
| [Major_UserManagement.md](Modules/Major_UserManagement.md) | User Management | Standard Auth, Advanced Permissions, Organization | 6 |
| [Major_AI.md](Modules/Major_AI.md) | Artificial Intelligence | AI Opponent, RAG, LLM Interface, Recommendation | 8 |
| [Major_Cybersecurity.md](Modules/Major_Cybersecurity.md) | Cybersecurity | WAF/ModSecurity + HashiCorp Vault | 2 |
| [Major_Gaming.md](Modules/Major_Gaming.md) | Gaming & UX | Web Game, Remote Players, Multiplayer 3+, 2nd Game, 3D | 10 |
| [Major_DevOps.md](Modules/Major_DevOps.md) | DevOps | ELK Stack, Prometheus+Grafana, Microservices | 6 |
| [Major_DataAnalytics.md](Modules/Major_DataAnalytics.md) | Data & Analytics | Advanced Analytics Dashboard | 2 |
| [Major_Blockchain.md](Modules/Major_Blockchain.md) | Blockchain | Tournament Scores on Blockchain (Avalanche/Solidity) | 2 |

### Minor Modules (1 pt each)
| File | Category | Modules | Max pts |
|------|----------|---------|---------|
| [Minor_Web.md](Modules/Minor_Web.md) | Web | Frontend FW, Backend FW, ORM, Notifications, Collaborative, SSR, PWA, Design System, Search, File Upload | 10 |
| [Minor_Accessibility.md](Modules/Minor_Accessibility.md) | Accessibility | i18n (3+ languages), RTL Support, Additional Browsers | 3 |
| [Minor_UserManagement.md](Modules/Minor_UserManagement.md) | User Management | Game Stats, OAuth 2.0, 2FA, Activity Analytics | 4 |
| [Minor_AI.md](Modules/Minor_AI.md) | Artificial Intelligence | Content Moderation, Voice/Speech, Sentiment, Image Recognition | 4 |
| [Minor_Gaming.md](Modules/Minor_Gaming.md) | Gaming & UX | Advanced Chat, Tournament, Customization, Gamification, Spectator | 5 |
| [Minor_DevOps.md](Modules/Minor_DevOps.md) | DevOps | Health Check + Status Page + Backups | 1 |
| [Minor_DataAnalytics.md](Modules/Minor_DataAnalytics.md) | Data & Analytics | Data Export/Import, GDPR Compliance | 2 |
| [Minor_Blockchain.md](Modules/Minor_Blockchain.md) | Blockchain | ICP Backend (**incompatible with SSR**) | 1 |

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

## Impact / Effort Matrix

> **Definitions**
> - **Impact** `H`: Module adds high value to this specific project concept
> - **Impact** `L`: Module adds marginal value to this project concept
> - **Effort** `H`: Requires 1+ week of focused development
> - **Effort** `L`: Can be completed in 1–3 days

### The Four Quadrants

| | **Effort L** | **Effort H** |
|---|---|---|
| **Impact H** | ✅ **QUICK WINS** — Do these first | ⚡ **MAJOR BETS** — Plan carefully, high return |
| **Impact L** | 🔵 **FILL-INS** — Do if points needed | ❌ **AVOID** — Poor ROI |

---

## Matrix 1 — Pong Game

> Classic Pong with online multiplayer, AI opponent, tournaments, and power-ups.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win |
|--------|------|-----|---------------------|
| Web: Full-Stack Framework | Major | 2 | Foundation — every other module depends on it |
| User Mgmt: Standard Auth | Major | 2 | Essential — profiles, friends, online status |
| User Mgmt: OAuth 2.0 | Minor | 1 | "Login with 42/GitHub" — a few hours |
| User Mgmt: Game Statistics | Minor | 1 | Win/loss tracking — pairs directly with the game |
| User Mgmt: 2FA | Minor | 1 | TOTP library + QR code — low effort |
| Gaming: Tournament System | Minor | 1 | Bracket + matchmaking — core Pong feature |
| Gaming: Game Customization | Minor | 1 | Power-ups, ball speed, paddle size |
| Gaming: Gamification | Minor | 1 | XP, badges, leaderboard |
| Web: ORM | Minor | 1 | Prisma/TypeORM — clean DB access |
| Web: Notifications | Minor | 1 | Game invites, tournament alerts |
| Web: PWA | Minor | 1 | Install Pong as mobile app — service worker |
| DevOps: Health Check | Minor | 1 | `/health` endpoint + cron backup — ~4 hours |
| A11y: Browser Support | Minor | 1 | Test on Firefox + Safari |

**Quick Wins Total: 14 pts — minimum passed with quick wins alone!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort |
|--------|------|-----|--------------------------|
| Web: Real-Time WebSockets | Major | 2 | Essential for game sync — but complex to implement right |
| Web: User Interaction | Major | 2 | Chat + friends — needed for social game invitations |
| Gaming: Web-Based Game | Major | 2 | The Pong game itself — the core deliverable |
| Gaming: Remote Players | Major | 2 | Online multiplayer — makes Pong actually playable |
| AI: AI Opponent | Major | 2 | Classic Pong AI — must explain during evaluation |
| Data: Analytics Dashboard | Major | 2 | Game stats visualization — win rates, tournament history |
| Blockchain: Tournament Scores | Major | 2 | Immutable tournament leaderboard — impressive tech |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Web: Advanced Search | Minor | 1 | Find players by username |
| Web: File Upload | Minor | 1 | Avatar uploads only |
| Data: GDPR Compliance | Minor | 1 | User data deletion — minimal scope for Pong |
| Gaming: Spectator Mode | Minor | 1 | Watch matches live |
| Web: SSR | Minor | 1 | Only if using Next.js/Nuxt.js already |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| AI: RAG System | No knowledge base exists in Pong |
| AI: LLM Interface | Not relevant to gameplay |
| AI: Recommendation System | Minimal user data, low ROI |
| Web: Custom Design System | Overkill for Pong scope |
| A11y: WCAG 2.1 AA | Canvas game accessibility is very hard |
| A11y: RTL Support | Canvas game layout reversal is extremely complex |
| User Mgmt: Organization System | Teams for Pong is a stretch |
| DevOps: ELK Stack | Over-engineering for a game |
| DevOps: Microservices | Adds complexity without meaningful benefit |
| Blockchain: ICP Backend | Real-time game needs low latency |

### Recommended Build (22 pts)
```
Web Major:      Full-Stack Framework (2) + WebSockets (2) + User Interaction (2) = 6 pts
Gaming Major:   Web Game (2) + Remote Players (2)                                = 4 pts
AI Major:       AI Opponent (2)                                                  = 2 pts
User Mgmt:      Standard Auth (2) + OAuth (1) + Game Stats (1) + 2FA (1)        = 5 pts
Gaming Minors:  Tournament (1) + Customization (1) + Gamification (1)           = 3 pts
Data Major:     Analytics Dashboard (2)                                          = 2 pts
Web Minors:     ORM (1) + Notifications (1) + PWA (1)                           = 3 pts
DevOps Minor:   Health Check (1)                                                 = 1 pt
──────────────────────────────────────────────────────────────────────────────────
TOTAL:                                                                           26 pts
```

---

## Matrix 2 — Language Learning Platform

> Lessons, exercises, progress tracking, AI tutor, peer practice sessions.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win |
|--------|------|-----|---------------------|
| Web: Full-Stack Framework | Major | 2 | Foundation |
| User Mgmt: Standard Auth | Major | 2 | Student profiles, teacher/student social |
| User Mgmt: OAuth 2.0 | Minor | 1 | Easy login for students |
| User Mgmt: Activity Analytics | Minor | 1 | Study streaks, lesson completion tracking |
| Gaming: Gamification | Minor | 1 | Learning XP, streak badges — Duolingo model |
| A11y: Multiple Languages (i18n) | Minor | 1 | A language app MUST be multilingual |
| A11y: Browser Support | Minor | 1 | Students use all browsers |
| Web: ORM | Minor | 1 | Course/lesson data queries |
| Web: Notifications | Minor | 1 | Assignment reminders, lesson completion |
| DevOps: Health Check | Minor | 1 | Easy 1 pt |
| Data: GDPR Compliance | Minor | 1 | Student data protection — legally important |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort |
|--------|------|-----|--------------------------|
| User Mgmt: Advanced Permissions | Major | 2 | Teacher vs student vs admin roles |
| User Mgmt: Organization System | Major | 2 | Schools, classrooms, study groups |
| AI: RAG System | Major | 2 | Answer grammar questions from knowledge base |
| AI: LLM Interface | Major | 2 | AI language tutor — conversation practice |
| AI: Recommendation System | Major | 2 | Recommend next lessons based on progress |
| AI: Voice/Speech | Minor | 1 | Pronunciation practice — core feature for language learning |
| Web: User Interaction | Major | 2 | Peer practice chat sessions |
| Web: Real-Time WebSockets | Major | 2 | Live lesson collaboration |
| Data: Analytics Dashboard | Major | 2 | Student progress tracking |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Web: Advanced Search | Minor | 1 | Search vocabulary lists, lessons |
| Web: File Upload | Minor | 1 | Audio exercises, lesson documents |
| Web: SSR | Minor | 1 | SEO for lesson pages |
| A11y: RTL Support | Minor | 1 | Arabic/Hebrew learners |
| Data: Export/Import | Minor | 1 | Import vocabulary lists, export progress |
| User Mgmt: 2FA | Minor | 1 | Student account security |
| AI: Content Moderation | Minor | 1 | Moderate student submissions |
| AI: Sentiment Analysis | Minor | 1 | Detect student frustration in responses |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| Gaming: Web-Based Game | Only if vocabulary mini-game is central to concept |
| Blockchain: Any | No natural use case in language learning |
| DevOps: Microservices | Premature for typical team timeline |
| A11y: WCAG 2.1 AA | High effort; forms and lessons are accessible naturally |

### Recommended Build (26 pts)
```
Web Major:      Full-Stack Framework (2) + User Interaction (2) + WebSockets (2) = 6 pts
User Mgmt:      Standard Auth (2) + Advanced Permissions (2)                     = 4 pts
AI Major:       RAG System (2) + LLM Interface (2)                               = 4 pts
Data Major:     Analytics Dashboard (2)                                           = 2 pts
User Mgmt:      OAuth (1) + Activity Analytics (1) + 2FA (1)                     = 3 pts
Gaming Minor:   Gamification (1)                                                  = 1 pt
AI Minors:      Voice/Speech (1) + Content Moderation (1) + Sentiment (1)        = 3 pts
A11y Minors:    i18n (1) + Browser Support (1)                                   = 2 pts
Data Minor:     GDPR (1)                                                          = 1 pt
DevOps Minor:   Health Check (1)                                                  = 1 pt
──────────────────────────────────────────────────────────────────────────────────
TOTAL:                                                                            27 pts
```

---

## Matrix 3 — Pet Adoption Platform

> Browse pets, adoption process, adopter ↔ shelter messaging, AI pet matching.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win |
|--------|------|-----|---------------------|
| Web: Full-Stack Framework | Major | 2 | Foundation |
| User Mgmt: Standard Auth | Major | 2 | Adopter + shelter profiles |
| User Mgmt: OAuth 2.0 | Minor | 1 | Easy login for adopters |
| User Mgmt: 2FA | Minor | 1 | Shelter admin account security |
| Web: File Upload | Minor | 1 | Pet photos — **essential** feature |
| Web: Notifications | Minor | 1 | Adoption status updates |
| Web: Advanced Search | Minor | 1 | Filter pets by type, age, location |
| Web: ORM | Minor | 1 | Pet/adoption/user data queries |
| A11y: Browser Support | Minor | 1 | Broad community audience uses diverse browsers |
| DevOps: Health Check | Minor | 1 | Easy 1 pt |
| Data: GDPR Compliance | Minor | 1 | PII of adopters — legally required |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort |
|--------|------|-----|--------------------------|
| Web: User Interaction | Major | 2 | Adopter ↔ shelter messaging |
| Web: Public API | Major | 2 | Expose pet listings to external apps |
| AI: Recommendation System | Major | 2 | Match pets to adopter lifestyle preferences |
| User Mgmt: Advanced Permissions | Major | 2 | Shelter admin vs adopter roles |
| User Mgmt: Organization System | Major | 2 | Shelters as organizations |
| Data: Analytics Dashboard | Major | 2 | Adoption success rates, shelter performance |
| AI: Image Recognition | Minor | 1 | Auto-tag pet photos (breed, size, color) |
| A11y: Multiple Languages (i18n) | Minor | 1 | Multicultural adoption communities |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Web: Custom Design System | Minor | 1 | Polished, empathetic UI matters for adoption |
| Web: SSR | Minor | 1 | SEO for pet listing pages |
| Data: Export/Import | Minor | 1 | Bulk import shelter inventory |
| User Mgmt: Activity Analytics | Minor | 1 | Track adoption funnel |
| AI: Content Moderation | Minor | 1 | Moderate user messages |
| Gaming: Advanced Chat | Minor | 1 | Enhanced adopter-shelter messaging |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| Gaming: Web-Based Game | Not core to pet adoption |
| Blockchain: Any | No natural use case |
| AI: Voice/Speech | Not relevant |
| A11y: RTL Support | High effort, moderate benefit |
| DevOps: Microservices | Premature complexity |
| Web: Real-Time WebSockets | Useful but not essential for this platform |

### Recommended Build (25 pts)
```
Web Major:      Full-Stack Framework (2) + User Interaction (2) + Public API (2)  = 6 pts
AI Major:       Recommendation System (2)                                         = 2 pts
User Mgmt:      Standard Auth (2) + Advanced Permissions (2)                      = 4 pts
Data Major:     Analytics Dashboard (2)                                            = 2 pts
Web Minors:     File Upload (1) + Notifications (1) + Advanced Search (1) + ORM (1) = 4 pts
User Mgmt:      OAuth (1) + 2FA (1) + Activity Analytics (1)                      = 3 pts
AI Minor:       Image Recognition (1)                                              = 1 pt
A11y Minors:    Browser Support (1) + i18n (1)                                    = 2 pts
Data Minor:     GDPR (1)                                                           = 1 pt
──────────────────────────────────────────────────────────────────────────────────
TOTAL:                                                                             25 pts
```

---

## Matrix 4 — Card Game Arena

> Multiplayer card games (Poker, Uno, etc.) with tournaments and leaderboards.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win |
|--------|------|-----|---------------------|
| Web: Full-Stack Framework | Major | 2 | Foundation |
| User Mgmt: Standard Auth | Major | 2 | Player profiles, friends, online status |
| User Mgmt: OAuth 2.0 | Minor | 1 | Discord/GitHub login — gaming community |
| User Mgmt: Game Statistics | Minor | 1 | Win rates, hand history — essential |
| Gaming: Tournament System | Minor | 1 | Card game tournaments — core value |
| Gaming: Gamification | Minor | 1 | XP, badges, leaderboard |
| Gaming: Game Customization | Minor | 1 | Rule variants, house rules |
| Web: ORM | Minor | 1 | Game state, card hand storage |
| Web: Notifications | Minor | 1 | "Your turn!" alerts |
| Web: PWA | Minor | 1 | Mobile card game install |
| A11y: Browser Support | Minor | 1 | Gamers use all browsers |
| DevOps: Health Check | Minor | 1 | Easy 1 pt |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort |
|--------|------|-----|--------------------------|
| Web: Real-Time WebSockets | Major | 2 | Card game turn sync — **essential** |
| Web: User Interaction | Major | 2 | Chat + game invitations |
| Gaming: Web-Based Game | Major | 2 | The card game itself |
| Gaming: Remote Players | Major | 2 | Online play — makes it actually usable |
| Gaming: Multiplayer 3+ | Major | 2 | Poker/Uno need 3+ players |
| Gaming: Add Another Game | Major | 2 | Second card game (Poker + Uno) |
| AI: AI Opponent | Major | 2 | AI card game bot (Poker/Uno AI) |
| Data: Analytics Dashboard | Major | 2 | Win rates, tournament stats, peak hours |
| Blockchain: Tournament Scores | Major | 2 | Verifiable card game tournament results |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes |
|--------|------|-----|-------|
| Web: Advanced Search | Minor | 1 | Find games, browse lobbies |
| Gaming: Advanced Chat | Minor | 1 | In-game chat, direct game invitations |
| Gaming: Spectator Mode | Minor | 1 | Watch tournament finals |
| AI: Content Moderation | Minor | 1 | Moderate in-game chat |
| Data: GDPR Compliance | Minor | 1 | User account compliance |
| User Mgmt: 2FA | Minor | 1 | Ranked account security |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| AI: RAG System | No knowledge base in card games |
| AI: LLM Interface | Not core to gameplay |
| Gaming: 3D Graphics | 3D card table is flashy but disproportionate effort |
| A11y: RTL Support | Card layouts complex to mirror |
| DevOps: Microservices | Adds significant complexity |
| Blockchain: ICP Backend | Latency too high for card game sync |
| Web: Collaborative Features | Not applicable to card games |

### Recommended Build (26 pts)
```
Web Major:      Full-Stack Framework (2) + WebSockets (2) + User Interaction (2)  = 6 pts
Gaming Major:   Web Game (2) + Remote Players (2) + Multiplayer 3+ (2)            = 6 pts
AI Major:       AI Opponent (2)                                                    = 2 pts
User Mgmt:      Standard Auth (2) + Game Stats (1) + OAuth (1)                    = 4 pts
Gaming Minors:  Tournament (1) + Gamification (1) + Customization (1)             = 3 pts
Data Major:     Analytics Dashboard (2)                                            = 2 pts
Web Minors:     ORM (1) + Notifications (1) + PWA (1)                             = 3 pts
DevOps Minor:   Health Check (1)                                                   = 1 pt
──────────────────────────────────────────────────────────────────────────────────
TOTAL:                                                                             27 pts
```

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
