import { get, post, patch } from '../api.js'
import { run } from '../utils.js'

export const command = 'offers <action>'
export const describe = 'Browse, post, and progress P2P exchange offers'

export function builder(yargs) {
  return yargs
    .command(
      'list',
      'List open offers, optionally filtered',
      (y) => y.option('direction', { choices: ['crypto_to_fiat', 'fiat_to_crypto'] }).option('city', { type: 'string' }),
      run((argv) => get('offers', { direction: argv.direction, city: argv.city }))
    )
    .command(
      'get <id>',
      'Fetch a single offer by id',
      (y) => y.positional('id', { type: 'string' }),
      run((argv) => get(`offers/${argv.id}`))
    )
    .command(
      'mine',
      'List offers the authenticated identity is part of',
      () => {},
      run(() => get('offers/mine'))
    )
    .command(
      'create',
      'Post a new offer (off-chain intent; no funds move yet)',
      (y) =>
        y
          .option('direction', { choices: ['crypto_to_fiat', 'fiat_to_crypto'], demandOption: true })
          .option('crypto-amount', { type: 'number', demandOption: true })
          .option('crypto-token', { type: 'string', demandOption: true })
          .option('fiat-amount', { type: 'number', demandOption: true })
          .option('fiat-currency', { type: 'string', demandOption: true })
          .option('city', { type: 'string', demandOption: true })
          .option('wallet', { type: 'string', describe: 'EVM address to receive/release funds' })
          .option('contact', { type: 'string', describe: 'Required if posting anonymously' }),
      run((argv) =>
        post('offers', {
          direction: argv.direction,
          cryptoAmount: argv.cryptoAmount,
          cryptoToken: argv.cryptoToken,
          fiatAmount: argv.fiatAmount,
          fiatCurrency: argv.fiatCurrency,
          city: argv.city,
          wallet: argv.wallet,
          contact: argv.contact,
        })
      )
    )
    .command(
      'claim <id>',
      'Claim (match) an open offer as its counterparty',
      (y) =>
        y
          .positional('id', { type: 'string' })
          .option('wallet', { type: 'string' })
          .option('contact', { type: 'string' }),
      run((argv) =>
        patch(`offers/${argv.id}`, { status: 'matched', counterpartyWallet: argv.wallet, contact: argv.contact })
      )
    )
    .command(
      'lock <id>',
      'Record the on-chain escrow lock for a matched offer',
      (y) => y.positional('id', { type: 'string' }).option('chain-offer-id', { type: 'number', demandOption: true }).option('safe-zone', { type: 'string' }),
      run((argv) => patch(`offers/${argv.id}`, { chainOfferId: argv.chainOfferId, safeZone: argv.safeZone }))
    )
    .command(
      'confirm <id>',
      'Confirm receipt, releasing escrowed funds (both parties must confirm)',
      (y) => y.positional('id', { type: 'string' }),
      run((argv) => patch(`offers/${argv.id}`, { status: 'released' }))
    )
    .command(
      'refund <id>',
      'Mark a matched offer refunded after the timeout window',
      (y) => y.positional('id', { type: 'string' }),
      run((argv) => patch(`offers/${argv.id}`, { status: 'refunded' }))
    )
    .command(
      'rate <id>',
      'Rate the counterparty of a released offer (1-5 stars)',
      (y) => y.positional('id', { type: 'string' }).option('stars', { type: 'number', demandOption: true }),
      run((argv) => post(`offers/${argv.id}/rate`, { stars: argv.stars }))
    )
    .demandCommand(1)
}

export function handler() {}
