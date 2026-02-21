# Major Modules: Blockchain

> **Points available**: 1 module × 2 pts = **2 points**

## Overview
The Blockchain category offers one Major module: storing tournament scores on a blockchain using Avalanche and Solidity smart contracts. This is technically advanced and niche — best suited for game-based projects where immutable, verifiable score records add genuine value.

---

## Modules in This Category

### Module 1: Tournament Scores on Blockchain — 2 pts
**Requirements**
- Use **Avalanche** blockchain (test network) and **Solidity** smart contracts.
- Implement smart contracts to record, manage, and retrieve tournament scores.
- Ensure data integrity and immutability — scores cannot be altered after recording.
- Smart contract deployment and interaction via Web3.js or Ethers.js.

**Dependencies**: Requires a game/tournament to exist (Gaming Major + Tournament Minor).

---

## Cross-Domain Analysis

### Web
- Web3.js or Ethers.js integrates into your frontend framework for wallet connection.
- Smart contract calls are async — handle loading states properly in the UI.
- Public API can expose blockchain score endpoints to external consumers.
- **Note**: SSR (Web Minor) is compatible with this Avalanche/Solidity module (unlike ICP backend).
- WebSockets can stream transaction confirmation events to the UI.

### Accessibility and Internationalization
- Blockchain wallet connection UI (MetaMask prompts) must be keyboard-accessible.
- Transaction status messages must use ARIA live regions.
- Blockchain addresses and hashes need readable alternatives for screen readers.
- i18n support for blockchain-related error messages and status updates.

### User Management
- User wallet addresses link blockchain identities to application profiles.
- Tournament scores are associated with user accounts AND on-chain addresses.
- Advanced Permissions: only tournament organizers should be able to finalize and record scores.
- Users can view their immutable score history via blockchain explorer links.

### Artificial Intelligence
- Low direct synergy — AI systems do not typically interact with blockchain.
- AI could theoretically validate game results before blockchain submission.
- Recommendation systems could use on-chain win history as an input signal.

### Cybersecurity
- Smart contract private keys MUST be stored in HashiCorp Vault (Cybersecurity Major).
- Smart contracts must be audited for common vulnerabilities: reentrancy, integer overflow, access control.
- Never expose wallet private keys in frontend code.
- Use test networks (Fuji testnet for Avalanche) — never real money.
- Rate limit blockchain write operations to prevent spam.

### Gaming and User Experience
- Primary use case: recording tournament results on-chain.
- Players can verify their tournament scores are authentic and unmodified.
- Tournament brackets become permanently recorded history.
- Blockchain adds a layer of trust for competitive gaming — cheating is detectable.
- Works best with: Tournament System (Minor) + Gaming Web-Based Game (Major).

### DevOps
- Avalanche node interaction (RPC endpoints) can be monitored via Prometheus.
- Smart contract deployment scripts should be version-controlled.
- Blockchain transaction logs should flow into ELK for audit trails.
- Testnet faucet credentials managed in Vault.

### Data and Analytics
- On-chain data is publicly queryable — analytics can read from blockchain directly.
- Tournament score history from blockchain feeds into the Analytics Dashboard.
- Transaction costs (gas fees) are trackable data points.
- GDPR note: blockchain data is immutable — personal data on-chain creates compliance complexity.

### Blockchain
This is the core Blockchain Major module. Regarding the Minor:
- **ICP Backend (Minor)**: Completely separate technology. **Incompatible with SSR**.
- **Recommendation**: Choose EITHER this Avalanche Major OR ICP Minor — they solve different problems and combining them doubles blockchain complexity for marginal benefit.

---

## Project Fit Analysis

### 1. Pong Game
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Tournament Scores on Blockchain | ✅ High | P3 | Immutable Pong tournament history — technically impressive |

**Recommended**: Add if team has blockchain interest. Requires Tournament Minor first. (2 pts)

### 2. Language Learning Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Tournament Scores on Blockchain | ❌ Low | — | No tournament structure in a learning platform |

**Recommended**: Skip — no natural use case. Points better spent on AI/Data modules.

### 3. Pet Adoption Platform
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Tournament Scores on Blockchain | ❌ Low | — | No tournament structure in adoption platform |

**Recommended**: Skip — no natural use case.

### 4. Card Game Arena
| Module | Fit | Priority | Reason |
|--------|-----|----------|--------|
| Tournament Scores on Blockchain | ✅ High | P3 | Verifiable card game tournament results on-chain |

**Recommended**: Add if team wants blockchain exposure. Pairs with Tournament Minor. (2 pts)
