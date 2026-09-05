#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as auth from '../lib/commands/auth.js'
import * as offers from '../lib/commands/offers.js'
import * as rates from '../lib/commands/rates.js'
import * as stats from '../lib/commands/stats.js'
import * as me from '../lib/commands/me.js'
import * as invite from '../lib/commands/invite.js'

yargs(hideBin(process.argv))
  .scriptName('nomadia')
  .usage('$0 <command> [options]')
  .command(auth)
  .command(offers)
  .command(rates)
  .command(stats)
  .command(me)
  .command(invite)
  .demandCommand(1, 'Specify a command')
  .strict()
  .help()
  .parse()
