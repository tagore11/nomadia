# nomadia-cli

A thin, agent-friendly CLI wrapper around Nomadia's own API
(`frontend/app/api/*`) — modeled on the `sola-cli` pattern used by
[Social Layer](https://github.com/sociallayer-im/sola-cli): one small
module per resource, JSON-only stdout, non-interactive by default. Point it
at a running `frontend` dev server (or a deployed one) instead of curling
routes and eyeballing responses by hand.

## Install

```bash
cd cli && npm install
npm link   # optional: puts `nomadia` on PATH
```

Or run without linking: `node bin/nomadia.js <command>`.

## Configure

By default the CLI talks to `http://localhost:3000/api` (the local
`frontend` dev server). Override with:

```bash
export NOMADIA_API_URL=https://nomadia-app.vercel.app/api
```

## Authenticate

The API resolves identity from a header (see `frontend/lib/auth.ts`); the
CLI can produce two of the three kinds it accepts:

```bash
# Dev-only Telegram id — the server refuses this outside NODE_ENV=production.
# Fine against a local `npm run dev` frontend.
nomadia auth use-dev 123456789 --tier phone

# Real SIWE wallet identity (viem), verified server-side on every request —
# works against any environment, including a deployed one. --domain must be
# one the server's ALLOWED_DOMAINS accepts (see wallet-auth-server.ts):
# localhost:3000 outside production, or the deployed host.
nomadia auth use-wallet --private-key 0x... --domain localhost:3000

nomadia auth status
nomadia auth logout
```

There's no CLI path for real Telegram Mini App / Login Widget auth — those
require a live Telegram session and aren't meaningful outside one.

## Use

```bash
nomadia rates get
nomadia stats get
nomadia offers list --direction crypto_to_fiat --city Dubai
nomadia offers create --direction crypto_to_fiat --crypto-amount 200 \
  --crypto-token USDC --fiat-amount 735 --fiat-currency AED --city Dubai
nomadia offers mine
nomadia offers claim <id> --wallet 0x...
nomadia offers lock <id> --chain-offer-id 3
nomadia offers confirm <id>
nomadia offers rate <id> --stars 5
nomadia me get
nomadia invite redeem <code>
```

Every command prints one JSON object to stdout and exits non-zero on
failure (`{"error": "CODE", ...}`) — pipe-friendly for scripts and agents.

## Why this exists

- **Local smoke testing / seeding** — post and progress offers from a
  terminal instead of clicking through the Mini App in two browser
  profiles.
- **Ops** — check `stats`/`rates` without a browser.
- **Shared plumbing for `../mcp`** — the MCP server re-implements the same
  minimal fetch wrapper rather than importing this package, so each stays
  independently installable/deployable (matching how `sola-cli` and
  `sola-mcp` are separate repos upstream).
