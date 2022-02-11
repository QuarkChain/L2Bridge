import { Coin } from '@terra-money/terra.js'
import BigNumber from 'bignumber.js'
import { atom } from 'recoil'

import { AssetSymbolEnum, AssetType } from 'types/asset'
import { BlockChainType } from 'types/network'

// Send Data Start
const asset = atom<AssetType | undefined>({
  key: 'sendAsset',
  default: undefined
})
const toAddress = atom<string>({
  key: 'sendToAddress',
  default: ''
})
const amount = atom<string>({
  key: 'sendAmount',
  default: ''
})
const memo = atom<string>({
  key: 'sendMemo',
  default: ''
})
const startTime = atom<number>({
  key: 'sendStartTime',
  default: 0
})
const endTime = atom<number>({
  key: 'sendEndTime',
  default: 0
})
const feeRampup = atom<number>({
  key: 'sendFeeRampup',
  default: 0
})
const fromBlockChain = atom<BlockChainType>({
  key: 'sendFromBlockChain',
  default: BlockChainType.optimism
})
const toBlockChain = atom<BlockChainType>({
  key: 'sendToBlockChain',
  default: BlockChainType.arbitrum
})
const fee = atom<Number>({
  key: 'sendFee',
  default: 0
})
const gasPrices = atom<Record<string, string>>({
  key: 'sendGasPrices',
  default: {}
})

// Send Data End

const loginUserAssetList = atom<AssetType[]>({
  key: 'loginUserAssetList',
  default: []
})

// Computed data from Send data Start
const feeDenom = atom<AssetSymbolEnum>({
  key: 'sendFeeDenom',
  default: AssetSymbolEnum.Source
})
const gasFeeList = atom<{
  token: AssetSymbolEnum
  fee?: Number
}[]>({
  key: 'sendGasFeeList',
  default: []
})
const gasFee = atom<BigNumber>({
  key: 'sendGasFee',
  default: new BigNumber(0)
})
const tax = atom<Coin | undefined>({
  key: 'sendTax',
  default: undefined
})
const shuttleFee = atom<BigNumber>({
  key: 'sendShuttleFee',
  default: new BigNumber(0)
})
const amountWithShuttleFee = atom<BigNumber>({
  key: 'sendAmountWithShuttleFee',
  default: new BigNumber(0)
})
// Computed data from Send data End

export default {
  asset,
  toAddress,
  amount,
  memo,
  fromBlockChain,
  toBlockChain,
  fee,
  gasPrices,
  startTime,
  endTime,
  feeRampup,

  loginUserAssetList,
  feeDenom,
  gasFeeList,
  gasFee,
  tax,
  shuttleFee,
  amountWithShuttleFee
}
