#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2019
 * @description Use npm-coding-style.
 */

'use strict'

const SEPARATOR = ','

const DEFAULT_OUTPUT_FILE_NAME = '3-create-sidechain-accounts.sh'
const STAKE_NET = '1.0000 MEETONE'
const STAKE_CPU = '9.0000 MEETONE'
const BUY_RAM_BYTES = '3584'

let inputPath = ''
let mapFilePath = ''
let url = ''
let outputPath = ''
let creator = ''
let onlyPubkey = false

// parse arguments
{
  const CONST = require('./const.js')
  const po = require('commander')
  po
    .version('0.1.0')
    .arguments('<input>', 'File that contains accounts info.')
    .arguments('<map-file>', 'File that contains accounts info.')
    .action(function (input, mapFile) {
      inputPath = input
      mapFilePath = mapFile
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
    .option('--only-pubkey', 'Only publickeys accounts')
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
  console.log('Map file: ' + mapFilePath)

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

  onlyPubkey = !!po.onlyPubkey
  console.log('Only Publickeys accounts: ' + onlyPubkey)
}

const fs = require('fs')
const readline = require('readline')

// key = mainnet account, value = sidechain account
const map = new Map()

const rs = fs.createReadStream(mapFilePath
  , {encoding: 'utf8', autoClose: true}
)
const rl = readline.createInterface({input: rs, crlfDelay: Infinity})

rl.on('line', (line) => {
  let e = line.split(SEPARATOR)
  if (e.length == 2) {
    map.set(e[0], e[1])
  }
})

rl.on('close', () => {
  console.log('Map size: ' + map.size)
  createShellScript(inputPath, outputPath, url, creator, onlyPubkey)
})

function replaceActor(jo) {
  let required_auth = jo
  if (required_auth.accounts) {
    for (let a of required_auth.accounts) {
      if (a.permission) {
        a.permission.actor = map.get(a.permission.actor)
      }
    }
  }
  return JSON.stringify(required_auth)
}

function createShellScript(inputPath, outputPath, url, creator, onlyPubkey) {
  const rs = fs.createReadStream(inputPath
    , { encoding: 'utf8', autoClose: true }
  )
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })

  const ws = fs.createWriteStream(outputPath
    , { flags: 'w', encoding: 'utf8', autoClose: true }
  )
  ws.write('echo Run "cleos wallet unlock" first\n')
  ws.write('server_url="' + url + '"\n')
  ws.write('default_key="EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"'
    + '\n')
  ws.write('creator="' + creator + '"\n')
  ws.write('stake_net="' + STAKE_NET + '"\n')
  ws.write('stake_cpu="' + STAKE_CPU + '"\n')
  ws.write('buy_ram_bytes="' + BUY_RAM_BYTES + '"\n')

  let set_permission_string = '\n'
  let set_owner_permission_string = '\n'

  rl.on('line', (line) => {
    let jo = JSON.parse(line)
    if (!jo.account_name || !jo.permissions) {
      throw new Error(line)
    }
    if (jo.privileged || jo.account_name.substring(0, 6) == 'eosio.') {
      return
    }

    let sidechain_account = map.get(jo.account_name)

    let has_owner_keys = false
    let owner_key
    let owner_required_auth

    let has_active_keys = false
    let active_key

    let need_set_permissions = false
    let need_set_owner_permission = false

    for (let perm of jo.permissions) {
      let need_set_a_permission = false

      if (perm.required_auth.accounts.length > 0) {
        need_set_a_permission = true

        if (onlyPubkey) {
          return
        }
      }

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
            active_key = perm.required_auth.keys[0].key
            if (active_key.substr(0, 3) != 'EOS'
              && active_key.substr(0, 7) != 'PUB_R1_') {
              throw new Error(line)
            }
            break
          default:
            need_set_a_permission = true
            if (onlyPubkey) {
              return
            }
            break
        }
      }

      if (need_set_a_permission) {
        need_set_permissions = true
        if (perm.perm_name == 'owner') {
          need_set_owner_permission = true
          set_owner_permission_string
            += 'cleos -u $server_url set account permission '
            + sidechain_account + ' ' + perm.perm_name + ' \''
            + replaceActor(perm.required_auth) + '\' ' + perm.parent
            + ' -p ' + sidechain_account + '@owner\n'
        } else {
          set_permission_string
            += 'cleos -u $server_url set account permission '
            + sidechain_account + ' ' + perm.perm_name + ' \''
            + replaceActor(perm.required_auth) + '\' ' + perm.parent
            + ' -p ' + sidechain_account + '@owner\n'
        }
      }
    }

    if (need_set_permissions || !has_owner_keys) {
      if (need_set_permissions && !need_set_owner_permission) {
        set_owner_permission_string
          += 'cleos -u $server_url set account permission '
          + sidechain_account + ' owner \''
          + replaceActor(owner_required_auth) + '\' -p '
          + sidechain_account + '@owner\n'
      }
      owner_key = '$default_key'
    }
    if (!has_active_keys) {
      active_key = owner_key
    }

    ws.write('echo ' + jo.account_name + ' # ' + sidechain_account
      + '\ncleos -u $server_url system newaccount $creator '
      + sidechain_account + ' ' + owner_key + ' ' + active_key
      + ' --stake-net "$stake_net"'
      + ' --stake-cpu "$stake_cpu"'
      + ' --buy-ram-bytes $buy_ram_bytes\n')
  })

  rl.on('close', () => {
    ws.write(set_permission_string)
    ws.write(set_owner_permission_string)
  })
}