# Major Modules: Cybersecurity

> **Points available**: 1 module × 2 pts = **2 points**

## Overview
The Cybersecurity category has one Major module: hardened WAF/ModSecurity combined with HashiCorp Vault for secrets management. This module addresses production-grade security hardening and is relevant to all project types, though it carries significant setup effort.

---

## Modules in This Category

### Module 1: WAF/ModSecurity + HashiCorp Vault — 2 pts
**Requirements**
- Configure strict ModSecurity/WAF rules to filter malicious traffic.
- Manage all secrets (API keys, credentials, environment variables) in HashiCorp Vault.
- Secrets must be encrypted and isolated from application code.
- WAF must actively block common attack patterns (SQLi, XSS, CSRF, etc.).

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| — | None | — |

**Dependencies**: None — works alongside any backend framework.

---

## Cross-Domain Analysis

### Web
- ModSecurity sits in front of your web server (typically Nginx/Apache) as a reverse proxy.
- WAF rules protect all API endpoints defined in the Public API module.
- WebSocket connections need special WAF configuration to allow upgrade headers.
- HashiCorp Vault replaces `.env` file secret storage for production environments.
- All API keys used in integrations (OAuth, LLM, payment) should be stored in Vault.

### Accessibility and Internationalization
- WAF rules should not block legitimate assistive technology requests.
- CAPTCHA alternatives required by WCAG must not be blocked by WAF rate limiting.
- Vault credentials for i18n translation services (DeepL, Google Translate) are securely managed.

### User Management
- OAuth 2.0 tokens and client secrets must be stored in Vault.
- 2FA secret seeds (TOTP) should be stored encrypted — Vault is ideal.
- WAF protects login endpoints from brute force attacks (rate limiting rules).
- WAF can detect credential stuffing patterns.

### Artificial Intelligence
- LLM API keys (OpenAI, Anthropic, etc.) MUST be stored in Vault — prevents key leaks.
- WAF protects AI endpoints from prompt injection attacks via HTTP parameter filtering.
- Rate limiting in WAF prevents AI API cost abuse.
- Vault dynamic secrets can rotate LLM API keys automatically.

### Cybersecurity
This IS the cybersecurity module. Key concepts:
- **Defense in depth**: WAF + application-level validation + Vault = three security layers.
- **Principle of least privilege**: Vault policies restrict which services access which secrets.
- **Zero trust**: Each service authenticates with Vault independently.
- **Audit logging**: Vault logs all secret access — full audit trail.

### Gaming and User Experience
- WAF protects game API endpoints from cheating attempts via malformed requests.
- Rate limiting rules prevent game request flooding (denial of service via game actions).
- Vault stores any third-party gaming service API keys.
- WebSocket connections to game servers need careful WAF configuration.

### DevOps
- HashiCorp Vault integrates naturally with ELK (log WAF events) and Prometheus (monitor Vault health).
- Vault can be deployed as a separate Docker container in your stack.
- ModSecurity configuration can be version-controlled and deployed via CI/CD.
- Vault agent can auto-inject secrets into containers without environment variables.
- Combined with microservices, each service gets its own Vault policy.

### Data and Analytics
- Vault stores database credentials securely (dynamic secrets that rotate automatically).
- WAF logs are a rich data source for security analytics in the ELK stack.
- GDPR compliance (Data Minor) benefits from Vault's encryption and audit logging.

### Blockchain
- Blockchain private keys and mnemonics MUST be stored in Vault (never in `.env` files).
- Avalanche node RPC credentials should be managed via Vault.
- WAF protects blockchain API endpoints from unauthorized calls.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WAF + Vault | ⚠️ Medium | P4 | Security hardening adds professionalism but high setup cost for a game |

**Assessment**: Worth implementing if the team has DevOps experience. 2 pts for ~1 week of infra work.

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WAF + Vault | ✅ High | P3 | Protects student data, secures LLM and translation API keys |

**Assessment**: Strong fit — educational platforms handling user data benefit from WAF + Vault.

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WAF + Vault | ✅ High | P3 | Protects user PII, secures third-party service credentials |

**Assessment**: Good fit — PII protection is important for adoption platforms.

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| WAF + Vault | ⚠️ Medium | P4 | Protects against game cheating via API manipulation |

**Assessment**: Useful for anti-cheat but lower priority than game features.
