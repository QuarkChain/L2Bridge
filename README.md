# L2Bridge

The L2Bridge is a cross-layer-2 protocol that provides asset transfer between existing L2 networks. The main idea is based on Vitalik's idea in https://notes.ethereum.org/@vbuterin/cross_layer_2_bridges and further illustrated at https://medium.com/@qizhou_63115/cross-l2-bridge-hashed-timelock-contract-vs-delayed-proved-timelock-contract-7e738dd2094e.

The main features of the bridges are:
- Almost instant user asset transfer;
- Single user operation (compared to two-step operations in HTLC);
- Does not rely on additional security assumption (e.g., 3rd party), i.e., only assuming L1/L2 security;
- No off-chain LP matching (instead, using a reverse fee auction).


## Contracts

- `L2BridgeSource.sol`: source bridge for user to deposit the source token and for LP to withdraw the source token
- `L2BridgeDestination.sol`: destination bridge for LP to buy user's source token
- `OptimismL1Bridge.sol`: Layer1 bridge that sync the status between source and destination bridge on Layer 2


## Deployments

### Kovan Testnet

| Name      | Address                                    |
| --------- | ------------------------------------------ |
| [L1 Bridge](https://kovan.etherscan.io/address/0x34Fb74842eFd8f43EaB03DE3c713868D0ba6dC0c) | 0x34Fb74842eFd8f43EaB03DE3c713868D0ba6dC0c |

### Optimism Testnet

| Name                        | Address                                    |
| --------------------------- | ------------------------------------------ |
| [L2 Source Bridge](https://kovan-optimistic.etherscan.io/address/0x524867916F136b56083b7b1F071d228361A6600E)            | 0x524867916F136b56083b7b1F071d228361A6600E |
| [L2 Destination Bridge](https://kovan-optimistic.etherscan.io/address/0x0AD853E840cCa279F24c59698751aD2635E5c533)       | 0x0AD853E840cCa279F24c59698751aD2635E5c533 |
| [L2 Source Token (USDC)](https://kovan-optimistic.etherscan.io/address/0xF495b9DE9143e9CB81087880d089aA161Bb6B82B)      | 0xF495b9DE9143e9CB81087880d089aA161Bb6B82B |
| [L2 Destination Token (USDT)](https://kovan-optimistic.etherscan.io/address/0x352ad2db4b7695B2919e0926FF7659FEa16d7f5C) | 0x352ad2db4b7695B2919e0926FF7659FEa16d7f5C |

## Tutorial

You can deploy and run the app locally, or reuse the contracts and [app](https://l2bridge.vercel.app/) with the [demo](demo.mp4).
