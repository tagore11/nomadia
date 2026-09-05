# Nomadia

P2P fiat<->crypto exchange, matched by location, settled in person and released
by a non-custodial escrow contract. Start here:

- `docs/PROJECT.md` — what this is, how it works, tech stack, GTM
- `docs/DECISIONS.md` — locked architecture decisions and why (D-012 through
  D-016 record the 2026-07-14 pivot to Telegram + Base)
- `docs/MILESTONES.md` — phased roadmap (historical Phase 0/1 dates predate
  the pivot; the shape still holds)

## Layout

- `contracts/` — Hardhat project, `NomadiaEscrow.sol`, tests, deploy scripts
- `frontend/` — Next.js 16 Telegram Mini App (pages, API routes, SQLite store)
- `backend/` — empty; V0 folded the API into `frontend/app/api/*` (Next.js
  route handlers) instead of a separate service. Split it out only if scale
  actually requires it.
- `cli/` — `nomadia` CLI wrapping `frontend/app/api/*` (offers, rates, stats,
  auth) for scripting/ops; see `cli/README.md`
- `mcp/` — MCP server exposing the public read endpoints (offers, rates,
  stats) as tools for AI agents; see `mcp/README.md`

## Run it

```bash
cd contracts && npm install && npx hardhat test   # verify the escrow contract
cd ../frontend && npm install && npm run dev       # app at the printed localhost URL
```

See `frontend/README.md` for the full setup path, including wiring up a real
chain/wallet for the on-chain lock/confirm/refund flow.
