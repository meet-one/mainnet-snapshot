#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use npm-coding-style.
 */

'use strict'

const DEFAULT_OUTPUT_FILE_NAME_PREFIX = '3-merged-balance@'
const SEPARATOR = ','

let infoPath = ''
let delbandPath = ''
let refundsPath = ''
let outputPath = ''

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<info-file>', 'File that contains accounts info.')
    .arguments('<delband-file>', 'File that contains delband info.')
    .arguments('<refunds-file>', 'File that contains refunds info.')
    .action(function (info, delband, refunds) {
      infoPath = info
      delbandPath = delband
      refundsPath = refunds
    })
    .option('-o, --output <FILE>', 'Write to FILE, will be appended!')
    .option('-p, --output-prefix <NAME>', 'Output filename prefix')
    .parse(process.argv)

  if (!infoPath || !delbandPath || !refundsPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('info file: ' + infoPath)
  console.log('delband file: ' + delbandPath)
  console.log('refunds file: ' + refundsPath)

  if (po.output) {
    outputPath = po.output
  } else {
    if (po.outputPrefix) {
      outputPath = po.outputPrefix
    }

    const moment = require('moment')
    outputPath += DEFAULT_OUTPUT_FILE_NAME_PREFIX
      + moment().format('YYYY-MM-DD[T]HH-mm-ss.SSS[Z]ZZ') + '.csv'
  }

  console.log('Output file: ' + outputPath)
}

const fs = require('fs')
const readline = require('readline')
const infoMap = new Map()
const delbandMap = new Map()
const refundsMap = new Map()
const accounts = []

const rs = fs.createReadStream(infoPath
  , {encoding: 'utf8', autoClose: true}
)
const rl = readline.createInterface({input: rs, crlfDelay: Infinity})

let lineNumber = 0
let balance = 0.0

rl.on('line', (line) => {
  ++lineNumber
  let jo = JSON.parse(line)
  if (jo) {
    if (jo.privileged || jo.account_name.substring(0, 6) == 'eosio.') {
      console.log('[' + lineNumber + '] Skip special account: ' + jo.account_name)
    } else {
      let balance = 0.0
      if (jo.core_liquid_balance) {
        balance = parseFloat(jo.core_liquid_balance)
      }
      if (infoMap.has(jo.account_name)) {
        console.log('[' + lineNumber + '] Skip duplicated account: ' + jo.account_name)
      } else {
        infoMap.set(jo.account_name, balance)
        accounts.push(jo.account_name)
      }
    }
  } else {
    console.error('[' + lineNumber + '] Error: ' + line)
  }
})

rl.on('close', () => {
  console.log('\nTotal account: ' + lineNumber)

  fileToMap(delbandPath, delbandMap)
  fileToMap(refundsPath, refundsMap)

  const ws = fs.createWriteStream(outputPath, {
    flags: 'a',
    encoding: 'utf8',
    autoClose: true
  })
  for (let e of accounts) {
    let balance = infoMap.get(e)
    if (delbandMap.has(e)) {
      balance += delbandMap.get(e)
    }
    if (refundsMap.has(e)) {
      balance += refundsMap.get(e)
    }
    ws.write(e + SEPARATOR + balance.toFixed(4) + '\n')
  }
  ws.close()
})

function fileToMap(filePath, map) {
  const all = fs.readFileSync(filePath, 'utf8')
  const lines = all.split(/\n/)
  const lineCount = lines[lines.length - 1] ? lines.length : lines.length - 1
  let lineNumber = 0

  console.log(`${filePath}, Line count: ${lineCount}`)
  for (let line of lines) {
    ++lineNumber
    const part = line.split(',')
    if (part.length == 2) {
      let balance = parseFloat(part[1])
      if (map.has(part[0])) {
        console.log('[' + lineNumber + '] Skip duplicated account: ' + part[0])
      } else {
        map.set(part[0], balance)
      }
    }
  }
}