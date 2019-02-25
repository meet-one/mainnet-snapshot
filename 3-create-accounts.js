#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2018
 * @description Use npm-coding-style.
 */

'use strict'

const DEFAULT_OUTPUT_FILE_NAME = '3-create-accounts.sh'
const STAKE_NET = '50.0000 MEETONE'
const STAKE_CPU = '50.0000 MEETONE'
const BUY_RAM_KBYTES = '4'

let inputPath = ''
let url = ''
let outputPath = ''
let creator = ''

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
    .option('-u, --url <TEXT>'
      , 'the http/https URL where nodeos is running. Default to '
      + CONST.LOCAL.URL)
    .option('-k, --kylin', 'Equal to --url ' + CONST.KYLIN.URL)
    .option('-m, --mainnet', 'Equal to --url ' + CONST.MAINNET.URL)
    .option('-s, --sidechain', 'Equal to --url ' + CONST.SIDECHAIN.URL)
    .option('-c, --creator <TEXT>', 'Set creator')
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

  if (po.creator) {
    creator = po.creator
    // check creator name
    const fmt = require('eosjs').modules.format
    if (!fmt.isName(creator)) {
      console.log('Creator: ' + creator + ' is not an invalid account name.')
      process.exit(-1)
    }
  } else {
    creator = 'eosio'
  }
  console.log('Creator: ' + creator)

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

    outputPath += DEFAULT_OUTPUT_FILE_NAME
  }
  console.log('Output file: ' + outputPath)
}

const fs = require('fs')
const readline = require('readline')
const rs = fs.createReadStream(inputPath
  , { encoding: 'utf8', autoClose: true }
)
const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })

const ws = fs.createWriteStream(outputPath
  , { flags: 'w', encoding: 'utf8', autoClose: true }
)
const ws1 = fs.createWriteStream(outputPath + '.1'
  , { flags: 'w', encoding: 'utf8', autoClose: true }
)
const ws2 = fs.createWriteStream(outputPath + '.2'
  , { flags: 'w', encoding: 'utf8', autoClose: true }
)
ws.write('echo Run "cleos wallet unlock" first\n')
ws.write('server_url="' + url + '"\n')
ws.write('default_key="EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"'
  + '\n')
ws.write('creator="' + creator + '"\n')
ws.write('stake_net="' + STAKE_NET + '"\n')
ws.write('stake_cpu="' + STAKE_CPU + '"\n')
ws.write('buy_ram_kbytes="' + BUY_RAM_KBYTES + '"\n')

ws1.write('echo Run "cleos wallet unlock" first\n')
ws1.write('server_url="' + url + '"\n')

ws2.write('echo Run "cleos wallet unlock" first\n')
ws2.write('server_url="' + url + '"\n')

let permissionSet = new Set()
let set_permission_map = new Map()

rl.on('line', (line) => {
  let jo = JSON.parse(line)
  if (!jo.account_name || !jo.permissions) {
    throw new Error(line)
  }
  if (jo.privileged || jo.account_name.substring(0, 6) == 'eosio.') {
    return
  }

  let has_owner_keys = false
  let owner_key
  let owner_required_auth

  let has_active_keys = false
  let active_key

  let need_set_permissions = false
  let need_set_owner_permission = false

  for (let perm of jo.permissions) {
    let need_set_a_permission = false

    if (perm.required_auth.keys.length > 0) {
      switch (perm.perm_name) {
        case 'owner':
          has_owner_keys = true
          owner_required_auth = perm.required_auth
          owner_key = owner_required_auth.keys[0].key
          if (owner_key.substr(0, 3) != 'EOS'
            && owner_key.substr(0, 7) != 'PUB_R1_') {
            throw new Error(line)
          }
          break
        case 'active':
          has_active_keys = true
          permissionSet.add(jo.account_name + ' active')
          active_key = perm.required_auth.keys[0].key
          if (active_key.substr(0, 3) != 'EOS'
            && active_key.substr(0, 7) != 'PUB_R1_') {
            throw new Error(line)
          }
          break
        default:
          need_set_a_permission = true
          break
      }
    }

    if (perm.required_auth.accounts.length > 0) {
      need_set_a_permission = true
    }

    if (need_set_a_permission) {
      need_set_permissions = true
      if (perm.perm_name == 'owner') {
        need_set_owner_permission = true
        ws2.write('cleos -u $server_url set account permission '
          + jo.account_name + ' ' + perm.perm_name + ' \''
          + JSON.stringify(perm.required_auth) + '\' ' + perm.parent
          + ' -p ' + jo.account_name + '@owner\n')
      } else {
        let permName = jo.account_name + ' ' + perm.perm_name
        set_permission_map.set(permName, perm)
      }
    }
  }

  if (need_set_permissions || !has_owner_keys) {
    if (need_set_permissions && !need_set_owner_permission) {
      ws2.write('cleos -u $server_url set account permission '
        + jo.account_name + ' owner \''
        + JSON.stringify(owner_required_auth) + '\' -p '
        + jo.account_name + '@owner\n')
    }
    owner_key = '$default_key'
  }
  if (!has_active_keys) {
    active_key = owner_key
  }

  permissionSet.add(jo.account_name + ' owner')

  ws.write('cleos -u $server_url system newaccount'
    + ' --stake-net "$stake_net"'
    + ' --stake-cpu "$stake_cpu"'
    + ' --buy-ram-kbytes $buy_ram_kbytes'
    + ' $creator ' + jo.account_name + ' ' + owner_key + ' ' + active_key
    + '\n')
})

rl.on('close', () => {
  ws.close()

  let mapSize = set_permission_map.size
  while (mapSize) {
    for (let [key, value] of set_permission_map) {
      let allIn = true
      for (let a of value.required_auth.accounts) {
        let permName = a.permission.actor + ' ' + a.permission.permission
        if (!permissionSet.has(permName)) {
          allIn = false
          break
        }
      }
      if (allIn) {
        permissionSet.add(key)
        //console.log(key, JSON.stringify(value))
        ws1.write('cleos -u $server_url set account permission '
          + key + ' \''
          + JSON.stringify(value.required_auth) + '\' -p '
          + key.split(' ')[0] + '@owner\n')
        set_permission_map.delete(key)
      }
    }
    if (mapSize == set_permission_map.size) {
      throw new Error('Infinite loop @' + mapSize)
    }
    mapSize = set_permission_map.size
  }
  ws1.close()

  ws2.close()
})
