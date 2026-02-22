# Minor Modules: Artificial Intelligence

> **Points available**: 4 modules × 1 pt = **4 points**

## Overview
AI minor modules add focused intelligence features without the full complexity of Major AI modules. Content moderation, voice integration, sentiment analysis, and image recognition each address specific use cases and pair well with projects that have rich user-generated content.

---

## Modules in This Category

| Module | Points | Effort | Key Requirement |
|--------|--------|--------|-----------------|
| Content Moderation AI | 1 | Medium | Auto moderation, deletion, and warning for inappropriate content |
| Voice/Speech Integration | 1 | Medium | Voice input or text-to-speech for accessibility or interaction |
| Sentiment Analysis | 1 | Low | Analyze sentiment in user-generated content |
| Image Recognition & Tagging | 1 | Medium | Automatically tag and categorize uploaded images |

---

## Module Details

### Content Moderation AI (1 pt)
**Requirements**:
- Auto-moderate user-generated content (chat messages, comments, posts).
- Auto-deletion or flagging of content that violates rules.
- Auto-warning system for borderline content.
- Human moderator override capability.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Implementation options**: OpenAI Moderation API, Perspective API (Google), or custom classifier.

### Voice/Speech Integration (1 pt)
**Requirements**:
- Voice input: speech-to-text for user interaction.
- OR Text-to-speech: convert text content to audio for accessibility or interaction.
- Proper error handling for unsupported browsers.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Implementation options**: Web Speech API (browser-native), Google Cloud Speech, Azure Speech, Whisper API.

### Sentiment Analysis (1 pt)
**Requirements**:
- Analyze the emotional tone of user-generated content (positive/negative/neutral).
- Surface insights in the admin dashboard or user profile.
- Support for at least one language (English minimum).

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Implementation options**: VADER, TextBlob (Python), Transformers sentiment model, or OpenAI API.

### Image Recognition & Tagging (1 pt)
**Requirements**:
- Automatically analyze uploaded images and generate descriptive tags.
- Tag system persists to database and is searchable.
- Display recognized tags on image/content.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Implementation options**: Google Cloud Vision API, AWS Rekognition, Azure Computer Vision, CLIP model.

---

## Cross-Domain Analysis

### Web
- Content Moderation integrates with the chat system (User Interaction Major) and notification system.
- Voice integration works with the Web Speech API — no backend needed for basic use.
- Image recognition tags feed into the Advanced Search (Web Minor) for visual search.
- Sentiment scores can trigger notifications to moderators.

### Accessibility and Internationalization
- Voice/Speech is a direct accessibility enhancement — motor-impaired users benefit greatly.
- Text-to-speech makes content accessible to visually impaired users.
- Image recognition auto-generates alt text for uploaded images (aids WCAG compliance!).
- Content moderation must handle multiple languages (i18n Minor).

### User Management
- Content moderation protects all user social interactions.
- Sentiment of user activity can feed into User Activity Analytics.
- Image recognition on avatar uploads can flag inappropriate profile pictures.
- Voice integration enables voice-based login alternatives (experimental).

### Artificial Intelligence
These minors complement the AI Majors:
- Content Moderation + LLM Interface = safer AI-generated content pipeline.
- Image Recognition + RAG = visual knowledge base queries.
- Sentiment + Recommendation = emotion-aware content recommendations.
- Voice + LLM = full conversational AI interface.

### Cybersecurity
- Content Moderation is a security feature — prevents harassment and spam.
- AI moderation APIs receive user content — ensure HTTPS and minimal data retention.
- Image uploads for recognition must still be validated server-side (don't trust AI to catch malware).
- Voice recordings are sensitive data — apply GDPR compliance.

### Gaming and User Experience
- Content Moderation: automatically moderate in-game chat.
- Voice: game narration or voice commands.
- Sentiment: detect frustrated/toxic players and intervene.
- Image Recognition: auto-tag game screenshots, user-uploaded content.

### DevOps
- External AI APIs (Google, Azure, OpenAI) need API keys in Vault (Cybersecurity Major).
- Prometheus monitors AI API call latency and error rates.
- ELK logs AI moderation decisions for audit and model improvement.

### Data and Analytics
- Sentiment trends over time are compelling analytics content.
- Moderation action logs feed security analytics.
- Image tag distribution shows popular content themes.
- Voice usage metrics (feature adoption rate).

### Blockchain
- Moderation decisions logged on-chain provide tamper-proof audit trails.
- Image recognition can verify legitimate tournament screenshots.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Content Moderation | ✅ Medium | P3 | Moderate Pong game chat |
| Voice/Speech | ⚠️ Low | P4 | Voice commands for game — niche |
| Sentiment Analysis | ❌ Low | — | Minimal chat content in Pong |
| Image Recognition | ❌ Low | — | No user images in core Pong |

**Recommended**: Content Moderation if chat is prominent (1 pt)

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Content Moderation | ✅ High | P2 | Moderate student submissions |
| Voice/Speech | ✅ Essential | P1 | Language learning requires pronunciation practice |
| Sentiment Analysis | ✅ High | P2 | Analyze student confidence/frustration |
| Image Recognition | ⚠️ Medium | P3 | Tag educational images/flashcards |

**Recommended**: Voice + Content Moderation + Sentiment = 3 pts (AI-native learning platform)

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Content Moderation | ✅ High | P2 | Moderate user messages and listings |
| Voice/Speech | ❌ Low | — | Not relevant to pet adoption |
| Sentiment Analysis | ✅ Medium | P3 | Analyze adoption inquiry sentiments |
| Image Recognition | ✅ Essential | P1 | Auto-tag pet photos (breed, age, size) |

**Recommended**: Image Recognition + Content Moderation = 2 pts (directly useful)

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Content Moderation | ✅ High | P2 | Moderate in-game chat and player names |
| Voice/Speech | ⚠️ Low | P4 | Game narration is niche |
| Sentiment Analysis | ✅ Medium | P3 | Detect toxic player behavior |
| Image Recognition | ❌ Low | — | No user images in core card game |

**Recommended**: Content Moderation + optionally Sentiment = 1–2 pts
