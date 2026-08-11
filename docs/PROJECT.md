# Nomadia — Project Master Context

> **Pivot note (2026-07-14):** Platform, identity, and launch venue changed — see `docs/DECISIONS.md` D-012 through D-016. Telegram Mini App replaces World App/MiniKit, Telegram identity + monthly cap replaces World ID, Dubai Marina replaces ZuKaş as the launch beachhead. Sections below are updated to match; historical ETH Global Taipei prototype details are kept where still accurate.

## Elevator Pitch

Nomadia is a P2P real-world fiat-to-crypto exchange app that matches people with opposite currency needs nearby, lets them meet IRL to exchange cash, and releases escrowed crypto automatically upon confirmation. No bank. No CEX. No KYC friction.

---

## The Problem

Crypto-native travelers hit a hard wall the moment they land somewhere new:

- CEXs require identity verification, bank accounts, and days of onboarding — often unavailable to foreigners
- DEXs give you crypto-to-crypto, not crypto-to-physical-cash
- ATMs charge 3–5% and have withdrawal limits
- Informal exchange operators are opaque, unregulated, and require trust in a stranger with no recourse
- Result: A person holding $5,000 USDC in Turkey cannot reliably get Turkish Lira without significant cost, friction, or risk

The inverse problem exists simultaneously: locals holding local fiat want crypto exposure but have no easy on-ramp.

Two people with exactly opposite needs are physically near each other. They just have no way to find each other.

---

## How It Works — User Flow

### Traveler side (crypto → fiat)

1. Open Nomadia inside Telegram (Mini App)
2. Telegram `initData` confirms account identity; monthly cap applies until higher-limit verification
3. User posts an offer (off-chain intent, no funds move yet): "I have 200 USDC, I need ~735 AED"
4. App lists nearby reverse-direction offers, sorted by distance — locals offering AED in exchange for USDC
5. User selects a specific match; the crypto side deposits 200 USDC into the escrow contract naming that matched wallet as counterparty (Base, embedded wallet) — this is why funds lock at match time, not at posting time: nobody pays gas to lock capital against a match that might not exist
6. Chat continues in native Telegram; both parties agree on a curated safe meeting point (coworking, cafe)
7. They meet IRL. Local hands over cash. Traveler confirms receipt in app.
8. Smart contract releases USDC to local's wallet automatically once both sides confirm
9. Both parties rate the exchange

### Local side (fiat → crypto)

Steps 1–4 are symmetric: local specifies "I have 735 AED, I want ~200 USDC."
No escrow required on the fiat side — local brings cash to the meeting. Trust is established by the crypto side locking funds first, at match time.

### Dispute / No-Show

- If confirmation is not submitted within a timeout window (e.g., 2 hours), escrow returns funds to depositor
- Reputation score is updated negatively for non-appearance
- Future: multi-sig confirmation or community arbitration for disputed exchanges

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Client | Telegram Mini App | Runs inside Telegram; no separate install |
| Identity | Telegram `initData` + monthly cap | Reputation indexed to Telegram user ID; optional selfie/ID raises cap; full ZK identity is Phase 2 |
| Escrow | Solidity contract on Base (USDC/USDT) | Non-custodial; holds crypto until IRL confirmation; 2h timelock refund |
| Wallet | Embedded non-custodial smart wallet | Fiat-side users don't need to already hold a wallet |
| Matching | Distance-sorted list, V0 (no algorithm) | Swipe/card matching is Phase 2, not V0 |
| Backend | Next.js API routes + SQLite (V0) | Offer/match/rating; split into a dedicated service only if scale requires it |
| Location | City/region filter, opt-in | Coarse proximity only — exact location never stored |
| Confirmation | In-app mutual confirmation | Both parties confirm in the Mini App to trigger escrow release |
| Reputation | Off-chain, indexed to Telegram user ID | Not wallet-indexed — same rationale D-009 used for World ID nullifiers |

### Smart Contract Logic (Escrow)

```
createOffer(amount, token, counterparty) → lockFunds()
confirmExchange(offerId) → releaseFunds()  [requires both parties]
refund(offerId) → refundAfterTimeout()      [2h, permissionless]
```

V0 escrow contract handles USDC/USDT on Base only. ETH and multi-chain are Phase 2.

---

## Go-to-Market — Dubai Marina First, ZuKaş Second

Dubai Marina is the launch beachhead (see D-015): crypto-friendly regulatory posture (VARA/DMCC), dense camera coverage that pre-solves much of the physical meetup risk, high nomad/expat density, and existing coworking relationships. Full plan: `~/Projects/nomadia-landing/strategy.html` (Master Plan v1) plus the V0 MVP + 90-day GTM artifact referenced in memory (`nomadia.md`, Jul 14 2026 entry).

ZuKaş 2026 (now Sep 9–19, Kaş, Turkey) is the **second** pilot, not the launch venue — the event's date moved once already and the plan no longer depends on it being first:

- **Captive user base:** Genesis Node residents, concentrated in one town for the residency window
- **Acute real need:** Residents need TRY for daily life but hold stablecoins
- **Trust network:** Residency creates social accountability — reputation matters
- **Pitch opportunity:** Glen Weyl (Plurality) — governance/P2P finance angle relevant to his work

Kill criterion: repeat rate <30% at **both** Dubai Marina and Kaş → pivot to an OTC broker model instead of P2P matching.

**KaşAgora integration:** The KaşAgora city coordination app (`/exchange` page) will surface a soft link to Nomadia for traveler discovery. Not a deep integration — just a discovery channel pointing to the Telegram Mini App.

---

## Competitive Moat vs CEX / DEX

| Dimension | CEX (Binance, Coinbase) | DEX (Uniswap) | Nomadia |
|---|---|---|---|
| Physical cash out | No | No | Yes |
| KYC required | Yes (heavy) | No | No (Telegram identity + capped limits) |
| Local currency access | Limited | No | Core feature |
| Speed to cash | Days (bank) | Impossible | Minutes (IRL meet) |
| Fees | 1–3% + spread | 0.3% + gas | Negotiated P2P (protocol fee TBD) |
| Trust mechanism | Centralized | Smart contract | Smart contract + identity + reputation |
| Availability in emerging markets | Restricted | Permissionless | Permissionless |

The moat is the combination of: existing warm distribution into Telegram exchange communities + non-custodial escrow enforcement + IRL proximity matching. None of these exist together in any current product.

---

## Revenue Model (Options)

**Option A — Protocol Fee (preferred)**
- 0.5–1% fee on the crypto leg of each exchange
- Taken automatically by the escrow contract at release
- Sustainable, aligns with volume growth

**Option B — Premium Matching**
- Base matching free; priority matching (faster response, higher-rated counterparties) as paid feature
- WLD token or subscription

**Option C — Liquidity Provider Program**
- Professional local exchange operators (like Samir in Kaş) pay for verified "Pro Exchanger" status
- Increased visibility in match results, higher volume limits

**Option D — B2B API**
- White-label the matching + escrow layer for other Zuzalu-network pop-up city apps
- KaşAgora is the first proof of concept

First 100 trades (Dubai Marina closed + semi-open beta): zero fees. Pure usage data and reputation seeding — see D-016.

---

## Status

- ETH Global Taipei 2025 Finalist (World App/MiniKit prototype — historical, platform since changed)
- V0 build in progress on Telegram Mini App + Base escrow (2026-07-14 pivot, see D-012 through D-016)
- Needs: production-grade smart contract audit, UX polish, reputation system, dispute resolution
