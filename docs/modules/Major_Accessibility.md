# Major Modules: Accessibility and Internationalization

> **Points available**: 1 module × 2 pts = **2 points**

## Overview
Accessibility and Internationalization modules ensure your application is usable by everyone — regardless of ability, language, or browser preference. The one Major module here is a significant engineering undertaking that touches every component of your UI.

---

## Modules in This Category

### Module 1: WCAG 2.1 AA Compliance — 2 pts
**Requirements**
- Full compliance with WCAG 2.1 Level AA guidelines.
- Screen reader support (NVDA, VoiceOver, JAWS).
- Complete keyboard navigation (no mouse required).
- Support for assistive technologies (magnifiers, switch devices, etc.).
- Proper semantic HTML, ARIA labels, and focus management.
- Sufficient color contrast ratios (4.5:1 for normal text).

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — but affects every UI component across all modules.

---

## Cross-Domain Analysis

### Web
WCAG compliance must be woven into the web framework from day one. Every React/Vue/Angular component must use semantic HTML. Forms, modals, and dynamic content (WebSocket updates) require ARIA live regions. Retroactively adding accessibility is significantly harder than building it in.

**Key techniques**: `aria-live`, `aria-label`, `role` attributes, focus traps in modals, skip navigation links.

### Accessibility and Internationalization
This IS the accessibility domain. WCAG 2.1 AA is the gold standard. Combined with the i18n Minor module, the platform becomes both accessible and internationally usable — significantly broadening your potential user base.

### User Management
- Profile pages must be navigable by screen readers.
- Login/registration forms need proper label associations and error announcements.
- Avatar upload interface needs keyboard-accessible file input.
- Friend requests and notifications must announce status changes via ARIA live regions.

### Artificial Intelligence
- AI chat interfaces must support screen readers for responses.
- Streaming LLM text must update ARIA live regions without disrupting focus.
- Voice/speech AI module (Minor) pairs naturally with accessibility needs.
- Content moderation AI helps prevent inaccessible user-generated content.

### Cybersecurity
- CAPTCHA systems must provide accessible alternatives (audio CAPTCHA).
- 2FA flows must be keyboard-accessible.
- Security alerts and error messages must be announced to screen readers.

### Gaming and User Experience
This is where WCAG compliance is hardest. Canvas-based games (Pong, Card Games) are notoriously difficult to make accessible. Strategies include:
- Keyboard controls for all game actions.
- Audio cues for game events.
- Reduced-motion settings for animations.
- Non-visual game status announcements.
- Tournament brackets must be navigable without a mouse.

### DevOps
- Automated accessibility testing tools (axe-core, Lighthouse) can be added to CI/CD pipelines.
- Accessibility reports can be generated on each deployment.

### Data and Analytics
- Analytics dashboards with charts must provide accessible data table alternatives.
- Color cannot be the only differentiator in graphs (use patterns, labels).
- Date range pickers must be keyboard-accessible.

### Blockchain
- Blockchain wallet connection UIs (if any) must be keyboard accessible.
- Transaction confirmation dialogs need proper focus management.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WCAG 2.1 AA | ⚠️ Medium | P3 | Games are hard to make accessible; significant effort for 2 pts |

**Assessment**: High effort for a game. Canvas keyboard controls + audio cues are mandatory for compliance. Only if the team has accessible design experience.

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WCAG 2.1 AA | ✅ High | P2 | Educational platforms have a legal/ethical obligation to be accessible |

**Assessment**: Strong fit. Language learning often serves users with learning disabilities. Combined with i18n Minor, adds 3 pts with high social impact.

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WCAG 2.1 AA | ✅ High | P2 | Community platforms benefit greatly from broad accessibility |

**Assessment**: Great fit. Pet photos, forms, and messaging all have clear accessible patterns. Lower complexity than game accessibility.

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WCAG 2.1 AA | ⚠️ Medium | P3 | Card game UI is complex; keyboard card selection needs careful design |

**Assessment**: Achievable with proper focus management on card interactions, but requires significant upfront UI design investment.
