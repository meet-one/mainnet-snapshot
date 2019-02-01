#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2019
 * @description Use npm-coding-style.
 * #editor.tabSize: 2
 */

'use strict'

function main() {
  let inputPath = ''

  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input>', 'File that contains accounts info.')
    .action(function (input, mapFile) {
      inputPath = input
    })
    .parse(process.argv)

  if (!inputPath) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Input file: ' + inputPath)
  readInputFile(inputPath)
}

function readInputFile(inputPath) {
  let keys = new Set()

  const ecc = require('eosjs-ecc')

  const fs = require('fs')
  const readline = require('readline')
  const rs = fs.createReadStream(inputPath
    , { encoding: 'utf8', autoClose: true }
  )
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })

  rl.on('line', (line) => {
    let jo = JSON.parse(line)
    if (jo.permissions) {
      for (let perm of jo.permissions) {
        if (perm.required_auth.keys.length > 0) {
          let key = perm.required_auth.keys[0].key
          if (key.substr(0, 3) != 'EOS'
            && key.substr(0, 7) != 'PUB_R1_') {
            throw new Error(line)
          }

          if (!keys.has(key)) {
            keys.add(key)
            if (!ecc.isValidPublic(key)) {
              console.log(key)
            }
          }
        }
      }
    } else {
      throw new Error(line)
    }
  })

  rl.on('close', () => {
    console.log(keys.size)
  })
}

main()
