# L2Bridge Scripts for Liquidate Providers

A handy tool for LPs to run as background services to take users' deposit orders, synchronise proofs between L2s, and withdraw LPs's funds.

# Install
```
yarn
```

# Usage Examples
```sh
# run service to watch user deposits on source chain (Optimism) and claim, sync proofs, as well as withdraw funds on target chain (Arbitrum) periodically
yarn o2a
# run service to watch user deposits on source chain (Arbitrum) and claim on target chain (Optimism)
yarn claim-a2o
# start a one time task to withdraw all claims till latest count
yarn withdraw-o2a
# start a one time task to sync the 6th proof
yarn sync-o2a 6
# start a one time task to sync the latest count
yarn sync-o2a

