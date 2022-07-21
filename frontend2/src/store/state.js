export const chainInfos = [{
  chainId: '0xa4b1',
  chainName: 'Arbitrum',
  rpc: ['https://arb1.arbitrum.io/rpc'],
  explorer: ['https://arbiscan.io'],
  bridgeSrc: '0xDE58cC16DEFc24E2ed59F69960AeB68266DA0167',
  bridgeDest: '0xAB8489e7f3224bC6C894350467C1aB1DFCFb518B',
},
{
  chainId: '0xa',
  chainName: 'Optimism',
  rpc: ['https://mainnet.optimism.io'],
  explorer: ['https://optimistic.etherscan.io'],
  bridgeSrc: '0xDE58cC16DEFc24E2ed59F69960AeB68266DA0167',
  bridgeDest: '0xAB8489e7f3224bC6C894350467C1aB1DFCFb518B',
},
{
  chainId: '0x45',
  chainName: 'Optimism1',
  rpc: ['https://kovan.optimism.io/'],
  explorer: ['https://kovan-optimistic.etherscan.io/'],
  bridge: [
    {
      src: '0xDE58cC16DEFc24E2ed59F69960AeB68266DA0167',
      dest: '0xAB8489e7f3224bC6C894350467C1aB1DFCFb518B',
      destChainName: 'Optimism2',
      destRpc: 'https://kovan.optimism.io/',
    },
  ],
  USDT: {
    address: "0x352ad2db4b7695B2919e0926FF7659FEa16d7f5C",
    decimals: 18,
  },
  USDC: {
    address: "0xF495b9DE9143e9CB81087880d089aA161Bb6B82B",
    decimals: 18,
  },
},
{
  chainId: '0x45',
  chainName: 'Optimism2',
  rpc: ['https://kovan.optimism.io/'],
  explorer: ['https://kovan-optimistic.etherscan.io/'],
  bridge: [
    {
      src: '0x596820BBF12828A5AC624c40D98988a43a1d0b22',
      dest: '0x6Eda56AcD9CC59511582Ee044cF371E13A7cb5c3',
      destChainName: 'Optimism1',
      destRpc: 'https://kovan.optimism.io/',
    },
  ],
  USDT: {
    address: "0x352ad2db4b7695B2919e0926FF7659FEa16d7f5C",
    decimals: 18,
  },
  USDC: {
    address: "0xF495b9DE9143e9CB81087880d089aA161Bb6B82B",
    decimals: 18,
  },
},
];
