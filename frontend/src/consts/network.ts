import { BlockChainType, BlockChainParaType } from 'types/network'
import OPPng from 'images/OP.png'
import ARBSVG from 'images/ARB.svg'

const blockChainImage: Record<BlockChainType, string> = {
  [BlockChainType.optimism]: OPPng,
  [BlockChainType.arbitrum]: ARBSVG,
}

const blockChainName: Record<BlockChainType, string> = {
  [BlockChainType.optimism]: 'Optimism',
  [BlockChainType.arbitrum]: 'Arbitrum',
}

const blockChainDomain: Record<BlockChainType, string> = {
  [BlockChainType.optimism]: 'https://kovan-optimistic.etherscan.io/',
  [BlockChainType.arbitrum]: 'https://rinkeby-explorer.arbitrum.io/',
}

const blockChainParam: Record<BlockChainType, BlockChainParaType> = {
  [BlockChainType.optimism]: {
    chainId: '0x45',
    chainName: "Optimism Kovan",
    nativeCurrency: {
      "name": "Kovan Ether",
      "symbol": "KOR",
      "decimals": 18
    },
    blockExplorerUrls: ["https://kovan-optimistic.etherscan.io"],
    rpcUrls: ["https://kovan.optimism.io/"],
  },
  [BlockChainType.arbitrum]: {
    chainId: '0x66EEB',
    chainName: 'Arbitrum Rinkeby',
    nativeCurrency: {
      "name": "Arbitrum Rinkeby Ether",
      "symbol": "ARETH",
      "decimals": 18
    },
    blockExplorerUrls: ["https://rinkeby-explorer.arbitrum.io"],
    rpcUrls: [
      "https://rinkeby.arbitrum.io/rpc",
      "wss://rinkeby.arbitrum.io/ws"
    ],
  }
}


const blockChainId: Record<BlockChainType, number> = {
  [BlockChainType.arbitrum]: 421611,
  [BlockChainType.optimism]: 69
}

const chainIdToNetwork: Record<number, BlockChainType> = {
  421611: BlockChainType.arbitrum,
  69: BlockChainType.optimism,
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
  COINGECKO_API,
  // SHUTTLE_PAIRS,
  // TERRA_WHITELIST,
  // ETH_WHITELIST,
  // BSC_WHITELIST,
}
