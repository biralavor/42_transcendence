# Major Modules: Artificial Intelligence

> **Points available**: 4 modules × 2 pts = **8 points**

## Overview
AI modules span from game opponents to full LLM integrations and machine learning recommendation engines. They add significant technical depth but carry high implementation effort. Choose based on your project type — not all AI modules are equally relevant to all projects.

---

## Modules in This Category

### Module 1: AI Opponent — 2 pts
**Requirements**
- Challenging AI that can win occasionally (not perfect play).
- Simulates human-like behavior with mistakes and variability.
- Must support game customization options if they are implemented.
- You must be able to explain your AI implementation during evaluation.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| 🔴 Hard Prerequisite | At least one game (Gaming Major: Web-Based Game) must be implemented first | 0 pts |
| 🟡 Evaluation Demo | Must explain AI implementation to evaluator during defense | Fail at evaluation |
| 🟡 Cross-module Dependency | If Game Customization (Gaming Minor) is implemented, AI must be able to use the customized settings | Partial rejection |

**Dependencies**: Requires at least one game implemented first (Gaming Major).

---

### Module 2: RAG System (Retrieval-Augmented Generation) — 2 pts
**Requirements**
- Interact with a large dataset of information.
- Users can ask questions and receive contextually relevant answers.
- Implement proper context retrieval and response generation pipeline.
- Integrate a vector database or similar retrieval mechanism.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — but benefits from a chat interface (User Interaction Major).

---

### Module 3: LLM System Interface — 2 pts
**Requirements**
- Generate text and/or images based on user input.
- Handle streaming responses properly (token-by-token display).
- Implement error handling and rate limiting for API calls.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — but requires WebSockets for streaming responses.

---

### Module 4: Recommendation System — 2 pts
**Requirements**
- Personalized recommendations based on user behavior and history.
- Collaborative filtering OR content-based filtering approach.
- System continuously improves recommendations over time.
- Must demonstrate measurable personalization.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: Requires sufficient user data — needs Standard User Management.

---

## Cross-Domain Analysis

### Web
- WebSockets (Web Major) are **essential** for streaming LLM responses token-by-token.
- The chat interface (User Interaction Major) is the natural UI for RAG and LLM interactions.
- Public API (Web Major) can expose AI endpoints to external consumers.
- The recommendation system feeds data back into the web UI for personalized content display.

### Accessibility and Internationalization
- AI-generated content must be accessible (screen reader compatible).
- Streaming text updates must use ARIA live regions for screen reader announcements.
- Voice/speech integration (AI Minor) naturally pairs with WCAG compliance.
- Multilingual AI responses support the i18n Minor module.
- Sentiment analysis (AI Minor) can detect and flag content in any language.

### User Management
- The Recommendation System requires user behavioral data — deep integration with Standard User Management.
- AI Opponent player history integrates with Game Statistics (User Management Minor).
- Content Moderation AI protects social features built around User Management.
- User activity analytics (User Management Minor) can feed ML training data.

### Artificial Intelligence
All four AI Majors can be combined strategically:
- **AI Opponent + RAG**: Game platform with AI assistant explaining rules/strategy.
- **LLM + Recommendation**: Content platform with AI-generated and AI-curated content.
- **RAG + Recommendation**: Learning platform with intelligent content discovery.

### Cybersecurity
- LLM API keys MUST be stored in environment variables or HashiCorp Vault (Cybersecurity Major).
- Rate limiting is mandatory for LLM endpoints to prevent API cost abuse.
- AI-generated content must be sanitized before display (prompt injection risks).
- RAG systems must validate and sanitize retrieved content before returning to users.

### Gaming and User Experience
- AI Opponent is the most directly relevant AI module for gaming projects.
- Game analytics data (match outcomes, strategies) can train better AI opponents over time.
- Spectator mode (Gaming Minor) could include AI commentary powered by LLM.
- Gamification rewards (Gaming Minor) can be personalized by the Recommendation System.

### DevOps
- LLM API integrations need proper secret management (HashiCorp Vault).
- AI inference can be resource-intensive — monitor with Prometheus/Grafana (DevOps Major).
- RAG vector databases (Pinecone, Weaviate, pgvector) need dedicated containers.
- Model versioning and A/B testing requires microservices architecture (DevOps Major).

### Data and Analytics
- AI outputs are rich analytics data — what users ask, what recommendations they click.
- Analytics Dashboard (Data Major) can visualize AI usage patterns.
- Recommendation system CTR/engagement metrics feed into analytics.
- RAG query logs provide insight into user knowledge gaps.

### Blockchain
- AI decisions (game outcomes, content moderation) could be logged on blockchain for auditability.
- Generally low synergy between AI modules and Blockchain for typical student projects.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| AI Opponent | ✅ Essential | P1 | Classic Pong AI — high value, clear scope |
| RAG System | ❌ Low | — | No knowledge base in Pong |
| LLM Interface | ❌ Low | — | Not relevant to Pong gameplay |
| Recommendation System | ❌ Low | — | Minimal user data, low ROI |

**Recommended**: AI Opponent only (2 pts) — perfect match, well-defined scope

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| AI Opponent | ❌ Low | — | No games in core platform |
| RAG System | ✅ Essential | P1 | Answer grammar questions from knowledge base |
| LLM Interface | ✅ High | P2 | AI language tutor, conversation practice |
| Recommendation System | ✅ High | P2 | Recommend next lessons based on progress |

**Recommended**: RAG + LLM + Recommendation = 6 pts (AI-native platform)

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| AI Opponent | ❌ Low | — | Not applicable |
| RAG System | ✅ High | P2 | Answer pet care questions from knowledge base |
| LLM Interface | ⚠️ Medium | P3 | AI adoption advisor chatbot |
| Recommendation System | ✅ Essential | P1 | Match pets to adopter lifestyle |

**Recommended**: Recommendation + RAG = 4 pts (intelligent matching platform)

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| AI Opponent | ✅ Essential | P1 | AI card game opponent (Poker bot, Uno AI) |
| RAG System | ⚠️ Low | — | Game rules RAG is marginal |
| LLM Interface | ❌ Low | — | Not core to card game experience |
| Recommendation System | ⚠️ Medium | P3 | Recommend game modes or opponents |

**Recommended**: AI Opponent (2 pts) — focused and high-quality implementation
