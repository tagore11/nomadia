# nomadia-mcp

An MCP (Model Context Protocol) server exposing Nomadia's **public read**
endpoints as tools for AI agents — modeled on the `sola-mcp` pattern used by
[Social Layer](https://github.com/sociallayer-im/sola-mcp), scaled down to
stdio transport (a local dev tool an agent runtime spawns as a subprocess,
not a hosted HTTP service — there's nothing here yet worth exposing to the
public internet the way `sola-mcp` is on Fly.io).

## Why read-only

`../cli` can create, claim, lock, confirm, and refund offers — real actions
against a real escrow flow. This server intentionally does **not** expose
those as tools. An LLM deciding on its own to call `offers_claim` mid-chat is
a different risk profile than a human typing `nomadia offers claim <id>`
on purpose. Writes stay in the CLI, run by a person, until there's a real
confirmation step (MCP elicitation, or an explicit human-in-the-loop
annotation) backing them here.

## Tools

- `offers_list` — list open offers, optionally by `direction`/`city`
- `offers_get` — fetch one offer by `id`
- `rates_get` — current reference fiat/crypto rates
- `stats_get` — aggregate platform metrics (no PII)

All are public endpoints (see `frontend/app/api/*`) — no auth, no
credentials for this process to hold.

## Run it

```bash
cd mcp && npm install
export NOMADIA_API_URL=http://localhost:3000/api   # default; point at a deployed API too
node index.js
```

Point an MCP client at it as a stdio server, e.g. in Claude Code's
`.mcp.json`:

```json
{
  "mcpServers": {
    "nomadia": {
      "command": "node",
      "args": ["mcp/index.js"],
      "env": { "NOMADIA_API_URL": "http://localhost:3000/api" }
    }
  }
}
```

Or inspect it manually:

```bash
npx @modelcontextprotocol/inspector node index.js
```

## Relation to `../cli`

Both wrap the same `frontend/app/api/*` surface but don't share code — each
re-implements a minimal fetch client so either can be installed/deployed on
its own, matching how `sola-cli` and `sola-mcp` are separate repos upstream.
