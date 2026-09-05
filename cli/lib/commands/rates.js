import { get } from '../api.js'
import { run } from '../utils.js'

export const command = 'rates <action>'
export const describe = 'Reference fiat/crypto rates used for the fairness signal'

export function builder(yargs) {
  return yargs.command(
    'get',
    'Fetch current reference rates',
    () => {},
    run(() => get('rates'))
  ).demandCommand(1)
}

export function handler() {}
