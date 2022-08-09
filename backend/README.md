# L2Bridge Scripts for Liquidate Providers

## Introduction
A handy tool for LPs to run as background services to take users' deposit orders, synchronise proofs between L2s, and withdraw LPs's funds.

## Install
```
yarn
```

## Confguration
```sh
# private key of the LP address
PRIVATE_KEY=""
# location of the json file with information of contract deployments
DEPLOYMENTS="../../contract/deployments.json"
# L1 RPC URL ends with infura project id
RPC_L1="https://goerli.infura.io/v3/xxx"
# Optimism RPC URL
RPC_OP="https://goerli.optimism.io/"
# Arbitrum RPC URL
RPC_AB="https://goerli-rollup.arbitrum.io/rpc/"
GAS_PRICE_L1=0
GAS_PRICE_OP=0
GAS_PRICE_AB=0
# LP fee threshold to claim in USD
MIN_FEE=0.01
# Query interval of user deposit event in seconds
CLAIM_INTERVAL_SECONDS=30
# L1 chain ID
L1_CHAIN_ID=5
# Fund direction with valid value of O2A (user deposits on Optimism; LP claims on Arbitrum) and A2O (opposit)
DIRECTION=O2A
```
## Usage Examples
```sh
# Start a service to watch user deposits on source chain, and to claim, sync proofs, as well as withdraw funds on target chain as soon as sync finishes.
yarn start
# Start a service to watch user deposits on source chain, and to claim on target chain.
yarn claim
# Execute a one time task to sync the latest count, and withdraw all claimed funds.
yarn sync
# Execute a one time task to sync the proof of count 6 and withdraw all claimed funds before it.
yarn sync 6
# Execute a one time task to list the status of each claimed count
yarn status
