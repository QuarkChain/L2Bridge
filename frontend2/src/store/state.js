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
  chainId: '0x66eed',
  chainName: 'Arbitrum',
  rpc: ['https://goerli-rollup.arbitrum.io/rpc/'],
  explorer: ['https://goerli-rollup-explorer.arbitrum.io/'],
  bridge: [
    {
      src: '0xa8C38635D73AF4E36598d062D971296DBD577a24',
      destChainId: '0x1a4',
      destChainName: 'Optimism',
      destRpc: 'https://goerli.optimism.io/',
      dest: '0xb4b6FC1F5Eb3822E3cAA14960646CDd63AB2cDDA',
    },
  ],
  USDT: {
    address: "0x3D21CEd9E5F2CA9393AF09897F0c43fa4d2B4a34",
    decimals: 18,
  },
  USDC: {
    address: "0x7ED4737F9AcEF816d0733A02CB35510b46C280Ff",
    decimals: 18,
  },
},
{
  chainId: '0x1a4',
  chainName: 'Optimism',
  rpc: ['https://goerli.optimism.io/'],
  explorer: ['https://blockscout.com/optimism/goerli/'],
  bridge: [
    {
      src: '0x7b1E1ECf3BCd2Bf16eECdDaAc43316813d2d9777',
      destChainId: '0x66eed',
      destChainName: 'Arbitrum',
      destRpc: 'https://goerli-rollup.arbitrum.io/rpc/',
      dest: '0x04b820431E02fA97De8d6B7d639fFbA300A8617E',
    },
  ],
  USDT: {
    address: "0x33C27Ea9A7312f98838Ce32fD7ff8B6127B402BB",
    decimals: 18,
  },
  USDC: {
    address: "0x8A0ABea5E8bfE2d3014163bA47B29FF041A49A0a",
    decimals: 18,
  },
},
];
