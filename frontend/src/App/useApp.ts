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
  const opListJson = require('../consts/op_whitelist.json')
  const arbListJson = require('../consts/arb_whitelist.json')
  // const setEthWhiteList = useSetRecoilState(ContractStore.initOnlyEthWhiteList)
  const setOpWhiteList = useSetRecoilState(ContractStore.initOnlyOpWhiteList)
  const setArbWhiteList = useSetRecoilState(ContractStore.initOnlyArbWhiteList)
  const getContractAddress = async (): Promise<void> => {
    try {
      setOpWhiteList(opListJson)
      setArbWhiteList(arbListJson)
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
