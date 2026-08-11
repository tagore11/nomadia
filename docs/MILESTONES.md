# Nomadia — Phased Roadmap & Milestones

> **Pivot note (2026-07-14):** Phase 0/1 dates and the World App/World ID stack below are historical — the plan they described assumed an April 2026 ZuKaş launch that no longer exists. Current build tracks the 6-week sprint + 90-day GTM plan in the Jul 14 2026 memory entry (Telegram Mini App + Base escrow, Dubai Marina beachhead first, ZuKaş Sep 9–19 second). See `docs/DECISIONS.md` D-012 through D-016. Kept below for historical reference and because the *shape* of the phases (build → controlled beta → expand) still holds.

---

## ETH Global Taipei Prototype — What Already Exists

Before defining what needs to be built, establish the baseline from the ETH Global Taipei 2025 submission:

| Component | Status | Notes |
|---|---|---|
| World App MiniKit integration | Done | App runs inside World App |
| World ID verification flow | Done | User can verify as unique human |
| Basic escrow smart contract | Done | Holds and releases USDC |
| Currency needs input (I have X, I need Y) | Done | Core matching input form |
| Proximity matching (basic) | Done or partial | Needs confirmation |
| Card-based match browsing UI | Done or partial | Needs UX polish |
| In-app meet coordination | Unknown | Likely missing or minimal |
| Mutual confirmation to release escrow | Done or partial | Core flow |
| Reputation / rating system | Missing | Not in prototype |
| Dispute resolution | Missing | Not in prototype |
| Timeout / cancellation flow | Unknown | May be basic |
| TRY-specific support | Unknown | May be USDC-only in prototype |
| Production-grade contract audit | Missing | Prototype only |

Action: Team must review prototype against this table and update statuses before Phase 0 planning begins.

---

## Phase 0 — Pre-ZuKaş: Demo-Ready

**Window:** Now (2026-02-28) → April 9, 2026 (~6 weeks)

**Goal:** Nomadia is stable enough for 150 real users to use with real (small) amounts of money during a 30-day residency. Not production-grade, but not a crash-prone demo.

### Must-Have for April 10

- [ ] **Complete user flow works end-to-end:** World ID verify → post offer → browse matches → select match → escrow deposit → coordinate meet → dual confirm → escrow release
- [ ] **TRY support:** Fiat side of all offers can be denominated in TRY. Amount input, display, and rate reference all handle TRY correctly
- [ ] **Rate reference:** App shows current market rate (TRY/USDC) as a non-binding reference. Users set their own rate. Source: public API (e.g., CoinGecko, Binance ticker)
- [ ] **Timeout / cancellation:** If both parties do not confirm within 2 hours of agreed meeting time, escrow auto-refunds. User sees clear status.
- [ ] **Reputation (basic):** After exchange, both parties rate each other (1–5 stars). Rating is displayed on user profile in match cards. Write-only during Phase 0 — no dispute mechanism yet.
- [ ] **Offer expiry:** Offers older than 24 hours auto-expire and drop off the match feed
- [ ] **Minimum viable notification:** In-app notification (or World App notification if MiniKit supports it) when a new match appears or a match request is received
- [ ] **Error states handled:** Escrow failure, network timeout, no matches available — all show user-friendly messages, not crashes
- [ ] **Testnet → Mainnet migration:** Prototype likely runs on testnet. Identify target mainnet (World Chain or another EVM chain). Deploy escrow contract to mainnet. Test with small real amounts.
- [ ] **Security review (internal):** Team reviews smart contract for obvious attack vectors (reentrancy, overflow, unauthorized release). Full external audit is Phase 2, but internal review is mandatory before real money.

### Nice-to-Have for April 10

- [ ] In-app chat between matched parties (coordinate meeting location/time)
- [ ] "Pro Exchanger" flag for high-volume local liquidity providers (Samir type)
- [ ] Multi-currency crypto support beyond USDC (USDT, ETH)

### Phase 0 Success Metrics

| Metric | Target |
|---|---|
| End-to-end flow stability | Zero critical crashes in 20 internal test runs |
| Escrow contract: internal review | Completed, issues documented |
| Mainnet deployment | Done on target chain |
| World App publication | App accessible to ZuKaş residents via World App link |
| Team onboarding doc | Any ZuKaş volunteer can explain the app in 2 minutes |

---

## Phase 1 — ZuKaş Beta

**Window:** April 10 – May 10, 2026 (30 days)

**Goal:** Real users, real money, real exchanges. Prove that P2P fiat↔crypto exchange works in an IRL concentrated community. Collect data to justify Phase 2 investment.

### Deployment Setup

- [ ] Dedicated ZuKaş onboarding flow: landing page or QR code → "Nomadia for ZuKaş residents" → World App install prompt → verify → first offer
- [ ] KaşAgora `/exchange` page updated with Nomadia link + 2-sentence description
- [ ] Resident onboarding session (Day 1 of residency or pre-arrival): short demo, answer questions, collect World App handles for support

### Operations During Beta

- [ ] Designated Nomadia support contact (Telegram handle) available to residents for issues
- [ ] Daily monitoring: escrow contract balance, pending exchanges stuck in limbo, error logs
- [ ] Manual dispute resolution protocol documented: what happens if one party doesn't show up, what support contact does
- [ ] Weekly pulse check: survey 5–10 users on usability, friction points, trust concerns

### Data Collection

Track every exchange attempt with the following fields (anonymized, nullifier-indexed):

- Offer creation timestamp
- Currency pair and amount
- Time-to-match (offer posted → match accepted)
- Time-to-confirm (match accepted → both confirmed)
- Outcome (completed / cancelled / timed-out / disputed)
- Post-exchange rating (both parties)
- Completion rate per user cohort

### Phase 1 Success Metrics

| Metric | Target |
|---|---|
| Total exchanges completed | 50+ |
| Exchange completion rate | >80% of initiated exchanges |
| Unique users (both sides) | 40+ |
| Average time-to-match | <4 hours |
| Average time-to-confirm | <3 hours after meeting agreed |
| Zero critical security incidents | (escrow never drained incorrectly) |
| User satisfaction (post-exchange survey) | >4.0 / 5.0 average |
| Qualitative feedback sessions | 10+ structured interviews collected |

### Phase 1 Deliverables (for Phase 2 planning)

- Transaction log: all 30 days of exchange data
- User interview synthesis: top 5 friction points, top 3 trust concerns
- Smart contract incident report: zero incidents, or documented incidents with root cause
- Competitive intelligence: did residents use any alternative? What?
- Updated feature backlog ranked by user feedback

---

## Phase 2 — Post-ZuKaş: Iterate and Expand

**Window:** May 2026 – August 2026 (~3 months)

**Goal:** Fix what Phase 1 broke. Harden the product. Deploy to 2–3 additional Zuzalu-network events. Raise a seed round or close a grant using ZuKaş data as proof.

### Technical Priorities (informed by Phase 1 feedback)

- [ ] **Smart contract audit:** Commission external audit firm. Mandatory before expanding user base or increasing transaction limits.
- [ ] **Dispute resolution system:** Formalize what happens in disputes. Options: (a) community arbitration (randomly selected residents), (b) time-based auto-refund with reputation penalty, (c) multi-sig arbitrators
- [ ] **In-app chat:** If not shipped in Phase 0, this is the top Phase 2 UX priority — meeting coordination via external apps (Telegram) is friction
- [ ] **EUR support:** Add EUR as second fiat currency for European Zuzalu events
- [ ] **Multi-currency crypto:** USDT, ETH, WLD on escrow contract
- [ ] **Offer partial fill:** Allow an offer of 200 USDC to be filled by two separate 100 USDC offers from the match side
- [ ] **Reputation portability:** Ensure reputation score follows World ID nullifier across app reinstalls and wallet changes
- [ ] **Gas sponsorship (ERC-4337):** Investigate account abstraction to sponsor gas for users so they don't need native token for gas — removes a common onboarding blocker

### Go-to-Market Priorities

- [ ] Identify next 2–3 Zuzalu-network events (Edge City, ZuConnect, Zuzalu-style residencies) and apply as official/unofficial exchange tool
- [ ] Publish ZuKaş beta results publicly: transaction count, completion rate, user quotes — this is the product's proof-of-work
- [ ] Pitch Glen Weyl (met at ZuKaş) for an endorsement or advisory role — his Plurality/P2P finance credibility is a narrative asset
- [ ] Apply to: Worldcoin grants, Gitcoin, ETH Global follow-on, Optimism RPGF
- [ ] ETH Global follow-on: submit to next applicable hackathon with Phase 1 data as demo

### Phase 2 Success Metrics

| Metric | Target |
|---|---|
| Smart contract audit completed | Yes / No |
| Exchanges at 2nd event | 100+ |
| Cumulative unique users | 150+ across all events |
| EUR fiat support | Live |
| External grant or investment | $50K+ committed |
| Dispute rate | <5% of completed exchanges |
| App store review / World App featured | Initiated |

---

## Phase 3 — Scale

**Window:** September 2026 and beyond

**Goal:** Expand beyond the Zuzalu network to any geography with a mismatch between crypto-native travelers and local fiat supply. Build toward becoming the de facto P2P fiat-onramp layer for the crypto economy.

### Expansion Targets

**User acquisition:**
- Crypto-native conference travelers (Devcon, EthCC, Token2049, Consensus) — same concentrated geography + need pattern as Zuzalu
- Digital nomad hubs (Bali, Chiang Mai, Medellín, Tbilisi) — permanent demand, less event-driven
- Cross-border corridors with high remittance volume and CEX friction (Turkey→Germany, Southeast Asia)

**Supply side (local liquidity):**
- Formal onboarding of "Pro Exchangers" — local operators like Samir who do high volume
- Tiered verification for Pro Exchangers (higher limits, higher visibility, fee sharing)
- Merchant integration: local businesses that accept both cash and crypto can list as exchange points

**Technical:**
- [ ] Native iOS / Android app (World App dependency removed or made optional for non-World-ID jurisdictions)
- [ ] Alternative identity layers for non-World-ID users (Proof of Passport, other ZK identity)
- [ ] Fiat currency coverage: top 20 by remittance volume
- [ ] Liquidity aggregation: allow Pro Exchangers to post standing offers (order-book lite)
- [ ] Cross-chain escrow: user wants to deposit ETH on Ethereum, counterparty wants to receive on Base — atomic cross-chain settlement
- [ ] Regulatory mapping: jurisdiction-by-jurisdiction legal review, P2P exchange classification in key markets

### Phase 3 Success Metrics

| Metric | Target |
|---|---|
| Monthly active users | 10,000+ |
| Monthly exchange volume | $1M+ |
| Fiat currencies supported | 10+ |
| Geographies active | 20+ cities |
| Dispute rate | <2% |
| Pro Exchanger network | 100+ verified operators |
| Protocol revenue (0.5% fee) | $5K+/month |

---

## Summary Timeline

```
Feb 28 – Apr 9   Phase 0: Build & harden for ZuKaş beta
Apr 10 – May 10  Phase 1: ZuKaş live beta (150 users, real money)
May – Aug 2026   Phase 2: Audit, iterate, expand to next events
Sep 2026+        Phase 3: Scale beyond Zuzalu network
```

---

## Open Questions (Blocking Phase 0)

1. Which EVM chain is the mainnet target? (World Chain preferred — aligns with MiniKit ecosystem; Optimism/Base as alternatives)
2. What is the current state of the ETH Global Taipei prototype? Which items in the "What Already Exists" table are actually complete?
3. Who owns smart contract development? Is the prototype contract production-quality or throwaway code?
4. What is the team composition going into Phase 0? Who is responsible for: smart contract, MiniKit frontend, backend/matching, ops during ZuKaş?
5. Is there a budget for Phase 0? (Gas costs on mainnet, potential audit pre-scan, travel to ZuKaş)
