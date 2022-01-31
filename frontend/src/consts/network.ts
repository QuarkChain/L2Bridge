import { BlockChainType, BlockChainParaType } from 'types/network'
import BinanceChainPng from 'images/BinanceChain.png'
import EthereumPng from 'images/Ethereum.png'
import QuarkChainPng from 'images/QuarkChain.png'

const blockChainImage: Record<BlockChainType, string> = {
  [BlockChainType.bsc]: BinanceChainPng,
  [BlockChainType.bsctest]: BinanceChainPng,
  [BlockChainType.qkc]: QuarkChainPng,
  [BlockChainType.qkcdev]: QuarkChainPng,
  [BlockChainType.ethereum]: EthereumPng,
  [BlockChainType.rinkeby]: EthereumPng,
  [BlockChainType.ropsten]: EthereumPng,
}

const blockChainName: Record<BlockChainType, string> = {
  [BlockChainType.bsc]: 'BSC',
  [BlockChainType.bsctest]: 'BSCTEST',
  [BlockChainType.qkc]: 'QKC',
  [BlockChainType.qkcdev]: 'QKCDEV',
  [BlockChainType.ethereum]: 'Ethereum',
  [BlockChainType.rinkeby]: 'Rinkeby',
  [BlockChainType.ropsten]: 'Ropsten',
}

const blockChainDomain: Record<BlockChainType, string> = {
  [BlockChainType.bsc]: 'mainnet.bscscan.com',
  [BlockChainType.bsctest]: 'testnet.bscscan.com',
  [BlockChainType.qkc]: 'mainnet.quarkchain.io',
  [BlockChainType.qkcdev]: 'devnet.quarkchain.io',
  [BlockChainType.ethereum]: 'etherscan.io',
  [BlockChainType.rinkeby]: 'rinkeby.etherscan.io',
  [BlockChainType.ropsten]: 'ropsten.etherscan.io',
}

const blockChainParam: Record<BlockChainType, BlockChainParaType> = {
  [BlockChainType.bsc]: {
    chainId: '0x38',
    chainName: 'Binance Smart Chain',
    nativeCurrency: {
      name: 'Binance',
      symbol: 'BNB', // 2-6 characters long
      decimals: 18
    },
    blockExplorerUrls: ['https://mainnet.bscscan.com'],
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
  },
  [BlockChainType.bsctest]: {
    chainId: '0x61',
    chainName: 'Binance Smart Chain Testnet',
    nativeCurrency: {
      name: 'Binance',
      symbol: 'tBNB',
      decimals: 18
    },
    blockExplorerUrls: ['https://testnet.bscscan.com'],
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
  },
  [BlockChainType.qkc]: {
    chainId: '186A0',
    chainName: 'QuarkChain Mainnet Root',
    nativeCurrency: {
      name: 'QKC',
      symbol: 'QKC',
      decimals: 18
    },
    blockExplorerUrls: ['https://mainnet.quarkchain.io'],
    rpcUrls: ['https://mainnet.quarkchain.io/rpc'],
  },
  [BlockChainType.qkcdev]: {
    chainId: '0x1ADB1',
    chainName: 'QuarkChain Devnet Shard 0',
    nativeCurrency: {
      name: 'QKC',
      symbol: 'QKC',
      decimals: 18
    },
    blockExplorerUrls: ['https://devnet.quarkchain.io/0'],
    rpcUrls: ['https://devnet-s0-ethapi.quarkchain.io'],
  },
  [BlockChainType.ethereum]: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrls: ['https://etherscan.io'],
    rpcUrls: ['https://mainnet.infura.io/v3/'],
  },
  [BlockChainType.rinkeby]: {
    chainId: '0x4',
    chainName: 'Ethereum Rinkeby',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrls: ['https://rinkeby.etherscan.io'],
    rpcUrls: ['https://rinkeby.infura.io/v3/'],
  },
  [BlockChainType.ropsten]: {
    chainId: '0x3',
    chainName: 'Ethereum Ropsten',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrls: ['https://ropsten.etherscan.io'],
    rpcUrls: ['https://ropsten.infura.io/v3/'],
  },
}


const blockChainId: Record<BlockChainType, number> = {
  [BlockChainType.bsc]: 56,
  [BlockChainType.bsctest]: 97,
  [BlockChainType.qkc]: 100000,
  [BlockChainType.qkcdev]: 110001,
  [BlockChainType.ethereum]: 1,
  [BlockChainType.rinkeby]: 4,
  [BlockChainType.ropsten]: 3,
}

const chainIdToNetwork: Record<number, BlockChainType> = {
  // 4: BlockChainType.rinkeby,
  // 3: BlockChainType.ropsten,
  110001: BlockChainType.qkcdev,
  97: BlockChainType.bsctest,
}

const QKC_NETWORKID = {
  MAIN_NET: '0x1',
  DEV_NET: '0xff'
}

const QKC_SHARDID = {
  SHARD0: '0x00000000'
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price'

const INFURAID = '87ae9df0054a4467b5de8501e80bc07c'

const TERRA_EXTENSION = 'https://terra.money/extension'
const BSC_EXTENSION =
  'https://chrome.google.com/webstore/detail/binance-chain-wallet/fhbohimaelbohpjbbldcngcnapndodjp?utm_source=chrome-ntp-icon'
const CHROME = 'https://google.com/chrome'

// const terra_networks: Record<'mainnet' | 'testnet', LocalTerraNetwork> = {
//   mainnet: {
//     mantle: 'https://mantle.terra.dev/',
//     shuttle: {
//       qkc: 'terra13yxhrk08qvdf5zdc9ss5mwsg5sf7zva9xrgwgc',
//       ethereum: 'terra13yxhrk08qvdf5zdc9ss5mwsg5sf7zva9xrgwgc',
//       bsc: 'terra1g6llg3zed35nd3mh9zx6n64tfw3z67w2c48tn2',
//     },
//   },
//   testnet: {
//     mantle: 'https://tequila-mantle.terra.dev/',
//     shuttle: {
//       qkc: 'terra10a29fyas9768pw8mewdrar3kzr07jz8f3n73t3',
//       ethereum: 'terra10a29fyas9768pw8mewdrar3kzr07jz8f3n73t3',
//       bsc: 'terra1paav7jul3dzwzv78j0k59glmevttnkfgmgzv2r',
//     },
//   },
// }
//
// const SHUTTLE_PAIRS = 'https://assets.terra.money/cw20/pairs.json'
//
// const TERRA_WHITELIST = 'https://assets.terra.money/cw20/tokens.json'
// const ETH_WHITELIST = 'https://assets.terra.money/shuttle/eth.json'
// const BSC_WHITELIST = 'https://assets.terra.money/shuttle/bsc.json'

export default {
  blockChainImage,
  blockChainName,
  blockChainId,
  blockChainDomain,
  blockChainParam,
  chainIdToNetwork,
  // terra_networks,
  INFURAID,
  TERRA_EXTENSION,
  BSC_EXTENSION,
  CHROME,
  QKC_NETWORKID,
  QKC_SHARDID,
  COINGECKO_API,
  // SHUTTLE_PAIRS,
  // TERRA_WHITELIST,
  // ETH_WHITELIST,
  // BSC_WHITELIST,
}
