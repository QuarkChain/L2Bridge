// import { useRecoilValue } from 'recoil'

// import NetworkStore from 'store/NetworkStore'
// import SendStore from 'store/SendStore'

import { BlockChainType } from 'types/network'
import {NETWORK} from 'consts'

const useNetwork = (): {
  getScannerLink: (props: { address: string; type: 'tx' | 'address' ; chain: BlockChainType}) => string
} => {

  const getScannerLink = ({
                            address,
                            type,
                            chain
                          }: {
    address: string
    type: 'tx' | 'address'
    chain: BlockChainType
  }): string => {
    let domain = NETWORK.blockChainDomain[chain]
    return `https://${domain}/${type}/${address}`
  }

  return {
    getScannerLink
  }
}

export default useNetwork
