# L2Bridge

The L2Bridge is a cross-layer-2 protocol that provides asset transfer between existing L2 networks. The main idea is to sacrifice the time cost of the Liquidiy Provider and make the user transfer their asset real time.


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

You deploy or reuse the contracts and [app](l2bridge.vercel.app) following the [demo](demo.mp4).