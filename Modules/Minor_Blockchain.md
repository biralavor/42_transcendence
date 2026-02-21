# Minor Modules: Blockchain

> **Points available**: 1 module × 1 pt = **1 point**

## Overview
The Blockchain minor offers ICP (Internet Computer Protocol) as an alternative backend running on a blockchain. It is architecturally very different from the Major Blockchain module (Avalanche + Solidity). Critical constraint: **incompatible with SSR (Server-Side Rendering)**.

---

## Modules in This Category

| Module | Points | Effort | Key Requirement |
|--------|--------|--------|-----------------|
| ICP Backend | 1 | Very High | Backend running on Internet Computer Protocol. **Incompatible with SSR.** |

---

## Module Details

### ICP Backend (Internet Computer Protocol) (1 pt)
**Requirements**:
- Use Internet Computer Protocol (ICP) for a backend that runs on the blockchain.
- Deploy backend logic as "canisters" (ICP's smart contract equivalent).
- Interact with the ICP canister from the frontend via the `@dfinity/agent` library.

**Critical Constraint**: **Incompatible with Server-Side Rendering (SSR)**. Do not combine with the SSR Web Minor module.

**Major Constraints**
| Type | Constraint | Risk if Violated |
|------|-----------|-----------------|
| 🔴 Hard Incompatibility | Cannot combine with SSR (Web Minor) | Both modules at risk |

**Implementation notes**:
- ICP uses Motoko or Rust for canister development.
- Completely different paradigm from traditional backend frameworks.
- Canisters provide persistent storage on the blockchain.
- Much higher learning curve than standard web backend.
- Deploy via `dfx` CLI tool.

---

## Cross-Domain Analysis

### Web
- ICP replaces the traditional backend framework entirely.
- Frontend interacts with ICP via `@dfinity/agent` JavaScript library.
- **INCOMPATIBLE with SSR** (Web Minor) — do not combine.
- REST API patterns are replaced by ICP's actor model and async calls.
- Real-time features on ICP are handled differently (polling or ICP notification system).

### Accessibility and Internationalization
- ICP doesn't directly affect accessibility — UI is still your frontend responsibility.
- RTL support is compatible with ICP backend.
- i18n is handled at the frontend level — ICP backend serves language-agnostic data.

### User Management
- User authentication on ICP uses Internet Identity (ICP's native auth) — WebAuthn-based, passwordless.
- Traditional OAuth/2FA modules need adaptation for ICP's auth model.
- User data stored in canisters is persistent and decentralized.

### Artificial Intelligence
- HTTP outcalls (ICP feature) allow canisters to call external AI APIs, but with latency.
- AI logic on ICP would run in Motoko/Rust canisters — complex to implement.
- Generally low synergy between ICP backend and typical AI module implementations.

### Cybersecurity
- ICP's decentralized nature provides inherent resistance to single-point-of-failure attacks.
- No traditional server to hack — but canister logic bugs are on-chain and immutable.
- HashiCorp Vault (Cybersecurity Major) is less relevant — ICP uses on-chain storage.
- WAF/ModSecurity is not applicable to ICP canister endpoints.

### Gaming and User Experience
- Game state on ICP would have higher latency than traditional WebSocket game servers.
- **Not recommended** as the primary backend for real-time multiplayer games.
- Suitable for turn-based games where latency tolerance is higher (Chess, Poker turns).
- Tournament result recording on ICP is an alternative to the Avalanche/Solidity Major.

### DevOps
- ICP deployment is fundamentally different — no Docker containers, no traditional servers.
- Canister deployment via `dfx` CLI tool.
- Prometheus/Grafana monitoring applies to the frontend, not the ICP backend.
- ELK log aggregation applies to frontend only.

### Data and Analytics
- Data stored in ICP canisters is publicly queryable on the blockchain.
- GDPR compliance is complex with ICP — on-chain data deletion is challenging.
- Data export from canisters requires canister-level export logic.

### Blockchain
- This IS the Blockchain minor module.
- **Incompatible with SSR** (Web Minor) — do not combine.
- Can technically coexist with Avalanche/Solidity Major but doubles blockchain complexity.
- **Recommendation**: Choose EITHER this ICP Minor OR the Avalanche Major — not both.

---

## Project Fit Analysis

### All Projects — Honest Assessment

| Project | Fit | Recommendation |
|---------|-----|----------------|
| Pong Game | ❌ Low | Real-time Pong requires low-latency backend — ICP adds latency |
| Language Learning | ❌ Low | Unusual choice, high learning curve, minimal benefit |
| Pet Adoption | ⚠️ Low | Decentralized pet listings is a concept, but extremely high effort |
| Card Game Arena | ⚠️ Low | Turn-based games tolerate ICP latency better, but still high effort |

**Overall Assessment**: This minor has the worst effort-to-points ratio in the catalog.

- **Effort**: 1–2 weeks learning Motoko/Rust + ICP architecture.
- **Reward**: 1 pt.
- **ROI**: Very poor.

**Only choose if**: Your team specifically wants blockchain development experience AND none of your modules require SSR AND you have a team member who already knows Motoko or Rust.

For comparison, the Health Check Minor (DevOps) gives the same 1 pt for ~4 hours of work.
