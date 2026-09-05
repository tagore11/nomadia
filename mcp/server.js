import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { get } from './lib/api.js'

// Read-only by design: no offer creation/claim/lock/confirm tool here even
// though the CLI (../cli) can do all of that. Those actions move money
// through the escrow contract — an LLM invoking them autonomously is a very
// different risk profile than a human typing `nomadia offers claim <id>`
// deliberately. Wire up writes here only once there's a deliberate
// confirmation step (elicitation, or a human-in-the-loop tool annotation)
// backing them.

export const server = new McpServer({ name: 'nomadia', version: '0.1.0' })

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] }
}

async function safeGet(path, query) {
  try {
    return textResult(await get(path, query))
  } catch (err) {
    return { content: [{ type: 'text', text: err.message }], isError: true }
  }
}

server.registerTool(
  'offers_list',
  {
    title: 'List open offers',
    description: 'List open P2P fiat<->crypto exchange offers, optionally filtered by direction and city.',
    inputSchema: {
      direction: z.enum(['crypto_to_fiat', 'fiat_to_crypto']).optional(),
      city: z.string().optional(),
    },
  },
  async ({ direction, city }) => safeGet('offers', { direction, city })
)

server.registerTool(
  'offers_get',
  {
    title: 'Get an offer',
    description: 'Fetch a single offer by numeric id.',
    inputSchema: { id: z.union([z.string(), z.number()]) },
  },
  async ({ id }) => safeGet(`offers/${id}`)
)

server.registerTool(
  'rates_get',
  {
    title: 'Get reference rates',
    description: 'Fetch current USD-base reference fiat/crypto rates used for the fairness signal.',
    inputSchema: {},
  },
  async () => safeGet('rates')
)

server.registerTool(
  'stats_get',
  {
    title: 'Get platform stats',
    description: 'Fetch aggregate Nomadia platform metrics (user/offer counts, funnel, no PII).',
    inputSchema: {},
  },
  async () => safeGet('stats')
)
