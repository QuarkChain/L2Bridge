export enum BlockChainType {
  ethereum = 'ethereum',
  qkc = 'qkc',
  qkcdev = 'qkcdev',
  bsc = 'bsc',
  bsctest = 'bsctest',
  rinkeby = 'rinkeby',
  ropsten = 'ropsten',
}

export type BlockChainParaType = {
  chainId: string,
  chainName: string,
  nativeCurrency: {
    name: string,
    symbol: string,
    decimals: number,
  },
  blockExplorerUrls: string[],
  rpcUrls: string[],
}

export interface LocalTerraNetwork {
  /** Graphql server URL */
  mantle: string
  /** Ethereum */
  shuttle: Record<ShuttleNetwork, string>
}

export type ShuttleNetwork = BlockChainType.ethereum | BlockChainType.bsc | BlockChainType.qkc

export interface ExtTerraNetwork {
  name: 'mainnet' | 'testnet'
  chainID: string
  lcd: string
  fcd: string
}
