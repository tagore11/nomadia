# Nomadia — Architecture & Product Decisions

This file records locked decisions for Nomadia. Once a decision is recorded here, it should not be reversed without a formal discussion and a new entry documenting the change and reasoning.

Format: `D-NNN | DECISION TITLE | Status | Date | Rationale`

---

## Locked Decisions

---

### D-001 — World App (MiniKit) as First Platform

**Status:** Superseded by [[D-012]] (2026-07-14)
**Date:** 2025 (ETH Global Taipei)

**Decision:** Nomadia's first client is a World App mini-app built with Worldcoin MiniKit. Native iOS/Android apps are out of scope until after ZuKaş beta.

**Rationale:**
- World App provides built-in World ID — the sybil resistance mechanism that makes P2P trust possible
- MiniKit dramatically reduces distribution friction: no App Store submission, no separate wallet setup
- World App's existing user base (tens of millions) is the target demographic: crypto-native, mobile-first
- ETH Global Taipei prototype was already built on this stack; switching would require full rebuild

**Constraints this creates:**
- Users must have World App installed and verified
- UI must conform to MiniKit component constraints
- Cannot target non-World-App users until a second client is built

---

### D-002 — Escrow Smart Contract Holds Crypto Until IRL Exchange Confirmed

**Status:** Locked
**Date:** 2025 (ETH Global Taipei)

**Decision:** All crypto in a pending exchange is locked in a Nomadia-controlled escrow smart contract. Funds are only released when both parties submit in-app confirmation of successful exchange, or refunded after a timeout if confirmation is not received.

**Rationale:**
- This is the only mechanism that gives the fiat-providing party credible assurance the crypto exists and will be delivered
- Eliminates the "run with the cash" attack vector on the crypto side
- Smart contract release is trustless — Nomadia the company cannot steal or freeze funds beyond the timeout mechanism
- A centralized escrow (Nomadia holds keys) would introduce custodial risk and regulatory liability

**Constraints this creates:**
- Requires on-chain transaction to initiate every exchange (gas costs)
- Timeout logic must be carefully tuned (too short = bad UX; too long = capital lockup)
- Contract must be audited before mainnet with real funds
- Fiat leg remains unenforceable on-chain — reputation + World ID is the deterrent, not code

---

### D-003 — ZuKaş 2026 Is the Beta Launch Environment

**Status:** Superseded by [[D-015]] (2026-07-14)
**Date:** 2026-02-28

**Decision:** Nomadia's first real-world deployment with live users and live funds is the ZuKaş 2026 residency (April 10 – May 10, Kaş, Turkey). The 150 Genesis Node residents are the beta user base.

**Rationale:**
- Controlled environment: known user count, known timeframe, geographic concentration
- Acute product-market fit: residents genuinely need TRY↔crypto exchange with no existing local infrastructure
- High trust network: social accountability within residency reduces bad actor risk during unaudited beta
- Advisory opportunity: Glen Weyl and Michel Bauwens in attendance — direct product feedback from governance/commons experts
- Data target: 50+ completed exchanges during 30-day residency

**Constraints this creates:**
- Hard deadline: demo-ready by April 10, 2026
- Must support TRY as primary fiat currency at launch
- App must function with limited or unreliable mobile data (Kaş connectivity is variable)

---

### D-004 — Tinder-Style Proximity Matching UX

**Status:** Locked
**Date:** 2025 (ETH Global Taipei)

**Decision:** The primary matching interface is a swipe-based or card-stack UX showing nearby users with compatible currency needs. Users browse potential matches and initiate contact; it is not an order-book or auction interface.

**Rationale:**
- Order books require liquidity depth that doesn't exist at beta scale
- Card-based matching is intuitive, low-learning-curve for non-crypto users (local fiat providers may not be crypto-native)
- Emphasizes the human-to-human nature of the exchange — this is the product differentiator
- Reduces cognitive load: user does not need to understand spreads or bid/ask

**Constraints this creates:**
- Match quality depends on user density — works in ZuKaş concentrated environment, may not work in sparse geographies
- Must handle the "empty market" problem gracefully (no matches available)
- Requires careful UX for negotiating amounts when they don't match exactly (e.g., I need 200 USDC, you offer 100 USDC)

---

### D-005 — P2P Only — Nomadia Never Holds Funds as Principal

**Status:** Locked
**Date:** 2025 (ETH Global Taipei)

**Decision:** Nomadia is a protocol, not a counterparty. The escrow contract holds user funds temporarily but Nomadia as an entity never takes a position, never acts as market maker, and never intermediates exchanges using its own capital.

**Rationale:**
- Acting as a principal (market maker, exchanger) triggers money transmission licensing requirements in most jurisdictions
- P2P framing keeps regulatory profile as a software/protocol company, not a financial institution
- Aligns with the ethos of the user base (decentralization, self-custody, P2P)
- Eliminates liquidity risk for the company

**Constraints this creates:**
- Cannot guarantee liquidity — if no match exists, user cannot exchange
- Cannot offer guaranteed rates — rates are whatever two parties agree to
- Matching algorithm must not be so aggressive that it resembles brokerage

---

### D-006 — Nomadia Is a Standalone Product, Separate from ZuKaş Brand

**Status:** Locked
**Date:** 2026-02-28

**Decision:** Nomadia is developed, marketed, and deployed as an independent product. It is not co-branded with ZuKaş, KaşAgora, or web3metahub. ZuKaş is a go-to-market venue, not a brand partnership.

**Rationale:**
- Nomadia has independent commercial life beyond any single event
- Co-branding with ZuKaş would confuse investors, future users, and press
- ZuKaş brand is already complex (governance/philosophy focus); adding a fintech product dilutes both
- Keeps grant applications, fundraising, and team composition cleanly separate

**Constraints this creates:**
- Nomadia onboarding materials cannot assume ZuKaş context
- App store listing (when applicable) must stand on its own
- ZuKaş residents discover Nomadia through KaşAgora soft link and word-of-mouth, not through official ZuKaş channels

---

### D-007 — KaşAgora /exchange Page Is a Soft Integration (Link Only)

**Status:** Locked
**Date:** 2026-02-28

**Decision:** The `/exchange` page of KaşAgora will surface Nomadia as a recommended tool via a link or embedded widget. There is no deep technical integration (no shared auth, no shared data, no API calls between the two apps).

**Rationale:**
- Deep integration creates coupling between two separate projects with different development velocities
- KaşAgora is a standalone community app; embedding a financial protocol creates liability surface
- A link is sufficient for discovery at ZuKaş scale — users can open Nomadia in World App from there
- Keeps both codebases independently deployable and maintainable

**Constraints this creates:**
- KaşAgora cannot show real-time Nomadia exchange rates or match availability
- Any Nomadia-specific context must be communicated at the Nomadia app level, not via KaşAgora

---

### D-008 — World ID Is the Only Identity Layer; No Additional KYC

**Status:** Superseded by [[D-014]] (2026-07-14)
**Date:** 2025 (ETH Global Taipei)

**Decision:** World ID verification (proof of unique human) is necessary and sufficient for using Nomadia. No government ID, phone number, email, or additional KYC is required or collected.

**Rationale:**
- Additional KYC would disqualify the core use case (crypto-native traveler without local ID)
- World ID provides sybil resistance without revealing identity — optimal privacy/trust tradeoff
- Collecting PII creates regulatory obligations and security liability
- Consistent with the P2P / non-custodial positioning (D-005)

**Constraints this creates:**
- Availability limited to countries/regions where World ID orb verification is accessible
- Cannot recover accounts via identity documents if World ID is lost/compromised
- Regulatory grey area in some jurisdictions — legal review needed before scaling

---

### D-009 — Reputation Score Is Linked to World ID Nullifier, Not Wallet Address

**Status:** Superseded by [[D-014]] (2026-07-14)
**Date:** 2026-02-28

**Decision:** User reputation (exchange history, ratings, completion rate) is indexed to the World ID nullifier for the Nomadia app, not to a wallet address. Users can use different wallets over time without losing reputation.

**Rationale:**
- Wallet addresses are rotatable — a bad actor can abandon a wallet with negative reputation and start fresh
- World ID nullifier is unique-per-human-per-app: it cannot be reused, but it does not reveal the user's identity
- Reputation is the primary trust mechanism for the fiat leg (D-002 covers crypto leg); it must be durable

**Constraints this creates:**
- Reputation data must be stored off-chain or in a separate contract indexed by nullifier (not wallet)
- If a user re-verifies with a new World ID (edge case), they lose reputation history — acceptable tradeoff

---

### D-010 — TRY Is the Launch Fiat Currency; EUR and Other Currencies Added Post-Beta

**Status:** Superseded by [[D-015]] (2026-07-14)
**Date:** 2026-02-28

**Decision:** At ZuKaş launch, Nomadia supports only TRY as the fiat side of exchanges. Crypto side supports USDC, USDT, ETH, WLD. EUR, GBP, and other fiat currencies are Phase 2.

**Rationale:**
- Kaş, Turkey is the beta environment — TRY is the only local currency needed
- Supporting multiple fiat currencies at launch adds matching complexity with no benefit at beta scale
- EUR would be needed if the app expands to other Zuzalu-network events in Europe (Phase 2 target)
- Scoping fiat to one currency simplifies testing, dispute resolution, and rate reference data

**Constraints this creates:**
- Matching algorithm only needs to solve TRY↔crypto at launch
- Rate reference (for "fair rate" guidance in the app) only needs a single TRY/USD oracle

---

### D-011 — Zero Protocol Fees During ZuKaş Beta

**Status:** Superseded by [[D-016]] (2026-07-14)
**Date:** 2026-02-28

**Decision:** Nomadia charges no protocol fee during the ZuKaş 2026 residency (April 10 – May 10). Gas costs are borne by users. Fee model is introduced in Phase 2.

**Rationale:**
- Beta users are doing Nomadia a favor by using an unaudited product with real money
- Charging fees before the contract is audited creates ethical and legal exposure
- Zero fees removes one barrier to first-time use during the critical initial adoption window
- Data collected during fee-free beta is still valuable for proving the model

**Constraints this creates:**
- No revenue during beta — must be funded by team or grant
- Fee introduction in Phase 2 may cause churn among early users — must be communicated clearly in advance

---

## Pivot — 2026-07-14

Five months elapsed since the original locked decisions with no shipped code (contracts/, frontend/, backend/ were empty scaffolding only). Two things changed the ground the original decisions stood on: the ZuKaş residency moved from April to September 2026, and direct access to existing Telegram fiat↔crypto exchange communities turned out to be the strongest distribution channel available, stronger than World App's general-purpose user base. The entries below formally supersede D-001, D-003, D-008, D-009, D-010, D-011 per this file's own amendment rule. D-002, D-004, D-005, D-006, D-007 remain locked and unchanged — the non-custodial escrow principle, P2P-only positioning, and standalone branding all still hold.

---

### D-012 — Telegram Mini App Replaces World App/MiniKit as First Platform

**Status:** Locked
**Date:** 2026-07-14

**Decision:** Nomadia's first client is a Telegram Mini App. World App/MiniKit is dropped as the launch platform.

**Rationale:**
- The team's actual distribution advantage is direct, existing access to Telegram crypto-fiat exchange channels and nomad groups (documented in insider intelligence) — not World App's install base, which has no overlap with those warm communities
- Telegram Mini Apps require zero install step beyond an app users already have open daily
- World ID orb verification availability is a hard geographic constraint; it is not guaranteed in the new beachhead (Dubai Marina) the way it was never fully confirmed for Kaş either

**Constraints this creates:**
- Sybil resistance can no longer rely on World ID uniqueness — see D-014
- UI must work within Telegram Mini App SDK constraints instead of MiniKit's

---

### D-013 — Base Chain Escrow + Embedded Non-Custodial Wallet

**Status:** Locked
**Date:** 2026-07-14

**Decision:** Escrow settles in USDC/USDT on Base. Users get a gasless-onboarding embedded smart wallet rather than being required to already hold one. The non-custodial principle from D-002 is unchanged — only the chain and the wallet UX are updated.

**Rationale:**
- Base offers the lowest gas cost among EVM chains with real USDC liquidity, and the existing chain-partnership thesis (Circle/Coinbase) was already pointed at Base, not World Chain
- The fiat-side user (a local wanting crypto exposure) is frequently not crypto-native; requiring them to install a wallet before their first trade was the single biggest onboarding drop-off risk in the original design

**Constraints this creates:**
- Embedded wallet provider (e.g. Privy or equivalent) needs its own account/API key before this goes past local testing
- Multi-chain support is out of scope until Phase 2

---

### D-014 — Telegram Identity + Reputation Replaces World ID

**Status:** Locked
**Date:** 2026-07-14

**Decision:** V0 sybil resistance and reputation are anchored to the user's Telegram account (validated via Telegram Mini App `initData`) plus a fixed monthly transaction cap. Optional selfie/ID upload raises the cap. There is no World ID dependency.

**Rationale:**
- Telegram identity is available everywhere the distribution channel already exists — it doesn't inherit World ID's orb-access geographic gaps
- A monthly cap is a simpler, auditable first line of defense than nullifier-based reputation, and it's the same AML mechanism already specified in the Master Plan
- Full ZK identity (the eventual replacement for both World ID and this interim cap) is still the Phase 2 target — this isn't a rejection of stronger identity, just a sequencing call

**Constraints this creates:**
- Reputation is indexed to Telegram user ID, not a wallet address or a portable credential — a banned account cannot be recovered by re-verifying elsewhere, same tradeoff D-009 accepted for World ID nullifiers
- Weaker sybil resistance than World ID until Phase 2 ZK identity ships — the monthly cap is the mitigation until then

---

### D-015 — Dubai Marina Is the Launch Beachhead; ZuKaş (Sep 2026) Is the Second Pilot

**Status:** Locked
**Date:** 2026-07-14

**Decision:** The first live deployment with real users and real funds is Dubai Marina, not a pop-up-city residency. ZuKaş, now scheduled September 9–20 2026, is the second pilot rather than the launch venue. Fiat side is not restricted to a single currency at launch (AED/USD/TRY as the beachhead and pilot require), superseding the TRY-only scope of D-010.

**Rationale:**
- The April 2026 ZuKaş window this plan was built around no longer exists; the event moved to September, and a launch plan can't be pinned to a date that already slipped once
- Dubai Marina has crypto-friendly regulatory posture (VARA/DMCC), dense camera coverage that pre-solves a large share of physical meetup risk, high nomad/expat density, and the team has existing coworking relationships there — none of this is contingent on a single event's calendar
- ZuKaş remains valuable as a second, differently-shaped pilot (concentrated residency vs. standing city population) and as investor-facing proof, but the business no longer depends on it being first

**Constraints this creates:**
- Kill criterion for the P2P model requires repeat-rate data from *two* points — Dubai Marina and Kaş — not one; see Master Plan v1 kill criteria (repeat rate <30% at both → pivot to OTC broker model)
- Safe-zone curation (coworking partnerships) must be sourced independently in Dubai Marina, not inherited from ZuKaş residency social trust

---

### D-016 — Zero Fees for the First 100 Trades, Not Tied to a Specific Event

**Status:** Locked
**Date:** 2026-07-14

**Decision:** The fee-free period is scoped to the first 100 completed trades during the closed-beta and semi-open-launch phases in Dubai Marina, rather than to the ZuKaş residency window specifically.

**Rationale:**
- Same underlying logic as D-011 — an unaudited product with real money shouldn't also charge its earliest, most trust-extending users — just decoupled from a calendar date that no longer anchors the launch
- A trade-count threshold is easier to reason about across two pilot locations than a fixed date range

**Constraints this creates:**
- No protocol revenue until the 101st trade — must be funded by team/grant through that point, consistent with the pre-seed timing in the Master Plan

---

## Amendment — 2026-07-23 (global PWA launch prep)

The app went live as a Telegram Mini App and was then wrapped as an installable PWA so it works outside Telegram, globally. A three-part code review (contract / backend / product-UX) surfaced that the product is not safe for real money yet, and that the browser-PWA path has no working identity in production. The two entries below resolve the identity model and the V1 scope for the global launch. They refine — do not supersede — D-013 and D-014.

---

### D-017 — V1 Scope Is Crypto↔Fiat Only; Fiat↔Fiat Deferred to V2 with ZK Passport

**Status:** Locked
**Date:** 2026-07-23

**Decision:** V1 supports only crypto↔fiat trades (both directions), where on-chain USDC escrow protects the trade. Pure fiat↔fiat (local cash ↔ local cash, no crypto) is deferred to V2. When fiat↔fiat ships in V2, its trust mechanism is ZK passport verification, not a USDC collateral bond.

**Rationale:**
- Escrow only functions when crypto is in the trade; fiat↔fiat has no on-chain leg to protect, so shipping it in V1 would mean an unprotected cash trade or a friction-heavy collateral bond
- Requiring a fiat-only user to post USDC collateral would force a wallet on exactly the no-wallet segment that fiat↔fiat exists to serve — it loses the customer at the door (founder call, 2026-07-23)
- ZK passport (V2) gives fiat↔fiat a real identity/accountability anchor without custody or collateral, consistent with the eventual ZK-identity direction already noted in D-014

**Constraints this creates:**
- The two founder-recording insights about fiat↔fiat demand (RU↔TR banking gap, leftover-cash on early return) are V2 backlog, not V1 features
- V1 marketing and onboarding must not promise fiat↔fiat

---

### D-018 — Telegram Is the Universal Identity; Wallet Is Connected Only for the Crypto Leg

**Status:** Locked
**Date:** 2026-07-23

**Decision:** Every user authenticates via Telegram, regardless of surface: inside the Mini App via `initData`, and in a plain browser/PWA via the **Telegram Login Widget** (both verified server-side with the bot token). A wallet is connected separately, and only by the party performing an on-chain action (locking or receiving USDC). Reputation is keyed to the Telegram user ID (per D-014). The Telegram @handle doubles as the contact channel for the in-person meetup.

**Rationale:**
- A wallet-first identity would exclude the fiat-cash segment (no wallet, doesn't want one) — the same reason fiat↔fiat can't demand collateral (D-017)
- Telegram is already the acquisition channel (warm exchange/nomad groups), gives a phone-bound account for sybil resistance and account age, and provides a handle that solves the "matched parties can't contact each other" funnel break found in review
- The Login Widget is the browser-native equivalent of Mini App `initData`, so one verification path covers both surfaces and unblocks the global PWA that currently has dead writes in production

**Constraints this creates:**
- Requires TELEGRAM_BOT_TOKEN configured in production and the bot's domain registered with BotFather for the Login Widget to function
- The dev-only `x-dev-telegram-id` fallback is retired from any production path — browser identity now comes from the verified Login Widget, not a client-chosen id
- In V1 crypto↔fiat, both parties still end up needing a wallet (one locks USDC, the other receives it); the wallet requirement is per-trade-role, not per-identity
