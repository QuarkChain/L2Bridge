# L2Bridge Scripts for Liquidate Providers

## Introduction
A handy tool for LPs to run as background services to take users' deposit orders, synchronise proofs between L2s, and withdraw LPs's funds.

## Install
```
yarn
```

## Usage Examples
```sh
# start a service to watch user deposits on source chain (Optimism) and claim, sync proofs, as well as withdraw funds on target chain (Arbitrum) as soon as sync finishes.
yarn o2a
# start a service like above but in the other direction (Arbitrum to Optimism)
yarn a2o
# start a service to watch user deposits on source chain (Arbitrum) and claim on target chain (Optimism); no sync and withdraw.
yarn a2o-claim
# execute a one time task trying to sync the 6th proof and withdraw
yarn o2a-sync 6
# execute a one time task to sync the latest claimed count and withdraw
yarn o2a-sync
# execute a one time task to list the status of each claimed count that is being synced
yarn o2a-status
...
