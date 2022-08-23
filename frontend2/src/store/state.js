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
    address: "0x4A005fed7e8Fa6d4531B071465739A4B3cf1cD20",
    decimals: 18,
  },
  USDC: {
    address: "0x50Bb60A74F2cD3Cf2369116E3E48D98da5ddc5DE",
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
    address: "0x81c816E1e22BedB4A89943E3E36824293D1a6C63",
    decimals: 18,
  },
  USDC: {
    address: "0x6b219d8e4bc31A3E2caD820C2Ab1bCc9C1F81891",
    decimals: 18,
  },
},
];
