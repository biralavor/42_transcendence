# Minor Modules: Web

> **Points available**: 10 modules × 1 pt = **10 points**

## Overview
Web minor modules extend and polish the core web stack. They range from quick wins (ORM, framework singles) to more substantial undertakings (File Upload, Custom Design System). Many are natural complements to the Web Major modules.

---

## Modules in This Category

| Module | Points | Effort | Key Requirement |
|--------|--------|--------|-----------------|
| Frontend Framework | 1 | Low | React, Vue, Angular, Svelte, etc. |
| Backend Framework | 1 | Low | Express, Fastify, NestJS, Django, etc. |
| ORM for Database | 1 | Low | Use any ORM (Prisma, TypeORM, SQLAlchemy) |
| Notification System | 1 | Medium | Notifications for all create/update/delete actions |
| Real-Time Collaborative Features | 1 | High | Shared workspaces, live editing, collaborative drawing |
| Server-Side Rendering (SSR) | 1 | Medium | Improved performance and SEO. **Incompatible with ICP blockchain backend.** |
| Progressive Web App (PWA) | 1 | Low | Offline support and installability |
| Custom Design System | 1 | High | 10+ reusable components, color palette, typography, icons |
| Advanced Search | 1 | Medium | Filters, sorting, pagination |
| File Upload & Management | 1 | Medium | Multi-type uploads, validation, secure storage, preview, delete |

---

## Module Details

### Frontend Framework (1 pt)
Already included if you implement the Full-Stack Framework Major. Only claim separately if using frontend-only without the Major.

### Backend Framework (1 pt)
Already included if you implement the Full-Stack Framework Major. Only claim separately if using backend-only without the Major.

### ORM for Database (1 pt)
Use Prisma, TypeORM, Sequelize, SQLAlchemy, ActiveRecord, etc. Provides type-safe database queries and migration management.

### Notification System (1 pt)
Real-time notifications for user actions: new message, friend request, game challenge, tournament update, etc. Implemented with WebSockets or Server-Sent Events.

### Real-Time Collaborative Features (1 pt)
Shared workspaces, live document editing, collaborative drawing canvas. Requires operational transformation or CRDT for conflict resolution. High effort — only choose if core to your project concept.

### Server-Side Rendering (SSR) (1 pt)
Next.js, Nuxt.js, or SvelteKit. Improves initial load time and SEO. **Warning**: Incompatible with ICP blockchain backend (Minor Blockchain).

### Progressive Web App (PWA) (1 pt)
Service worker for offline caching, Web App Manifest for installability, push notifications. Especially valuable for mobile gaming.

### Custom Design System (1 pt)
Build 10+ reusable components: Button, Input, Modal, Card, Badge, Toast, etc. Must include consistent color palette, typography scale, and icon set.

### Advanced Search (1 pt)
Full-text search with filters (by category, date, type), sorting (by relevance, date, name), and pagination. Elasticsearch or database full-text search.

### File Upload & Management (1 pt)
Support images, documents, audio/video. Client + server validation (type, size, format). Secure storage (local or S3-compatible). Preview, progress bar, delete functionality.

---

## Cross-Domain Analysis

### Web
These modules directly enhance the web tier. ORM simplifies database interactions. Notifications require WebSocket integration. SSR improves performance metrics. The Design System creates a consistent UI across all modules.

### Accessibility and Internationalization
- Notification system must announce via ARIA live regions.
- File upload must have keyboard-accessible controls and clear status messages.
- Design System must build accessibility in from the start (contrast ratios, focus states).
- SSR improves performance for users on slow connections or assistive technologies.
- PWA offline support benefits users with unreliable internet.

### User Management
- Notifications directly support user management events (friend requests, profile updates).
- File Upload is needed for avatar uploads (Standard User Management).
- ORM simplifies user data queries and migrations.
- Advanced Search enables user discovery (find users by name).

### Artificial Intelligence
- File Upload enables training data submission (images for recognition, audio for voice AI).
- Notifications can alert users of AI processing completions.
- Design System provides consistent UI for AI-generated content display.
- Advanced Search can be AI-powered (semantic search using embeddings).

### Cybersecurity
- File Upload MUST validate server-side: file type, size, magic bytes (prevent extension spoofing).
- Uploaded files must be stored outside the web root and served via authenticated URLs.
- SSR pages must sanitize server-rendered data.
- Design System forms must enforce input validation consistently.

### Gaming and User Experience
- Notifications: game challenge received, tournament starting, opponent disconnected.
- PWA: install Pong/Card Game as a mobile app.
- Design System: consistent game UI across all game modes.
- Advanced Search: find players, browse game lobbies.

### DevOps
- File storage may require a separate volume or S3-compatible service (MinIO in Docker).
- SSR apps have different Docker build processes (server + client bundles).
- PWA service workers require HTTPS — ensure SSL in deployment.
- ORM migrations need to run as part of container startup.

### Data and Analytics
- File Upload creates metadata for analytics (upload frequency, file types used).
- Notification analytics (which notifications are most engaged with).
- Advanced Search generates query analytics (what users search for).

### Blockchain
- SSR is **incompatible** with ICP blockchain backend — do not combine.
- File Upload for tournament proof documents or NFT metadata.
- Notification System for blockchain transaction confirmations.

---

## Project Fit Analysis

### 1. Pong Game
**Recommended**: ORM (1pt) + Notifications (1pt) + PWA (1pt) + Advanced Search (1pt) = 4 pts
**Skip**: Collaborative Features, Custom Design System (too heavy for Pong scope)

### 2. Language Learning Platform
**Recommended**: ORM (1pt) + File Upload (1pt) + SSR (1pt) + Notifications (1pt) + Advanced Search (1pt) + Design System (1pt) = 6 pts
**Note**: File Upload essential for audio/video lesson content; SSR great for SEO of lesson pages

### 3. Pet Adoption Platform
**Recommended**: File Upload (1pt) + Notifications (1pt) + Advanced Search (1pt) + Design System (1pt) = 4 pts
**Note**: File Upload is ESSENTIAL for pet photos; Design System creates polished, empathetic UI

### 4. Card Game Arena
**Recommended**: ORM (1pt) + Notifications (1pt) + PWA (1pt) + Advanced Search (1pt) = 4 pts
**Skip**: SSR (games don't need SEO), Collaborative Features (not applicable to card games)
