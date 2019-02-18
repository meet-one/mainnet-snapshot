#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use npm-coding-style.
 */

'use strict'

const CODE = 'eosio'
const TABLE = 'userres'
const LIMIT = 10000

let url = ''
let outputPath = ''
let tableName = TABLE

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .option('-u, --url <TEXT>'
      , 'the http/https URL where nodeos is running. Default to '
      + CONST.LOCAL.URL
    )
    .option('-k, --kylin', 'Equal to --url ' + CONST.KYLIN.URL)
    .option('-m, --mainnet', 'Equal to --url ' + CONST.MAINNET.URL)
    .option('-s, --sidechain', 'Equal to --url ' + CONST.SIDECHAIN.URL)
    .option('-o, --output <FILE>', 'Write to FILE, will be overwritten!')
    .option('-p, --output-prefix <NAME>', 'Output filename prefix')
    .option('-t, --table <TABLE>', 'Table name, default to ' + TABLE)
    .on('--help', function () {
      console.log('')
      console.log('Examples:')
      console.log('  ' + process.argv0 + ' ' + process.argv[1]
        + ' --url http://kylin.fn.eosbixin.com')
    })
    .parse(process.argv)

  if (po.url) {
    url = po.url
    if (po.kylin) {
      console.log('--kylin is overridden, use ' + url)
    }
    if (po.mainnet) {
      console.log('--mainnet is overridden, use ' + url)
    }
  } else if (po.kylin) {
    url = CONST.KYLIN.URL
  } else if (po.mainnet) {
    url = CONST.MAINNET.URL
  } else if (po.sidechain) {
    url = CONST.SIDECHAIN.URL
  } else {
    url = CONST.LOCAL.URL
  }

  let u = new URL(url)
  url = u.origin
  console.log('URL: ' + url)

  if (po.table) {
    tableName = po.table
  }
  console.log('Table name: ' + tableName)

  if (po.output) {
    outputPath = po.output
  } else {
    if (po.outputPrefix) {
      outputPath = po.outputPrefix
    } else if (po.kylin) {
      outputPath = CONST.KYLIN.NAME + '-'
    } else if (po.mainnet) {
      outputPath = CONST.MAINNET.NAME + '-'
    } else if (po.url) {
      outputPath = u.hostname + '-'
    } else {
      outputPath = CONST.LOCAL.NAME + '-'
    }

    const moment = require('moment')
    outputPath += '1-accounts-' + tableName + '@'
      + moment().format('YYYY-MM-DD[T]HH-mm-ss.SSS[Z]ZZ') + '.txt'
  }
  console.log('Output file: ' + outputPath)
}

const EosApi = require('eosjs-api')
const options = {
  httpEndpoint: url
  , verbose: false
  , logger: {
    log: null //console.log
    , error: console.error
  }
  , fetchConfiguration: {}
}
const eos = EosApi(options)

const fs = require('fs')
const ws = fs.createWriteStream(outputPath, { encoding: 'utf8', autoClose: true })

let lastOne = ''
let retry = 0

function succeeded(res) {
  retry = 0
  if (res.rows) {
    let buffer = ''
    res.rows.forEach(e => {
      buffer += e.scope + '\n'
    })
    ws.write(buffer)
  }
  if (res.more) {
    if (res.more > lastOne) {
      lastOne = res.more
      console.log('Next: ' + lastOne)
      eos
        .getTableByScope(CODE, tableName, ' ' + lastOne, -1, LIMIT)
        .then(succeeded, failed)
    } else {
      ws.end()
      console.log('Duplicated, exit!')
    }
  } else {
    ws.end()
    console.log('Done!')
  }
}

function failed(err) {
  if (retry++ < 3) {
    console.log('Retry on ' + lastOne + ' for ' + retry + ' time(s)')
    eos
      .getTableByScope(CODE, tableName, ' ' + lastOne, -1, LIMIT)
      .then(succeeded, failed)
  } else {
    console.log('Retry failed on ' + lastOne)
  }
}

eos
  .getTableByScope(CODE, tableName, 0, -1, LIMIT)
  .then(succeeded, failed)
