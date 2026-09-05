import { loadConfig } from './config.js'

export class ApiError extends Error {
  constructor(code, status, details = {}) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function baseUrl() {
  const cfg = loadConfig()
  return process.env.NOMADIA_API_URL || cfg.apiUrl || 'http://localhost:3000/api'
}

// Mirrors frontend/lib/api-client.ts's provider priority (init-data > login >
// wallet > dev header), minus the Telegram Mini App case, which only exists
// inside a live Telegram client and has no CLI equivalent.
function authHeaders() {
  const { auth } = loadConfig()
  if (!auth) return {}

  if (auth.mode === 'wallet') {
    const payload = Buffer.from(
      JSON.stringify({ message: auth.wallet.message, signature: auth.wallet.signature })
    ).toString('base64')
    return { 'x-wallet-auth': payload }
  }

  if (auth.mode === 'dev') {
    const headers = { 'x-dev-telegram-id': auth.devId }
    if (auth.tier === 'light') headers['x-dev-tier'] = 'light'
    return headers
  }

  return {}
}

export async function request(method, path, { query, body } = {}) {
  const url = new URL(path, baseUrl() + '/')
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : {}

  if (!res.ok) {
    const { error, ...details } = json
    throw new ApiError(error || 'UNKNOWN_ERROR', res.status, details)
  }
  return json
}

export const get = (path, query) => request('GET', path, { query })
export const post = (path, body) => request('POST', path, { body })
export const patch = (path, body) => request('PATCH', path, { body })
