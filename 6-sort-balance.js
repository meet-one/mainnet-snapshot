#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use block-always-using-brace npm-coding-style.
 */

'use strict'

const DEFAULT_OUTPUT_FILE_NAME_PREFIX = '6-sorted-meetone-balance@'

let inputPath = ''

let outputPath = ''

// parse arguments
{
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input>', 'File that contains account names.')
    .action(function (input) {
        inputPath = input
    })
    .option('-o, --output <FILE>', 'Write to FILE, will be appended!')
    .option('-p, --output-prefix <NAME>', 'Output filename prefix')
    .on('--help', function () {
        console.log('')
        console.log('Examples:')
        console.log('  ' + process.argv0 + ' ' + process.argv[1])
    })
    .parse(process.argv)

  if (!inputPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Input file: ' + inputPath)

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
const all = fs.readFileSync(inputPath, 'utf8')
const lines = all.split(/\n/)
const lineCount = lines[lines.length - 1] ? lines.length : lines.length - 1
console.log(`Line count: ${lineCount}`)

const sorted = []

for (let line of lines) {
  const part = line.split(',')
  if (part.length == 2) {
    let balance = parseFloat(part[1])
    sorted.push({original: line, balance: balance})
  }
}

sorted.sort((a, b) => {
  if (a.balance > b.balance) {
    return -1
  }
  if (a.balance < b.balance) {
    return 1
  }
  return 0
})

const ws = fs.createWriteStream(outputPath, {
  flags: 'a',
  encoding: 'utf8',
  autoClose: true
})

for (let i = 0; i < 5000 && i < sorted.length; ++i) {
  ws.write(sorted[i].original + '\n')
  console.log(sorted[i].original)
}
