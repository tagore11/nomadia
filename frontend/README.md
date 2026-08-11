# Nomadia — V0 frontend

Telegram Mini App for P2P fiat<->crypto exchange. See `../docs/PROJECT.md` and
`../docs/DECISIONS.md` (D-012 through D-016) for what this is and why it's
built this way — this file is just setup instructions.

## Quick start (off-chain flow only, no wallet needed)

```bash
npm install
npm run dev
```

Open the printed localhost URL. Outside a real Telegram client the app runs
in **DEV MODE**: each browser profile gets a random `dev-*` identity stored in
localStorage (see `lib/dev-identity.ts`), so you can open two browser profiles
to act as two different users — post an offer in one, claim it in the other.
This covers posting, browsing, and claiming offers; it stops at the point
where funds would actually lock on-chain.

## Full flow, including the on-chain escrow lock/confirm/refund

Needs a running chain and a deployed contract. For local testing:

```bash
cd ../contracts
npx hardhat node                                    # separate terminal, keep running
npx hardhat run scripts/deploy.js --network localhost
```

Also deploy `MockUSDC` the same way (write a one-line script or use the
Hardhat console) and copy both addresses into `frontend/.env.local`:

```
NEXT_PUBLIC_ESCROW_ADDRESS_LOCAL=0x...
NEXT_PUBLIC_TOKEN_ADDRESS_LOCAL=0x...
```

Point MetaMask at `http://127.0.0.1:8545`, chain id `31337`, import one of
the Hardhat node's funded test accounts. Connect that wallet in the app —
the "kilitle" / "onayla" / "iade al" buttons in `components/OfferActions.tsx`
will now send real transactions against your local chain.

## Going to Base Sepolia (public testnet)

```bash
cd ../contracts
cp .env.example .env   # fill in a funded burner key
npx hardhat run scripts/deploy.js --network baseSepolia
```

Copy the deployed address into `NEXT_PUBLIC_ESCROW_ADDRESS_BASE_SEPOLIA` /
`NEXT_PUBLIC_TOKEN_ADDRESS_BASE_SEPOLIA` in `.env.local`.

## Still needed before this is real

- **WalletConnect project ID** (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, from
  [cloud.reown.com](https://cloud.reown.com)) — without it, injected wallets
  (MetaMask) still work, WalletConnect's QR/mobile flow doesn't.
- **Telegram bot token** (`TELEGRAM_BOT_TOKEN`, from @BotFather) — without it,
  the app can't verify real Telegram identity and falls back to the DEV MODE
  header (`lib/auth.ts`), which must never be reachable in production.
- **Embedded wallet provider** — the MVP spec calls for a gasless embedded
  wallet so non-crypto-native users don't need MetaMask pre-installed
  (docs/DECISIONS.md D-013). This build wires up injected/WalletConnect
  wallets via RainbowKit; swapping in an embedded-wallet provider is a
  `lib/wagmi.ts` change, not a rewrite.
- **Real USDC/USDT on Base**, not `MockUSDC` — swap `TOKEN_ADDRESS` once
  ready to move real funds.

## Stack

Next.js 16 (App Router) · wagmi 2 + RainbowKit 2 (pinned versions — see
comment in `package.json` history if bumping) · SQLite via `better-sqlite3`
for offer/match/rating metadata · Tailwind v4, brand tokens in
`app/globals.css` (dark fintech, matches `~/Projects/nomadia-landing`).
