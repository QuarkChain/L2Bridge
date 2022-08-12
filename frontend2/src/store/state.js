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
      src: '0xc5C6e34605e511000C1a0052aA5CD539e869B9e7',
      destChainId: '0x1a4',
      destChainName: 'Optimism',
      destRpc: 'https://goerli.optimism.io/',
      dest: '0xec45082f8f89e1d6E516aC132D8bC2A78610Ec78',
    },
  ],
  USDT: {
    address: "0xE77815fAC07009fD53e34E7F2874f0e781638E50",
    decimals: 18,
  },
  USDC: {
    address: "0x9edd2920723290277BE071AfFF1De9a843451871",
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
      src: '0xeE214CB2E99cc17A57C4fB71aB436Ad79980a119',
      destChainId: '0x66eed',
      destChainName: 'Arbitrum',
      destRpc: 'https://goerli-rollup.arbitrum.io/rpc/',
      dest: '0x0B1dc39be156539525Cc72B2C54A99F9D43563BF',
    },
  ],
  USDT: {
    address: "0x466869e807dd3D332D9b034Fa0F0bebE55CFaf82",
    decimals: 18,
  },
  USDC: {
    address: "0x93305dE5e4809F37c23f6e5C1EE023110116eD25",
    decimals: 18,
  },
},
];
