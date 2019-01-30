#!/usr/bin/env node

/**
 * @author UMU618 <umu618@hotmail.com>
 * @copyright MEET.ONE 2019
 * @description Use npm-coding-style.
 * #editor.tabSize: 2
 */

'use strict'

const STAKE_NET = '1.0000 MEETONE'
const STAKE_CPU = '9.0000 MEETONE'
const BUY_RAM_BYTES = 4096
const CREATOR_PERMISSION = 'active'
const DEFAULT_PUBLIC_KEY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'

let inputPath = ''
let mapFilePath = ''
let url = ''
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

  onlyPubkey = !!po.onlyPubkey
  console.log('Only Publickeys accounts: ' + onlyPubkey)
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
const eosApi = EosApi(options)

eosApi
  .getInfo({})
  .then(succeededGetChainId, failedGetChainId)

let retry = 0

function succeededGetChainId(res) {
  retry = 0
  if (res && res.chain_id) {
    console.log('ChainId: ' + res.chain_id)
    readMapFile(res.chain_id)
  }
}

function failedGetChainId(err) {
  if (retry++ < 3) {
    console.log('Retry on getInfo() for ' + retry + ' time(s).')
    eosApi
      .getInfo({})
      .then(succeededGetChainId, failedGetChainId)
  } else {
    console.log('Retry failed on getInfo()!')
  }
}

const fs = require('fs')
const readline = require('readline')
// key = mainnet account, value = sidechain account
const map = new Map()

function readMapFile(chainId) {
  const rs = fs.createReadStream(mapFilePath
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
    readInputFile(chainId)
  })
}

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

const keyUsers = new Array()
const permUsers = new Array()
const ownerPermUsers = new Array()

function readInputFile(chainId) {
  const rs = fs.createReadStream(inputPath
    , { encoding: 'utf8', autoClose: true }
  )
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })

  rl.on('line', (line) => {
    let jo = JSON.parse(line)
    if (jo.account_name && jo.permissions) {
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
            ownerPermUsers.push({
              account: sidechain_account
              , permName: perm.perm_name
              , requiredAuth: replaceActor(perm.required_auth)
              , parent: perm.parent
            })
          } else {
            permUsers.push({
              account: sidechain_account
              , permName: perm.perm_name
              , requiredAuth: replaceActor(perm.required_auth)
              , parent: perm.parent
            })
          }
        }
      }

      if (need_set_permissions || !has_owner_keys) {
        if (need_set_permissions && !need_set_owner_permission) {
          ownerPermUsers.push({
            account: sidechain_account
            , permName: 'owner'
            , requiredAuth: replaceActor(owner_required_auth)
            , parent: ''
          })
        }
        owner_key = DEFAULT_PUBLIC_KEY
      }
      if (!has_active_keys) {
        active_key = owner_key
      }
      keyUsers.push({
        account: sidechain_account
        , ownerPublicKey: owner_key
        , activePublicKey: active_key
      })
    } else {
      throw new Error(line)
    }
  })

  rl.on('close', () => {
    console.log(keyUsers.length)
    console.log(permUsers.length)
    console.log(ownerPermUsers.length)

    createAccounts(chainId)
  })
}

let userIndex = 0

function createAccounts(chainId) {
  const eosjs = require('eosjs')
  const pkg = require('./package.json')
  const eos = eosjs({
    keyProvider: pkg.private_keys
    , httpEndpoint: url
    , expireInSeconds: 60
    , broadcast: true
    , debug: false
    , sign: true
    , chainId: chainId
  })

  let user = keyUsers[userIndex]
  newAccount(eos, creator, user.account
    , user.ownerPublicKey, user.activePublicKey)
}

function newAccount(eos, creator, accountName, ownerPublicKey, activePublicKey) {
  eos
    .transaction({
      actions: [{
        account: 'eosio',
        name: 'newaccount',
        authorization: [{
          actor: creator,
          permission: CREATOR_PERMISSION,
        }],
        data: {
          creator: creator,
          name: accountName,
          owner: {
            threshold: 1,
            keys: [{
              key: ownerPublicKey,
              weight: 1
            }],
            accounts: [],
            waits: []
          },
          active: {
            threshold: 1,
            keys: [{
              key: activePublicKey,
              weight: 1
            }],
            accounts: [],
            waits: []
          },
        },
      },
      {
        account: 'eosio',
        name: 'buyrambytes',
        authorization: [{
          actor: creator,
          permission: CREATOR_PERMISSION,
        }],
        data: {
          payer: creator,
          receiver: accountName,
          bytes: BUY_RAM_BYTES,
        },
      },
      {
        account: 'eosio',
        name: 'delegatebw',
        authorization: [{
          actor: creator,
          permission: CREATOR_PERMISSION,
        }],
        data: {
          from: creator,
          receiver: accountName,
          stake_net_quantity: STAKE_NET,
          stake_cpu_quantity: STAKE_CPU,
          transfer: 0,
        }
      }]
    })
    .then(succeededTrx, failedTrx)

  function succeededTrx(res) {
    retry = 0
    console.log('+ ' + accountName + ', trx_id: ' + res.processed.id
      + ', block_num: ' + res.processed.block_num
      + ', block_time: ' + res.processed.block_time)

    if (++userIndex < keyUsers.length) {
      let user = keyUsers[userIndex]
      newAccount(eos, creator, user.account
        , user.ownerPublicKey, user.activePublicKey)
    } else {
      console.log('Finish creating accounts!')
    }
  }

  function failedTrx(err) {
    if (err) {
      try {
        let e = JSON.parse(err)
        // account_name_exists_exception
        if (e && e.code == 500 && e.error.code == 3050001) {
          retry = 0
          console.log('= ' + accountName)

          if (++userIndex < keyUsers.length) {
            let user = keyUsers[userIndex]
            newAccount(eos, creator, user.account
              , user.ownerPublicKey, user.activePublicKey)
          } else {
            console.log('Finish creating accounts!')
          }
          return
        } else {
          console.error(err)
        }
      } catch(ex) {
        console.error(err)
      }
    }

    if (retry++ < 3) {
      console.log('Retry on newAccount(' + accountName + ') for ' + retry
        + ' time(s).')
      newAccount(eos, creator, accountName, ownerPublicKey, activePublicKey)
    } else {
      console.log('Retry failed on newAccount(' + accountName + ')!')
    }
  }
}