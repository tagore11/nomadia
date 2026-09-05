import { createSiweMessage, generateSiweNonce } from 'viem/siwe'
import { privateKeyToAccount } from 'viem/accounts'
import { updateConfig, loadConfig } from '../config.js'
import { run } from '../utils.js'

// Must match frontend/lib/wallet-auth-server.ts: Base Sepolia (V0), and a
// domain the server's ALLOWED_DOMAINS actually accepts (localhost:3000 only
// outside NODE_ENV=production, or NEXT_PUBLIC_SIWE_DOMAIN / the prod host).
const CHAIN_ID = 84532
const DEFAULT_DOMAIN = 'localhost:3000'
const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const command = 'auth <action>'
export const describe = 'Manage the identity the CLI authenticates as'

export function builder(yargs) {
  return yargs
    .command(
      'use-dev <telegram-id>',
      'Authenticate as a dev-only Telegram id (server refuses this in production)',
      (y) =>
        y
          .positional('telegram-id', { type: 'string' })
          .option('tier', { choices: ['phone', 'light'], default: 'phone' }),
      run(async (argv) => {
        updateConfig({ auth: { mode: 'dev', devId: argv.telegramId, tier: argv.tier } })
        return { ok: true, mode: 'dev', devId: argv.telegramId, tier: argv.tier }
      })
    )
    .command(
      'use-wallet',
      'Sign a SIWE message with a private key and authenticate as that wallet',
      (y) =>
        y
          .option('private-key', { type: 'string', demandOption: true, describe: '0x-prefixed EOA private key' })
          .option('domain', { type: 'string', default: DEFAULT_DOMAIN })
          .option('uri', { type: 'string' }),
      run(async (argv) => {
        const account = privateKeyToAccount(argv.privateKey)
        const uri = argv.uri || `http://${argv.domain}`
        const message = createSiweMessage({
          address: account.address,
          chainId: CHAIN_ID,
          domain: argv.domain,
          uri,
          version: '1',
          nonce: generateSiweNonce(),
          statement: 'Sign in to Nomadia. This proves you control this wallet and is your identity here.',
          issuedAt: new Date(),
          expirationTime: new Date(Date.now() + AUTH_TTL_MS),
        })
        const signature = await account.signMessage({ message })
        updateConfig({ auth: { mode: 'wallet', wallet: { address: account.address, message, signature } } })
        return { ok: true, mode: 'wallet', address: account.address }
      })
    )
    .command(
      'status',
      'Show the currently configured identity',
      () => {},
      run(async () => ({ auth: loadConfig().auth ?? null }))
    )
    .command(
      'logout',
      'Forget the configured identity',
      () => {},
      run(async () => {
        updateConfig({ auth: null })
        return { ok: true }
      })
    )
    .demandCommand(1)
}

export function handler() {}
