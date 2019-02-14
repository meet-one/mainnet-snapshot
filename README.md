# MEET.ONE Sidechain Preparation Tools

## 0. [Optional] Preparation

You may need to install/update nodejs.

**Ubuntu** reference: <https://github.com/nodesource/distributions/blob/master/README.md>

```
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs
```

You may need to install/update yarn.

**Ubuntu** reference: <https://yarnpkg.com/en/docs/install#debian-stable>

```
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt-get update && sudo apt-get install --no-install-recommends yarn
```

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

### Get balances of MEET.ONE accounts

```
node 5-get-meetone-balancei.js -m mainnet-4-meetone-accounts.txt
```

### Sort MEET.ONE accounts by balance

```
node 6-sort-balance.js mainnet-5-meetone-balance.txt
```
