import { useSetRecoilState } from 'recoil'
import { Network } from '@ethersproject/networks'

import { NETWORK } from 'consts'
import { BlockChainType } from 'types/network'

import SendStore from 'store/SendStore'
import AuthStore, { initLoginUser } from 'store/AuthStore'
import NetworkStore from 'store/NetworkStore'
import { User } from 'types/auth'

const { chainIdToNetwork, blockChainParam, blockChainId } = NETWORK

const useAuth = (): {
  login: ({ user }: { user: User }) => Promise<void>
  logout: () => void,
  switchOrAddNetwork: (chain: BlockChainType) => Promise<void>
} => {
  const setLoginUser = useSetRecoilState(AuthStore.loginUser)
  const setEtherBaseExt = useSetRecoilState(NetworkStore.etherBaseExt)
  // const setTerraExt = useSetRecoilState(NetworkStore.terraExt)
  // const setTerraLocal = useSetRecoilState(NetworkStore.terraLocal)
  // const setIsVisibleNotSupportNetworkModal = useSetRecoilState(
  //   NetworkStore.isVisibleNotSupportNetworkModal
  // )
  // const setTriedNotSupportNetwork = useSetRecoilState(
  //   NetworkStore.triedNotSupportNetwork
  // )

  const setFromBlockChain = useSetRecoilState(
    SendStore.fromBlockChain
  )

  const checkIsValidEtherNetwork = ({
                                      network
                                    }: {
    network?: Network
  }): boolean => {
    if (network) {
      return network.chainId in chainIdToNetwork
    }

    return false
  }

  const login = async ({ user }: { user: User }): Promise<void> => {
    // @ts-ignore

    const network = await user.provider?.getNetwork()
    const isValidEtherNetwork = checkIsValidEtherNetwork({ network })
    if (network && isValidEtherNetwork) {
        setFromBlockChain(chainIdToNetwork[network.chainId])
        setEtherBaseExt(network)
    }
    // DON'T MOVE
    // set user have to be after set network info
    setLoginUser(user)
  }

  const logout = (): void => {
    setLoginUser(initLoginUser)
    setEtherBaseExt(undefined)
    // setTerraExt(undefined)
  }

  const switchOrAddNetwork = async (chain: BlockChainType): Promise<void> => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x'+ blockChainId[chain].toString(16) }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [blockChainParam[chain]],
          });
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  }

  return { login, logout, switchOrAddNetwork }
}

export default useAuth
