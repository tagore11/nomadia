import { get } from '../api.js'
import { run } from '../utils.js'

export const command = 'stats <action>'
export const describe = 'Aggregate platform metrics (no PII)'

export function builder(yargs) {
  return yargs.command(
    'get',
    'Fetch aggregate stats',
    () => {},
    run(() => get('stats'))
  ).demandCommand(1)
}

export function handler() {}
