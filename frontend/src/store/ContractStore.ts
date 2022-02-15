import { atom, selector } from 'recoil'
import { WhiteListType } from 'types/asset'

const initOnlyArbWhiteList = atom<
  WhiteListType | undefined
>({
  key: 'initOnlyArbWhiteList',
  default: undefined,
})

const initOnlyOpWhiteList = atom<
  WhiteListType | undefined
>({
  key: 'initOnlyOpWhiteList',
  default: undefined,
})

const opWhiteList = selector<WhiteListType>({
  key: 'opWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyOpWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  }
})

const arbWhiteList = selector<WhiteListType>({
  key: 'arbWhiteList',
  get: ({ get }) => {
    const fetchedData = get(initOnlyArbWhiteList)
    if (fetchedData) {
      return fetchedData
    }
    return {}
  }
})


export default {
  initOnlyArbWhiteList,
  initOnlyOpWhiteList,
  arbWhiteList,
  opWhiteList
}
