# Minor Modules: User Management

> **Points available**: 4 modules × 1 pt = **4 points**

## Overview
User Management minor modules enhance the foundational authentication and profile systems. OAuth and 2FA are quick, high-value security wins. Game Statistics is essential for any gaming project. User Activity Analytics adds behavioral insights.

---

## Modules in This Category

| Module | Points | Effort | Key Requirement |
|--------|--------|--------|-----------------|
| Game Statistics & Match History | 1 | Medium | Win/loss tracking, match history, achievements, leaderboard (requires a game) |
| OAuth 2.0 | 1 | Low | Google, GitHub, 42, or other OAuth provider |
| Two-Factor Authentication (2FA) | 1 | Low | TOTP-based 2FA (Google Authenticator compatible) |
| User Activity Analytics Dashboard | 1 | Medium | User engagement metrics and insights |

---

## Module Details

### Game Statistics & Match History (1 pt)
**Requirements**:
- Track user game statistics: wins, losses, ranking, level.
- Display match history: 1v1 games, dates, results, opponents.
- Show achievements and progression milestones.
- Leaderboard integration showing top players.

**Dependencies**: Requires at least one functional game (Gaming Major Module 1).

### OAuth 2.0 (1 pt)
**Requirements**:
- Implement remote authentication with OAuth 2.0.
- Support at least one provider: Google, GitHub, 42 (Intra), Discord, etc.
- Proper token handling and session management.
- Account linking: connect OAuth identity to existing email account.

**Notes**: Use Passport.js (Node.js), python-social-auth, or similar OAuth library. Never implement OAuth from scratch.

### Two-Factor Authentication (1 pt)
**Requirements**:
- TOTP (Time-based One-Time Password) system compatible with Google Authenticator, Authy, etc.
- QR code for easy authenticator app setup.
- Backup codes for account recovery.
- 2FA enrollment, unenrollment, and bypass flows.

**Notes**: Use `speakeasy` (Node.js), `pyotp` (Python), or similar TOTP library.

### User Activity Analytics Dashboard (1 pt)
**Requirements**:
- Track user engagement metrics: login frequency, session duration, feature usage.
- Dashboard displaying activity patterns and trends.
- User segmentation by activity level.

**Notes**: Requires user consent and GDPR compliance consideration.

---

## Cross-Domain Analysis

### Web
- OAuth requires backend callback routes and frontend redirect handling.
- 2FA enrollment flows need modal/dialog UI components (from Design System or custom).
- Game Statistics needs dedicated profile page sections.
- Activity Analytics dashboard integrates with the Analytics Dashboard Major module.

### Accessibility and Internationalization
- OAuth provider buttons must be accessible (labeled, keyboard-navigable).
- 2FA QR codes need accessible alternatives (manual code entry).
- TOTP input fields need proper ARIA labels and error announcements.
- Leaderboards must be accessible data tables, not just visual displays.

### User Management
These minors directly extend the Standard User Management Major:
- OAuth: Alternative login method alongside email/password.
- 2FA: Security enhancement for existing accounts.
- Game Stats: Extends profiles with game history.
- Activity Analytics: Extends user data with behavioral insights.

All four are complementary — implementing all four gives 4 pts of quick wins.

### Artificial Intelligence
- Game Statistics data trains AI Opponent models (difficulty calibration).
- User Activity Analytics provides behavioral signals for Recommendation Systems.
- OAuth identity can link multiple AI interaction histories.
- Activity patterns help AI personalize content timing.

### Cybersecurity
- OAuth tokens must be stored securely (HttpOnly cookies, not localStorage).
- 2FA seed secrets must be encrypted at rest (Vault integration ideal).
- TOTP implementation must handle time drift and replay attacks.
- Backup codes must be hashed like passwords (bcrypt).
- Activity analytics logs are sensitive — apply proper access controls.

### Gaming and User Experience
- Game Statistics is the most directly gaming-relevant module here.
- Leaderboard integration creates competitive motivation.
- Achievement systems (Game Stats) pair with Gamification System (Gaming Minor).
- OAuth with Discord or 42 Intra connects the gaming community.
- Activity analytics reveal when players are most active — optimize matchmaking timing.

### DevOps
- OAuth callback URLs must be configured per environment (dev/prod).
- 2FA secrets encrypted by Vault in production.
- Game statistics queries may need database indexing for leaderboard performance.
- Activity analytics data has storage implications — implement data retention policies.

### Data and Analytics
- User Activity Analytics Minor and Analytics Dashboard Major are natural companions.
- Game Statistics data feeds the Analytics Dashboard.
- GDPR compliance (Data Minor) applies to all user behavioral data.
- Activity data can be exported (Data Export Minor).

### Blockchain
- OAuth identity could be linked to a blockchain wallet address.
- Game Statistics on-chain (Blockchain Major) provides tamper-proof achievement history.
- Activity analytics raises GDPR concerns if stored on immutable blockchain.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Game Statistics | ✅ Essential | P1 | Win/loss tracking is core to competitive Pong |
| OAuth 2.0 | ✅ High | P1 | Easy 1 pt — "Login with 42/GitHub" |
| 2FA | ✅ Medium | P2 | Security credibility |
| Activity Analytics | ⚠️ Low | P4 | Session data less relevant for Pong |

**Recommended**: Game Stats + OAuth + 2FA = 3 pts (quick wins)

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Game Statistics | ❌ Low | — | No games unless mini-games implemented |
| OAuth 2.0 | ✅ High | P1 | Easy login for students |
| 2FA | ✅ Medium | P2 | Student account security |
| Activity Analytics | ✅ Essential | P1 | Track lesson completion, study streaks |

**Recommended**: OAuth + 2FA + Activity Analytics = 3 pts

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Game Statistics | ❌ Low | — | No games |
| OAuth 2.0 | ✅ High | P1 | Easy login for adopters |
| 2FA | ✅ Medium | P2 | Shelter admin account security |
| Activity Analytics | ✅ High | P2 | Track adoption funnel, user engagement |

**Recommended**: OAuth + 2FA + Activity Analytics = 3 pts

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Game Statistics | ✅ Essential | P1 | Win rates, match history, rankings |
| OAuth 2.0 | ✅ High | P1 | Discord OAuth for gaming community |
| 2FA | ✅ Medium | P2 | Ranked account security |
| Activity Analytics | ⚠️ Medium | P3 | Gaming session analytics |

**Recommended**: Game Stats + OAuth + optionally 2FA = 2–3 pts
