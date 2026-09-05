import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DIR = join(homedir(), '.nomadia')
const FILE = join(DIR, 'config.json')

let cache = null

export function loadConfig() {
  if (cache) return cache
  if (!existsSync(FILE)) {
    cache = {}
    return cache
  }
  try {
    cache = JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    cache = {}
  }
  return cache
}

export function saveConfig(next) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(next, null, 2))
  cache = next
}

export function updateConfig(patch) {
  const next = { ...loadConfig(), ...patch }
  saveConfig(next)
  return next
}
