import { atom, selector } from 'recoil'
import { WhiteListType } from 'types/asset'
import NetworkStore from './NetworkStore'

export type ShuttleUusdPairType = Record<
  string, //token address
  string // pair contract address
>

const initOnlyShuttlePairs = atom<
  Record<'mainnet' | 'testnet', ShuttleUusdPairType> | undefined
>({
  key: 'initOnlyShuttlePairs',
  default: undefined,
})

const initOnlyTerraWhiteList = atom<
  Record<'mainnet' | 'testnet', WhiteListType> | undefined
>({
  key: 'initOnlyTerraWhiteList',
  default: undefined,
})

const initOnlyEthWhiteList = atom<
WhiteListType | undefined
>({
  key: 'initOnlyEthWhiteList',
  default: undefined,
})

const initOnlyQkcWhiteList = atom<
WhiteListType | undefined
>({
  key: 'initOnlyQkcWhiteList',
  default: undefined,
})

const initOnlyQkcdevWhiteList = atom<
  WhiteListType | undefined
>({
  key: 'initOnlyQkcdevWhiteList',
  default: undefined,
})

const initOnlyBsctestWhiteList = atom<
WhiteListType | undefined
>({
key: 'initOnlyBsctestWhiteList',
default: undefined,
})

const initOnlyRinkebyWhiteList = atom<
  WhiteListType | undefined
>({
  key: 'initOnlyRinkebyWhiteList',
  default: undefined,
})

const initOnlyRopstenWhiteList = atom<
  WhiteListType | undefined
>({
  key: 'initOnlyRopstenWhiteList',
  default: undefined,
})

// if empty, service will block from start
const shuttleUusdPairs = selector<ShuttleUusdPairType>({
  key: 'shuttleUusdPairs',
  get: ({ get }) => {
    const isTestnet = get(NetworkStore.isTestnet)
    const fetchedData = get(initOnlyShuttlePairs)
    if (fetchedData) {
      return fetchedData[isTestnet ? 'testnet' : 'mainnet']
    }
    return {}
  },
})

// if empty, service will block from start
const terraWhiteList = selector<WhiteListType>({
  key: 'terraWhiteList',
  get: ({ get }) => {
    const isTestnet = get(NetworkStore.isTestnet)
    const fetchedData = get(initOnlyTerraWhiteList)
    if (fetchedData) {
      return fetchedData[isTestnet ? 'testnet' : 'mainnet']
    }
    return {}
  },
})

// if empty, service will block from start
const ethWhiteList = selector<WhiteListType>({
  key: 'ethWhiteList',
  get: ({ get }) => {
    const isTestnet = get(NetworkStore.isTestnet)
    const fetchedData = get(initOnlyEthWhiteList)
    if (fetchedData) {
      return fetchedData[isTestnet ? 'testnet' : 'mainnet']
    }
    return {}
  },
})

// if empty, service will block from start
const qkcWhiteList = selector<WhiteListType>({
  key: 'qkcWhiteList',
  get: ({ get }) => {
    const isTestnet = get(NetworkStore.isTestnet)
    const fetchedData = get(initOnlyQkcWhiteList)
    if (fetchedData) {
      return fetchedData[isTestnet ? 'testnet' : 'mainnet']
    }
    return {}
  },
})

// if empty, service will block from start
const bsctestWhiteList = selector<WhiteListType>({
  key: 'bsctestWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyBsctestWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  },
})

const qkcdevWhiteList = selector<WhiteListType>({
  key: 'qkcdevWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyQkcdevWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  },
})

const rinkebyWhiteList = selector<WhiteListType>({
  key: 'rinkebyWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyRinkebyWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  }
})

const ropstenWhiteList = selector<WhiteListType>({
  key: 'ropstenWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyRopstenWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  }
})

export default {
  initOnlyShuttlePairs,
  initOnlyTerraWhiteList,
  initOnlyEthWhiteList,
  initOnlyQkcWhiteList,
  initOnlyQkcdevWhiteList,
  initOnlyBsctestWhiteList,
  initOnlyRinkebyWhiteList,
  initOnlyRopstenWhiteList,

  shuttleUusdPairs,
  terraWhiteList,
  qkcWhiteList,
  qkcdevWhiteList,
  ethWhiteList,
  bsctestWhiteList,
  rinkebyWhiteList,
  ropstenWhiteList,
}
