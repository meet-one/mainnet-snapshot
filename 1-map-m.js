#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use npm-coding-style.
 */

'use strict'

let inputPath = ''
let outputPath = ''

// parse arguments
{
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input>', 'File that contains accounts info.')
    .arguments('<output>', 'File that contains accounts map.')
    .action(function (input, output) {
      inputPath = input
      outputPath = output
    })
    .parse(process.argv)

  if (!inputPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Input file: ' + inputPath)
  console.log('Output file: ' + outputPath)
}

const set = new Set

function randomM() {
  const base31 = '12345abcdefghijklmnopqrstuvwxyz'
  let accountName
  do {
    accountName = '';
    for (let i = 0; i < 10; ++i) {
        let index = Math.floor(Math.random() * 31)
        accountName += base31.charAt(index)
    }
    accountName += '.m'
  } while (set.has(accountName))
  set.add(accountName)
  return accountName
}

const fs = require('fs')
const readline = require('readline')

const map = new Map

if (fs.existsSync(outputPath)) {
  const rs = fs.createReadStream(outputPath
    , {encoding: 'utf8', autoClose: true}
  )
  const rl = readline.createInterface({input: rs, crlfDelay: Infinity})

  rl.on('line', (line) => {
    let e = line.split('\t')
    if (e.length == 2) {
      map.set(e[0], e[1])
    }
  })

  rl.on('close', () => {
    console.log('Map size: ' + map.size)
    mapFile(inputPath)
  })
} else {
  mapFile(inputPath)
}

function mapFile(inputPath) {
  const rs = fs.createReadStream(inputPath
    , {encoding: 'utf8', autoClose: true}
  )
  const rl = readline.createInterface({input: rs, crlfDelay: Infinity})
  const arr = []

  rl.on('line', (line) => {
    if (line.length > 0) {
      let m;
      if (line.endsWith('.m')) {
        m = line
      } else if (map.has(line)) {
        m = map.get(line)
      } else {
        m = randomM()
      }
      arr.push(line + '\t' + m)
    }
  })

  rl.on('close', () => {
    const ws = fs.createWriteStream(outputPath
      , { flags: 'w', encoding: 'utf8', autoClose: true }
    )
    for (let x of arr) {
      ws.write(x + '\n')
    }
    console.log('Write: ' + arr.length)
  })
}