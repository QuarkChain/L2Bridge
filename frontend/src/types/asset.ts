export enum AssetSymbolEnum {
  "Source" = "USDC",
  "Destination" = "USDT"
}

export enum TokenTypeEnum {
  Native,
  Source,
  Destination
}

export type AssetType = {
  symbol: AssetSymbolEnum
  name: string
  loguURI: string
  tokenAddress: string
  type: TokenTypeEnum
  id?: string
  price?: string
  balance?: string
  allowance?: string
  disabled?: boolean
  decimal?: string
  mapping: Record<string, string>
}

export type WhiteListItemType = {
  address: string
  id: string
  mappedToken: Record<string, string>
}

export type WhiteListType = Record<
  string, // symbol
  WhiteListItemType
>

export type BalanceItemType = {
  balance: string
  decimal: string
}

export type BalanceListType = Record<
  string, // tokenAddress
  BalanceItemType
>

export type AllowanceListType = Record<
  string, // tokenAddress
  string // allowance
>