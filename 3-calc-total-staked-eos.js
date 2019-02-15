#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use npm-coding-style.
 */

'use strict'

let inputPath = ''

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input>', 'File that contains accounts info.')
    .action(function (input) {
      inputPath = input
    })
    .parse(process.argv)

  if (!inputPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Input file: ' + inputPath)
}

const fs = require('fs')
const readline = require('readline')

const rs = fs.createReadStream(inputPath
  , {encoding: 'utf8', autoClose: true}
)
const rl = readline.createInterface({input: rs, crlfDelay: Infinity})

let lineNumber = 0
let balance = 0.0
let staked = 0.0
let cpu = 0.0
let net = 0.0

rl.on('line', (line) => {
  lineNumber ++
  let jo = JSON.parse(line)
  if (jo) {
    if (jo.account_name.substring(0, 6) == 'eosio.') {
      if (jo.account_name == 'eosio.stake') {
        staked = parseFloat(jo.core_liquid_balance)
      }
      console.log(jo.account_name + ' balance: ' + jo.core_liquid_balance)
    } else {
      if (jo.core_liquid_balance) {
        balance += parseFloat(jo.core_liquid_balance)
      }
    }
    let res = jo.total_resources
    cpu += parseFloat(res.cpu_weight)
    net += parseFloat(res.net_weight)
  } else {
    console.error('[' + lineNumber + '] Error: ' + line)
  }
})

rl.on('close', () => {
  console.log('Total balance: ' + balance)
  console.log('Total staked EOS for CPU: ' + cpu)
  console.log('Total staked EOS for NET: ' + net)
  console.log('Refunding EOS: ' + (staked - cpu - net))
})
