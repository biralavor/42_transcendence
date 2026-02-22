# 42_transcendence

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

## Impact / Effort Matrix

> **Definitions**
> - **Impact** `H`: Module adds high value to this specific project concept
> - **Impact** `L`: Module adds marginal value to this project concept
> - **Effort** `H`: Requires 1+ week of focused development
> - **Effort** `L`: Can be completed in 1–3 days

**Constraint Legend (used in all matrices below)**
- 🔴 Hard constraint — violating it = 0 pts or module rejected
- 🟡 Soft constraint — violating it = evaluation risk or partial rejection

### The Four Quadrants

| | **Effort L** | **Effort H** |
|---|---|---|
| **Impact H** | ✅ **QUICK WINS** — Do these first | ⚡ **MAJOR BETS** — Plan carefully, high return |
| **Impact L** | 🔵 **FILL-INS** — Do if points needed | ❌ **AVOID** — Poor ROI |

---

## Matrix 1 — Pong Game

> Classic Pong with online multiplayer, AI opponent, tournaments, and power-ups.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win | Constraints |
|--------|------|-----|---------------------|-------------|
| Web: Full-Stack Framework | Major | 2 | Foundation — every other module depends on it | None |
| User Mgmt: Standard Auth | Major | 2 | Essential — profiles, friends, online status | None |
| User Mgmt: OAuth 2.0 | Minor | 1 | "Login with 42/GitHub" — a few hours | None |
| User Mgmt: Game Statistics | Minor | 1 | Win/loss tracking — pairs directly with the game | 🔴 Prereq: Web-Based Game |
| User Mgmt: 2FA | Minor | 1 | TOTP library + QR code — low effort | None |
| Gaming: Tournament System | Minor | 1 | Bracket + matchmaking — core Pong feature | 🔴 Prereq: Web-Based Game |
| Gaming: Game Customization | Minor | 1 | Power-ups, ball speed, paddle size | 🔴 Prereq: Web-Based Game |
| Gaming: Gamification | Minor | 1 | XP, badges, leaderboard | None |
| Web: ORM | Minor | 1 | Prisma/TypeORM — clean DB access | None |
| Web: Notifications | Minor | 1 | Game invites, tournament alerts | None |
| Web: PWA | Minor | 1 | Install Pong as mobile app — service worker | None |
| DevOps: Health Check | Minor | 1 | `/health` endpoint + cron backup — ~4 hours | None |
| A11y: Browser Support | Minor | 1 | Test on Firefox + Safari | None |

**Quick Wins Total: 14 pts — minimum passed with quick wins alone!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort | Constraints |
|--------|------|-----|--------------------------|-------------|
| Web: Real-Time WebSockets | Major | 2 | Essential for game sync — but complex to implement right | None |
| Web: User Interaction | Major | 2 | Chat + friends — needed for social game invitations | None — but unlocks Advanced Chat |
| Gaming: Web-Based Game | Major | 2 | The Pong game itself — the core deliverable | None — but unlocks all Gaming deps |
| Gaming: Remote Players | Major | 2 | Online multiplayer — makes Pong actually playable | 🔴 Prereq: Web-Based Game + WebSockets |
| AI: AI Opponent | Major | 2 | Classic Pong AI — must explain during evaluation | 🔴 Prereq: Web-Based Game · 🟡 Eval Demo · 🟡 Must use Customization if implemented |
| Data: Analytics Dashboard | Major | 2 | Game stats visualization — win rates, tournament history | None |
| Blockchain: Tournament Scores | Major | 2 | Immutable tournament leaderboard — impressive tech | 🔴 Prereq: Web-Based Game + Tournament System |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes | Constraints |
|--------|------|-----|-------|-------------|
| Web: Advanced Search | Minor | 1 | Find players by username | None |
| Web: File Upload | Minor | 1 | Avatar uploads only | None |
| Data: GDPR Compliance | Minor | 1 | User data deletion — minimal scope for Pong | None |
| Gaming: Spectator Mode | Minor | 1 | Watch matches live | 🔴 Prereq: Web-Based Game + WebSockets |
| Web: SSR | Minor | 1 | Only if using Next.js/Nuxt.js already | 🔴 Incompatible with ICP Backend |

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

### Recommended Build

> [!TIP]
> **Pong Game — 26 pts**
>
> | Category | Modules | Pts | Constraints |
> |----------|---------|:---:|-------------|
> | Web Major | Full-Stack Framework + WebSockets + User Interaction | 6 | None |
> | Gaming Major | Web Game + Remote Players | 4 | 🔴 Remote Players → needs Web Game + WebSockets |
> | AI Major | AI Opponent | 2 | 🔴 Needs Web Game · 🟡 Eval Demo · 🟡 Must use Customization if implemented |
> | User Mgmt | Standard Auth + OAuth + Game Stats + 2FA | 5 | 🔴 Game Stats → needs Web Game |
> | Gaming Minors | Tournament + Customization + Gamification | 3 | 🔴 Tournament + Customization → need Web Game |
> | Data Major | Analytics Dashboard | 2 | None |
> | Web Minors | ORM + Notifications + PWA | 3 | None |
> | DevOps Minor | Health Check | 1 | None |
> | **TOTAL** | | **26** | |

---

## Matrix 2 — Language Learning Platform

> Lessons, exercises, progress tracking, AI tutor, peer practice sessions.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win | Constraints |
|--------|------|-----|---------------------|-------------|
| Web: Full-Stack Framework | Major | 2 | Foundation | None |
| User Mgmt: Standard Auth | Major | 2 | Student profiles, teacher/student social | None |
| User Mgmt: OAuth 2.0 | Minor | 1 | Easy login for students | None |
| User Mgmt: Activity Analytics | Minor | 1 | Study streaks, lesson completion tracking | None |
| Gaming: Gamification | Minor | 1 | Learning XP, streak badges — Duolingo model | None |
| A11y: Multiple Languages (i18n) | Minor | 1 | A language app MUST be multilingual | 🟡 Min: 3 complete translations |
| A11y: Browser Support | Minor | 1 | Students use all browsers | 🟡 Min: 2 additional browsers |
| Web: ORM | Minor | 1 | Course/lesson data queries | None |
| Web: Notifications | Minor | 1 | Assignment reminders, lesson completion | None |
| DevOps: Health Check | Minor | 1 | Easy 1 pt | None |
| Data: GDPR Compliance | Minor | 1 | Student data protection — legally important | None |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort | Constraints |
|--------|------|-----|--------------------------|-------------|
| User Mgmt: Advanced Permissions | Major | 2 | Teacher vs student vs admin roles | None |
| User Mgmt: Organization System | Major | 2 | Schools, classrooms, study groups | None |
| AI: RAG System | Major | 2 | Answer grammar questions from knowledge base | None |
| AI: LLM Interface | Major | 2 | AI language tutor — conversation practice | None |
| AI: Recommendation System | Major | 2 | Recommend next lessons based on progress | None |
| AI: Voice/Speech | Minor | 1 | Pronunciation practice — core feature for language learning | None |
| Web: User Interaction | Major | 2 | Peer practice chat sessions | None — but unlocks Advanced Chat |
| Web: Real-Time WebSockets | Major | 2 | Live lesson collaboration | None |
| Data: Analytics Dashboard | Major | 2 | Student progress tracking | None |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes | Constraints |
|--------|------|-----|-------|-------------|
| Web: Advanced Search | Minor | 1 | Search vocabulary lists, lessons | None |
| Web: File Upload | Minor | 1 | Audio exercises, lesson documents | None |
| Web: SSR | Minor | 1 | SEO for lesson pages | 🔴 Incompatible with ICP Backend |
| A11y: RTL Support | Minor | 1 | Arabic/Hebrew learners | None |
| Data: Export/Import | Minor | 1 | Import vocabulary lists, export progress | None |
| User Mgmt: 2FA | Minor | 1 | Student account security | None |
| AI: Content Moderation | Minor | 1 | Moderate student submissions | None |
| AI: Sentiment Analysis | Minor | 1 | Detect student frustration in responses | None |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| Gaming: Web-Based Game | Only if vocabulary mini-game is central to concept |
| Blockchain: Any | No natural use case in language learning |
| DevOps: Microservices | Premature for typical team timeline |
| A11y: WCAG 2.1 AA | High effort; forms and lessons are accessible naturally |

### Recommended Build

> [!TIP]
> **Language Learning Platform — 27 pts**
>
> | Category | Modules | Pts | Constraints |
> |----------|---------|:---:|-------------|
> | Web Major | Full-Stack Framework + User Interaction + WebSockets | 6 | None |
> | User Mgmt | Standard Auth + Advanced Permissions | 4 | None |
> | AI Major | RAG System + LLM Interface | 4 | None |
> | Data Major | Analytics Dashboard | 2 | None |
> | User Mgmt Minors | OAuth + Activity Analytics + 2FA | 3 | None |
> | Gaming Minor | Gamification | 1 | None |
> | AI Minors | Voice/Speech + Content Moderation + Sentiment | 3 | None |
> | A11y Minors | i18n + Browser Support | 2 | 🟡 i18n: min 3 languages · 🟡 Browser Support: min 2 browsers |
> | Data Minor | GDPR | 1 | None |
> | DevOps Minor | Health Check | 1 | None |
> | **TOTAL** | | **27** | |

---

## Matrix 3 — Pet Adoption Platform

> Browse pets, adoption process, adopter ↔ shelter messaging, AI pet matching.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win | Constraints |
|--------|------|-----|---------------------|-------------|
| Web: Full-Stack Framework | Major | 2 | Foundation | None |
| User Mgmt: Standard Auth | Major | 2 | Adopter + shelter profiles | None |
| User Mgmt: OAuth 2.0 | Minor | 1 | Easy login for adopters | None |
| User Mgmt: 2FA | Minor | 1 | Shelter admin account security | None |
| Web: File Upload | Minor | 1 | Pet photos — **essential** feature | None |
| Web: Notifications | Minor | 1 | Adoption status updates | None |
| Web: Advanced Search | Minor | 1 | Filter pets by type, age, location | None |
| Web: ORM | Minor | 1 | Pet/adoption/user data queries | None |
| A11y: Browser Support | Minor | 1 | Broad community audience uses diverse browsers | 🟡 Min: 2 additional browsers |
| DevOps: Health Check | Minor | 1 | Easy 1 pt | None |
| Data: GDPR Compliance | Minor | 1 | PII of adopters — legally required | None |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort | Constraints |
|--------|------|-----|--------------------------|-------------|
| Web: User Interaction | Major | 2 | Adopter ↔ shelter messaging | None — but unlocks Advanced Chat |
| Web: Public API | Major | 2 | Expose pet listings to external apps | None |
| AI: Recommendation System | Major | 2 | Match pets to adopter lifestyle preferences | None |
| User Mgmt: Advanced Permissions | Major | 2 | Shelter admin vs adopter roles | None |
| User Mgmt: Organization System | Major | 2 | Shelters as organizations | None |
| Data: Analytics Dashboard | Major | 2 | Adoption success rates, shelter performance | None |
| AI: Image Recognition | Minor | 1 | Auto-tag pet photos (breed, size, color) | None |
| A11y: Multiple Languages (i18n) | Minor | 1 | Multicultural adoption communities | 🟡 Min: 3 complete translations |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes | Constraints |
|--------|------|-----|-------|-------------|
| Web: Custom Design System | Minor | 1 | Polished, empathetic UI matters for adoption | 🟡 Min: 10+ reusable components |
| Web: SSR | Minor | 1 | SEO for pet listing pages | 🔴 Incompatible with ICP Backend |
| Data: Export/Import | Minor | 1 | Bulk import shelter inventory | None |
| User Mgmt: Activity Analytics | Minor | 1 | Track adoption funnel | None |
| AI: Content Moderation | Minor | 1 | Moderate user messages | None |
| Gaming: Advanced Chat | Minor | 1 | Enhanced adopter-shelter messaging | 🔴 Prereq: User Interaction Major (basic chat) |

### Avoid (Low Impact, High Effort)

| Module | Why to skip |
|--------|-------------|
| Gaming: Web-Based Game | Not core to pet adoption |
| Blockchain: Any | No natural use case |
| AI: Voice/Speech | Not relevant |
| A11y: RTL Support | High effort, moderate benefit |
| DevOps: Microservices | Premature complexity |
| Web: Real-Time WebSockets | Useful but not essential for this platform |

### Recommended Build

> [!TIP]
> **Pet Adoption Platform — 25 pts**
>
> | Category | Modules | Pts | Constraints |
> |----------|---------|:---:|-------------|
> | Web Major | Full-Stack Framework + User Interaction + Public API | 6 | None |
> | AI Major | Recommendation System | 2 | None |
> | User Mgmt | Standard Auth + Advanced Permissions | 4 | None |
> | Data Major | Analytics Dashboard | 2 | None |
> | Web Minors | File Upload + Notifications + Advanced Search + ORM | 4 | None |
> | User Mgmt Minors | OAuth + 2FA + Activity Analytics | 3 | None |
> | AI Minor | Image Recognition | 1 | None |
> | A11y Minors | Browser Support + i18n | 2 | 🟡 Browser Support: min 2 browsers · 🟡 i18n: min 3 languages |
> | Data Minor | GDPR | 1 | None |
> | **TOTAL** | | **25** | |

---

## Matrix 4 — Card Game Arena

> Multiplayer card games (Poker, Uno, etc.) with tournaments and leaderboards.

### Quick Wins (High Impact, Low Effort)

| Module | Type | Pts | Why it's a quick win | Constraints |
|--------|------|-----|---------------------|-------------|
| Web: Full-Stack Framework | Major | 2 | Foundation | None |
| User Mgmt: Standard Auth | Major | 2 | Player profiles, friends, online status | None |
| User Mgmt: OAuth 2.0 | Minor | 1 | Discord/GitHub login — gaming community | None |
| User Mgmt: Game Statistics | Minor | 1 | Win rates, hand history — essential | 🔴 Prereq: Web-Based Game |
| Gaming: Tournament System | Minor | 1 | Card game tournaments — core value | 🔴 Prereq: Web-Based Game |
| Gaming: Gamification | Minor | 1 | XP, badges, leaderboard | None |
| Gaming: Game Customization | Minor | 1 | Rule variants, house rules | 🔴 Prereq: Web-Based Game |
| Web: ORM | Minor | 1 | Game state, card hand storage | None |
| Web: Notifications | Minor | 1 | "Your turn!" alerts | None |
| Web: PWA | Minor | 1 | Mobile card game install | None |
| A11y: Browser Support | Minor | 1 | Gamers use all browsers | 🟡 Min: 2 additional browsers |
| DevOps: Health Check | Minor | 1 | Easy 1 pt | None |

**Quick Wins Total: 13 pts — one more module to minimum!**

### Major Bets (High Impact, High Effort)

| Module | Type | Pts | Why it's worth the effort | Constraints |
|--------|------|-----|--------------------------|-------------|
| Web: Real-Time WebSockets | Major | 2 | Card game turn sync — **essential** | None |
| Web: User Interaction | Major | 2 | Chat + game invitations | None — but unlocks Advanced Chat |
| Gaming: Web-Based Game | Major | 2 | The card game itself | None — but unlocks all Gaming deps |
| Gaming: Remote Players | Major | 2 | Online play — makes it actually usable | 🔴 Prereq: Web-Based Game + WebSockets |
| Gaming: Multiplayer 3+ | Major | 2 | Poker/Uno need 3+ players | 🔴 Prereq: Web-Based Game |
| Gaming: Add Another Game | Major | 2 | Second card game (Poker + Uno) | 🔴 Prereq: Web-Based Game |
| AI: AI Opponent | Major | 2 | AI card game bot (Poker/Uno AI) | 🔴 Prereq: Web-Based Game · 🟡 Eval Demo · 🟡 Must use Customization if implemented |
| Data: Analytics Dashboard | Major | 2 | Win rates, tournament stats, peak hours | None |
| Blockchain: Tournament Scores | Major | 2 | Verifiable card game tournament results | 🔴 Prereq: Web-Based Game + Tournament System |

### Fill-ins (Low Impact, Low Effort)

| Module | Type | Pts | Notes | Constraints |
|--------|------|-----|-------|-------------|
| Web: Advanced Search | Minor | 1 | Find games, browse lobbies | None |
| Gaming: Advanced Chat | Minor | 1 | In-game chat, direct game invitations | 🔴 Prereq: User Interaction Major (basic chat) |
| Gaming: Spectator Mode | Minor | 1 | Watch tournament finals | 🔴 Prereq: Web-Based Game + WebSockets |
| AI: Content Moderation | Minor | 1 | Moderate in-game chat | None |
| Data: GDPR Compliance | Minor | 1 | User account compliance | None |
| User Mgmt: 2FA | Minor | 1 | Ranked account security | None |

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

### Recommended Build

> [!TIP]
> **Card Game Arena — 27 pts**
>
> | Category | Modules | Pts | Constraints |
> |----------|---------|:---:|-------------|
> | Web Major | Full-Stack Framework + WebSockets + User Interaction | 6 | None |
> | Gaming Major | Web Game + Remote Players + Multiplayer 3+ | 6 | 🔴 Remote Players → needs Web Game + WebSockets · 🔴 Multiplayer 3+ → needs Web Game |
> | AI Major | AI Opponent | 2 | 🔴 Needs Web Game · 🟡 Eval Demo · 🟡 Must use Customization if implemented |
> | User Mgmt | Standard Auth + Game Stats + OAuth | 4 | 🔴 Game Stats → needs Web Game |
> | Gaming Minors | Tournament + Gamification + Customization | 3 | 🔴 Tournament + Customization → need Web Game |
> | Data Major | Analytics Dashboard | 2 | None |
> | Web Minors | ORM + Notifications + PWA | 3 | None |
> | DevOps Minor | Health Check | 1 | None |
> | **TOTAL** | | **27** | |

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
