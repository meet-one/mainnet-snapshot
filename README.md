# MEET.ONE Sidechain Preparation Tools

## 1. Install required nodejs modules

```
yarn install
```

Or

```
yarn add commander
yarn add eosjs
yarn add moment
```

## 2. [Optional] Add getTableByScope to [eosjs-api](https://github.com/EOSIO/eosjs-api)

If your [chain.json](https://github.com/EOSIO/eosjs-api/blob/master/src/api/v1/chain.json) does not have getTableByScope, [add getTableByScope](https://github.com/EOSIO/eosjs-api/pull/19) to node_modules/eosjs-api/lib/api/v1/chain.json.

Refer to [meet-one's fork of eosjs-api](https://github.com/meet-one/eosjs-api/blob/master/src/api/v1/chain.json).

```
wget https://raw.githubusercontent.com/meet-one/eosjs-api/master/src/api/v1/chain.json -O node_modules/eosjs-api/lib/api/v1/chain.json
```

## 3. Run snapshot-scripts one by one

### Export all accounts of mainnet

```
node 1-export-accounts.js -m
```

### Get accounts info

```
node 2-get-accounts-info.js -m mainnet-1-all-accounts.txt
```

### Convert accounts info to 'create accounts' shell script

```
node 3-create-accounts.js mainnet-2-info.txt
```

### Calculate total staked EOS for NET and CPU

```
node 3-calc-total-staked-eos.js mainnet-2-info.txt
```

### Convert accounts info to 'create sidechain accounts' shell script

```
node 3-create-sidechain-accounts.js mainnet-2-info.txt
```

### Export MEET.ONE accounts of mainnet

```
node 4-export-meetone-accounts.js -m
```
