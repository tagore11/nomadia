import { get } from '../api.js'
import { run } from '../utils.js'

export const command = 'me <action>'
export const describe = 'The authenticated identity\'s own profile'

export function builder(yargs) {
  return yargs.command(
    'get',
    'Fetch tier, invite code, and web-of-trust info for the authenticated identity',
    () => {},
    run(() => get('me'))
  ).demandCommand(1)
}

export function handler() {}
