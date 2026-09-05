// Minimal fetch wrapper for Nomadia's public read endpoints. Deliberately not
// shared with ../cli/lib/api.js — this server carries no credentials at all
// (see README "Why read-only"), so it doesn't need the auth-header logic the
// CLI has, and stays independently installable/deployable.

function baseUrl() {
  return process.env.NOMADIA_API_URL || 'http://localhost:3000/api'
}

export async function get(path, query) {
  const url = new URL(path, baseUrl() + '/')
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url)
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(json.error ? `${json.error} (${res.status})` : `HTTP ${res.status}`)
  }
  return json
}
