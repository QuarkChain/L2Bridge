export enum BlockChainType {
  optimism = 'optimism',
  arbitrum = 'arbitrum',
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

export type ShuttleNetwork = BlockChainType.arbitrum | BlockChainType.optimism

export interface ExtTerraNetwork {
  name: 'mainnet' | 'testnet'
  chainID: string
  lcd: string
  fcd: string
}
