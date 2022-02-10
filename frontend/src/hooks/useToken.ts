import { useRecoilValue } from 'recoil'
import _ from 'lodash'
import { MaxUint256 } from '@ethersproject/constants'

import AuthStore from 'store/AuthStore'

import { WhiteListType, AllowanceListType } from 'types/asset'

import SendStore from 'store/SendStore'
import useEtherBaseContract from './useEtherBaseContract'
import { RequestTxResultType } from 'types/send'
import { BigNumber } from "@ethersproject/bignumber";
const shuttleAddress = require('../consts/address.json')

const useToken = (): {
  getAllowances: ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }) => Promise<AllowanceListType>,
  approveToken: (amount?:string) => Promise<RequestTxResultType>
} => {
  const { getEtherBaseContract } = useEtherBaseContract()
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)
  const asset = useRecoilValue(SendStore.asset)
  const getAllowance = async ({
    token,
    userAddress,
    bridgeAddress,
  }: {
    token: string
    userAddress: string
    bridgeAddress: string
  }
  ): Promise<string> => {
    if (token === 'NATIVE') {
      return Promise.resolve(MaxUint256.toString())
    }
    const contract = getEtherBaseContract({ contract: token })

    if (contract) {
      try{
        const fn = contract['allowance']
        const allowance = await fn?.(userAddress, bridgeAddress)
        return allowance?.toString() ?? '0'
      }
      catch(e){
        console.log(e)
        return ''
      }
    }
    return ''
  }

  const getAllowances = async ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }): Promise<AllowanceListType> => {
    const userAddress = loginUser.address
    const bridgeAddress = shuttleAddress[fromBlockChain]
    const list: AllowanceListType = {}
    await Promise.all(
      _.map(whiteList, async (token) => {
        const allowance = await getAllowance({
          token:token.address,
          userAddress,
          bridgeAddress
        })
        list[token.address] = allowance
      })
    )
    return list
  }

  const approveToken = async (amount?:string): Promise<RequestTxResultType> => {
    if (!asset) {
      return {
        success: false,
      }
    }
    const bridgeAddress = shuttleAddress[fromBlockChain]
    const contract = getEtherBaseContract({ contract: asset.tokenAddress })

    if (contract && loginUser.provider) {
      const signer = loginUser.provider.getSigner()
      const withSigner = contract.connect(signer)

      try {
        const tx = withSigner.approve(bridgeAddress, amount?BigNumber.from(amount):MaxUint256)
        const {hash} = await tx
        return { success: true, hash }
      } catch (error: any) {
        return {
          success: false,
          errorMessage: _.toString(error?.message)
        }
      }
    }
    return {
      success: false,
    }
  }

  return {
    getAllowances,approveToken
  }
}

export default useToken