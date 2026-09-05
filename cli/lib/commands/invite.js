import { post } from '../api.js'
import { run } from '../utils.js'

export const command = 'invite <action>'
export const describe = 'Web-of-trust invite codes'

export function builder(yargs) {
  return yargs.command(
    'redeem <code>',
    'Redeem an invite code, recording its owner as your voucher',
    (y) => y.positional('code', { type: 'string' }),
    run((argv) => post('invite/redeem', { code: argv.code }))
  ).demandCommand(1)
}

export function handler() {}
