// import { NETWORK } from 'consts'
import { useSetRecoilState } from 'recoil'
// import _ from 'lodash'
import * as Sentry from '@sentry/react'

import ContractStore from 'store/ContractStore'

const useApp = (): {
  initApp: () => Promise<void>
} => {
  // const setShuttlePairs = useSetRecoilState(ContractStore.initOnlyShuttlePairs)
  // const setTerraWhiteList = useSetRecoilState(
  //   ContractStore.initOnlyTerraWhiteList
  // )
  const qkcdevListJson = require('../consts/qkcdev_whitelist.json')
  const bsctestListJson = require('../consts/bsctest_whitelist.json')
  // const setEthWhiteList = useSetRecoilState(ContractStore.initOnlyEthWhiteList)
  const setQkcdevWhiteList = useSetRecoilState(ContractStore.initOnlyQkcdevWhiteList)
  const setBsctestWhiteList = useSetRecoilState(ContractStore.initOnlyBsctestWhiteList)
  const getContractAddress = async (): Promise<void> => {
    try {
      // const fetchPairJson = await (await fetch(NETWORK.SHUTTLE_PAIRS)).json()
      // const formattedPairJson = _.reduce<
      //   any,
      //   Record<string, Record<string, string>>
      // >(
      //   fetchPairJson,
      //   (result, pairs, network) => {
      //     const val = _.reduce<any, Record<string, string>>(
      //       pairs,
      //       (obj, arr, tokenAddress) => {
      //         obj[arr[1]] = tokenAddress
      //         return obj
      //       },
      //       {}
      //     )
      //     result[network] = val
      //     return result
      //   },
      //   {}
      // )

      // setShuttlePairs(formattedPairJson)

      // const terraListJson = await (await fetch(NETWORK.TERRA_WHITELIST)).json()
      // const formattedTerraListJson = _.reduce<
      //   any,
      //   Record<string, Record<string, string>>
      // >(
      //   terraListJson,
      //   (result, pairs, network) => {
      //     const val = _.reduce<any, Record<string, string>>(
      //       pairs,
      //       (obj, info, tokenAddress) => {
      //         obj[info.symbol] = tokenAddress
      //         return obj
      //       },
      //       {}
      //     )
      //     result[network] = val
      //     return result
      //   },
      //   {}
      // )
      // setTerraWhiteList(formattedTerraListJson)

      // const ethListJson = await (await fetch(NETWORK.ETH_WHITELIST)).json()
      // setEthWhiteList(ethListJson)


      // const bscListJson = await (await fetch(NETWORK.BSC_WHITELIST)).json()
      setQkcdevWhiteList(qkcdevListJson)
      setBsctestWhiteList(bsctestListJson)
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  const initApp = async (): Promise<void> => {
    return getContractAddress()
  }

  return {
    initApp,
  }
}

export default useApp
