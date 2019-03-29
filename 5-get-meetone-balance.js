#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use block-always-using-brace npm-coding-style.
 */

'use strict'

const CODE = 'eosiomeetone'
const DEFAULT_OUTPUT_FILE_NAME_PREFIX = '5-meetone-balance@'

let inputPath = ''
let lineNumber = 1

let url = ''
let outputPath = ''

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input> [line-number]', 'File that contains account names.')
    .action(function (input, line) {
      inputPath = input
      if (line) {
        lineNumber = parseInt(line)
        if (lineNumber < 1) {
          lineNumber = 1
        }
      }
    })
    .option('-u, --url <TEXT>'
      , 'the http/https URL where nodeos is running. Default to '
      + CONST.LOCAL.URL)
    .option('-k, --kylin', 'Equal to --url ' + CONST.KYLIN.URL)
    .option('-m, --mainnet', 'Equal to --url ' + CONST.MAINNET.URL)
    .option('-s, --sidechain', 'Equal to --url ' + CONST.SIDECHAIN.URL)
    .option('-o, --output <FILE>', 'Write to FILE, will be appended!')
    .option('-p, --output-prefix <NAME>', 'Output filename prefix')
    .on('--help', function () {
      console.log('')
      console.log('Examples:')
      console.log('  ' + process.argv0 + ' ' + process.argv[1]
        + ' --url http://kylin.fn.eosbixin.com')
    })
    .parse(process.argv)

  if (!inputPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Input file: ' + inputPath)
  console.log('Line number(1 base): ' + lineNumber)

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

  if (po.output) {
    outputPath = po.output
  } else {
    if (po.outputPrefix) {
      outputPath = po.outputPrefix
    } else if (po.kylin) {
      outputPath = CONST.KYLIN.NAME + '-'
    } else if (po.mainnet) {
      outputPath = CONST.MAINNET.NAME + '-'
    } else if (po.sidechain) {
      outputPath = CONST.SIDECHAIN.NAME + '-'
    } else if (po.url) {
      outputPath = u.hostname + '-'
    } else {
      outputPath = CONST.LOCAL.NAME + '-'
    }

    const moment = require('moment')
    outputPath += DEFAULT_OUTPUT_FILE_NAME_PREFIX
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
const all = fs.readFileSync(inputPath, 'utf8')
const lines = all.split(/\n/)
const line_count = lines[lines.length - 1] ? lines.length : lines.length - 1
console.log(`Line count: ${line_count}`)

const ws = fs.createWriteStream(outputPath, {
  flags: 'a',
  encoding: 'utf8',
  autoClose: true
})

let retry = 0
GetAccount()

async function GetAccount() {
  if (lineNumber <= line_count) {
    // line index = line number - 1
    let account_name = lines[lineNumber - 1]
    console.log('Line ' + lineNumber + ': Fetching balance of ' + account_name)
    eos.getCurrencyBalance(CODE, account_name).then((res) => {
      retry = 0

      if (res) {
        // JSON
        //let buffer = '{"account_name": "' + account_name + '"' + ', "balance": "' + res + '"}\n';
        // CSV
        let buffer = account_name + ',' + res + '\n';
        ws.write(buffer);
      } else {
        console.log('Error on ' + lineNumber + ': ' + account_name);
        ws.write('{"account_name": "' + account_name + '"}');
      }

      ++lineNumber
      GetAccount()
    }, (err) => {
      // retry
      if (retry++ < 3) {
        console.log('Retry on ' + lineNumber + ': ' + account_name)
        GetAccount()
      } else {
        console.log('Retry failed on ' + lineNumber + ': ' + account_name)
      }
    })
  } else {
    console.log('Done!')
  }
}
