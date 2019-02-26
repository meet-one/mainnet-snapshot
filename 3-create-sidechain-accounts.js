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
let excludeFilename = ''

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
    .option('-e, --exclude <FILE>', 'File that contains excluded accounts')
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

    if (po.exclude) {
      outputPath += '3-go-on.sh'
    } else {
      outputPath += DEFAULT_OUTPUT_FILE_NAME
    }
  }
  console.log('Output file: ' + outputPath)

  onlyPubkey = !!po.onlyPubkey
  console.log('Only Publickeys accounts: ' + onlyPubkey)

  if (po.exclude) {
    excludeFilename = po.exclude
    console.log('Exclude: ' + excludeFilename)
  }
}

const fs = require('fs')
const readline = require('readline')

// key = mainnet account, value = sidechain account
const map = new Map()
const excludeSet = new Set()

const rs = fs.createReadStream(mapFilePath
  , {encoding: 'utf8', autoClose: true}
)
const rl = readline.createInterface({input: rs, crlfDelay: Infinity})

rl.on('line', (line) => {
  let e = line.split(SEPARATOR)
  if (e.length == 2) {
    if ('eosio' == e[0] || 'eosio.' == e[0].substring(0, 6)) {
      console.log('Skip ' + e[0])
    } else {
      map.set(e[0], e[1])
    }
  }
})

rl.on('close', () => {
  console.log('Map size: ' + map.size)
  if (excludeFilename) {
    readExcludeFile(excludeFilename)
  } else {
    createShellScript(inputPath, outputPath, url, creator, onlyPubkey)
  }
})

function replaceActor(jo) {
  let required_auth = jo
  if (required_auth.accounts) {
    for (let a of required_auth.accounts) {
      if (a.permission && a.permission.actor && map.has(a.permission.actor)) {
        a.permission.actor = map.get(a.permission.actor)
      }
    }
  }
  required_auth.accounts.sort((a, b) => {
    if (a.permission.actor < b.permission.actor) {
      return -1
    }
    if (a.permission.actor > b.permission.actor) {
      return 1
    }
    return 0
  })
  return JSON.stringify(required_auth)
}

function replaceAuthActor(jo) {
  let nj = jo
  if (nj.required_auth.accounts) {
    for (let a of nj.required_auth.accounts) {
      if (a.permission && a.permission.actor && map.has(a.permission.actor)) {
        a.permission.actor = map.get(a.permission.actor)
      }
    }
  }
  nj.required_auth.accounts.sort((a, b) => {
    if (a.permission.actor < b.permission.actor) {
      return -1
    }
    if (a.permission.actor > b.permission.actor) {
      return 1
    }
    return 0
  })
  return nj
}

function createShellScript(inputPath, outputPath, url, creator, onlyPubkey) {
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
  ws.write('default_key="EOS8iANEmGQ6ExAP22KF4vRu9hPvMNgHmVFyMMF5UspNMGzyukhV9"'
    + '\n')
  ws.write('creator="' + creator + '"\n')
  ws.write('stake_net="' + STAKE_NET + '"\n')
  ws.write('stake_cpu="' + STAKE_CPU + '"\n')
  ws.write('buy_ram_bytes="' + BUY_RAM_BYTES + '"\n')

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
            permissionSet.add(sidechain_account + ' active')
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
          ws2.write('cleos -u $server_url set account permission '
            + sidechain_account + ' ' + perm.perm_name + ' \''
            + replaceActor(perm.required_auth) + '\' ' + perm.parent
            + ' -p ' + sidechain_account + '@owner\n')
        } else {
          let permName = sidechain_account + ' ' + perm.perm_name
          set_permission_map.set(permName, replaceAuthActor(perm))
        }
      }
    }

    if (need_set_permissions || !has_owner_keys) {
      if (need_set_permissions && !need_set_owner_permission) {
        ws2.write('cleos -u $server_url set account permission '
          + sidechain_account + ' owner \''
          + replaceActor(owner_required_auth) + '\' -p '
          + sidechain_account + '@owner\n')
      }
      owner_key = '$default_key'
    }
    if (!has_active_keys) {
      active_key = owner_key
    }

    permissionSet.add(sidechain_account + ' owner')

    if (!excludeSet.has(sidechain_account)) {
      ws.write('echo ' + jo.account_name + ' # ' + sidechain_account
        + '\ncleos -u $server_url system newaccount $creator '
        + sidechain_account + ' ' + owner_key + ' ' + active_key
        + ' --stake-net "$stake_net"'
        + ' --stake-cpu "$stake_cpu"'
        + ' --transfer'
        + ' --buy-ram-bytes $buy_ram_bytes\n')
    }
  })

  rl.on('close', () => {
    ws.close()

    let mapSize = set_permission_map.size
    while (mapSize) {
      for (let [key, value] of set_permission_map) {
        let allIn = true
        for (let a of value.required_auth.accounts) {
          let permName = a.permission.actor + ' ' + a.permission.permission
          if (permName != key
            && 'eosio' != a.permission.actor
            && 'eosio.' != a.permission.actor.substring(0, 6)
            && 'eosio.code' != a.permission.permission
            && !permissionSet.has(permName)) {
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
        console.log('Left ' + mapSize + ' item.')
        break
      }
      mapSize = set_permission_map.size
    }
    for (let [key, value] of set_permission_map) {
      ws1.write('cleos -u $server_url set account permission '
        + key + ' \''
        + JSON.stringify(value.required_auth) + '\' -p '
        + key.split(' ')[0] + '@owner\n')
    }
    ws1.close()

    ws2.close()
  })
}

function readExcludeFile(path) {
  const rs = fs.createReadStream(path
    , { encoding: 'utf8', autoClose: true }
  )
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })

  rl.on('line', (line) => {
    excludeSet.add(line)
  })
  
  rl.on('close', () => {
    console.log('Number of excluded accounts: ' + excludeSet.size)
    createShellScript(inputPath, outputPath, url, creator, onlyPubkey)
  })
}
