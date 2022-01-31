import { useRecoilValue } from 'recoil'
import _ from 'lodash'

import AuthStore from 'store/AuthStore'

import { WhiteListType, BalanceListType } from 'types/asset'

import useEtherBaseContract from './useEtherBaseContract'
import BigNumber from 'bignumber.js'

const useEtherBaseBalance = (): {
  getEtherBalances: ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }) => Promise<BalanceListType>,
  getQKCBalances: ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }) => Promise<BalanceListType>
} => {
  const { getEtherBaseContract, getNativeBalance } = useEtherBaseContract()
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const getEtherBalance = async ({
    token,
    userAddress,
  }: {
    token: string
    userAddress: string
  }): Promise<[string, string]> => {
    if (token === "NATIVE") {
      try{
        const balance = await getNativeBalance({userAddress: userAddress})
        return [balance?.toString() || '0', '18']
      }
      catch(e){
        console.log(e)
        return ['','']
      }
    }

    const contract = getEtherBaseContract({ contract: token })

    if (contract) {
      try{
        let fn = contract['balanceOf']
        const balance = await fn?.(userAddress)
        fn = contract['decimals']
        const decimals = await fn?.call()
        return [balance?.toString() || '0', decimals?.toString() || '18']
      }
      catch(e){
        console.log(e)
        return ['','']
      }
    }
    return ['','']
  }

  const getEtherBalances = async ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }): Promise<BalanceListType> => {
    const userAddress = loginUser.address

    const list: BalanceListType = {}
    await Promise.all(
      _.map(whiteList, async (token) => {
        const balance = await getEtherBalance({
          token:token.address,
          userAddress,
        })
        list[token.address] = {'balance': balance[0], 'decimal': balance[1]}
      })
    )
    return list
  }

  const getQKCBalances = async ({
    whiteList,
  }: {
    whiteList: WhiteListType
  }): Promise<BalanceListType> => {
    const userAddress = loginUser.address
    const list: BalanceListType = {}
    const data = {"address": userAddress+"000050fD"}
    const url = 'https://devnet.quarkchain.io/getAccountData';
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const ret = await res.json();
    const balances = ret.primary.balances;
    _.map(whiteList, (target) => {
      const index = _.findIndex(balances, (token) => {// @ts-ignore
        return Number(token.tokenId, 16) === Number(target, 16) });
      list[target.address]['balance'] = index < 0 ? '0':new BigNumber(balances[index].balance, 16).toString();
      list[target.address]['decimal'] = index < 0 ? '18':new BigNumber(balances[index].decimal).toString();
    })
    return list;
  }



  return {
    getEtherBalances,getQKCBalances
  }
}

export default useEtherBaseBalance
