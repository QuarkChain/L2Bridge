import { useRecoilValue, useSetRecoilState } from 'recoil'
import _ from 'lodash'
import BigNumber from 'bignumber.js'

import { ASSET } from 'consts'
import AuthStore from 'store/AuthStore'
import SendStore from 'store/SendStore'

import { AssetType, WhiteListType, BalanceListType, AllowanceListType, TokenTypeEnum } from 'types/asset'
import { BlockChainType } from 'types/network'

// import useTerraBalance from './useTerraBalance'
import useEtherBaseBalance from './useEtherBaseBalance'
import useToken from './useToken'
import ContractStore from 'store/ContractStore'

const useAsset = (): {
  getAssetList: () => Promise<void>
  formatBalance: (
    balance: string | BigNumber, decimal: string | BigNumber | undefined) => string
} => {
  const isLoggedIn = useRecoilValue(AuthStore.isLoggedIn)
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)
  // const toBlockChain = useRecoilValue(SendStore.toBlockChain)

  // const terraWhiteList = useRecoilValue(ContractStore.terraWhiteList)
  const ethWhiteList = useRecoilValue(ContractStore.ethWhiteList)
  const bsctestWhiteList = useRecoilValue(ContractStore.bsctestWhiteList)
  const qkcWhiteList = useRecoilValue(ContractStore.qkcWhiteList)
  const qkcdevWhiteList = useRecoilValue(ContractStore.qkcdevWhiteList)
  const rinkebyWhiteList = useRecoilValue(ContractStore.rinkebyWhiteList)
  const ropstenWhiteList = useRecoilValue(ContractStore.ropstenWhiteList)

  const setAssetList = useSetRecoilState(SendStore.loginUserAssetList)

  // const { getTerraBalances } = useTerraBalance()
  const { getEtherBalances} = useEtherBaseBalance()
  const { getAllowances } = useToken()

  // const getTerraWhiteList = async (): Promise<WhiteListType> => {
  //   return {
  //     ...ASSET.nativeDenoms,
  //     ...terraWhiteList,
  //   }
  // }

  const setBalanceToAssetList = ({
    assetList,
    whiteList,
    balanceList,
    allowanceList,
  }: {
    assetList: AssetType[]
    whiteList: WhiteListType
    balanceList: BalanceListType
    allowanceList: AllowanceListType
  }): AssetType[] => {
    if (_.some(balanceList)) {
      return _.map(assetList, (asset) => {
        // asset.symbol not in whiteList
        if (!_.has(whiteList, asset.symbol)) {
          return asset
        }
        if (fromBlockChain === BlockChainType.qkc || fromBlockChain === BlockChainType.qkcdev) {
          // pick native or wrapped token from qkc
          if (asset.type === TokenTypeEnum.Canonical) {
            return asset
          }
        }

        const tokenAddress = whiteList[asset.symbol]?.address

        return {
          ...asset,
          tokenAddress: tokenAddress,
          mapping: whiteList[asset.symbol]['mappedToken'],
          balance: balanceList[tokenAddress]['balance'],
          decimal: balanceList[tokenAddress]['decimal'],
          allowance: allowanceList[tokenAddress],
        }
      }).filter((x) => x.tokenAddress)
    }

    return assetList
  }

  const getAssetList = async (): Promise<void> => {
    const assetList = ASSET.assetList
    let whiteList: WhiteListType = {}
    let balanceList: BalanceListType = {}
    let allowanceList: AllowanceListType = {}
    if (isLoggedIn) {
      if (fromBlockChain === BlockChainType.qkc) {
        whiteList = qkcWhiteList;
        balanceList = await getEtherBalances({ whiteList})
        allowanceList = await getAllowances({ whiteList})
      } else if (fromBlockChain === BlockChainType.ethereum) {
        whiteList = ethWhiteList
        balanceList = await getEtherBalances({ whiteList })
        allowanceList = await getAllowances({ whiteList })
      } else if (fromBlockChain === BlockChainType.bsctest) {
        whiteList = bsctestWhiteList
        balanceList = await getEtherBalances({ whiteList })
        allowanceList = await getAllowances({ whiteList })
      } else if (fromBlockChain === BlockChainType.rinkeby) {
        whiteList = rinkebyWhiteList
        balanceList = await getEtherBalances({ whiteList })
        allowanceList = await getAllowances({ whiteList })
      } else if (fromBlockChain === BlockChainType.ropsten) {
        whiteList = ropstenWhiteList
        balanceList = await getEtherBalances({ whiteList })
        allowanceList = await getAllowances({ whiteList })
      } else if (fromBlockChain === BlockChainType.qkcdev) {
        whiteList = qkcdevWhiteList
        balanceList = await getEtherBalances({ whiteList })
        allowanceList = await getAllowances({ whiteList })
      }
    }

    const fromList = setBalanceToAssetList({
      assetList,
      whiteList,
      balanceList,
      allowanceList
    })

    setAssetList(fromList)
  }

  const formatBalance = (balance: string | BigNumber, decimal: string | BigNumber | undefined): string => {
    if (!decimal) {
      decimal = '18'
    }
    if (balance) {
      const bnBalance =
        typeof balance === 'string' ? new BigNumber(balance) : balance
      const bnDecimal =
        typeof decimal === 'string' ? new BigNumber(decimal) : decimal
      const decimalExp = new BigNumber(10).exponentiatedBy(bnDecimal || 18)

      return bnBalance.div(decimalExp).times(1e6)
        .integerValue(BigNumber.ROUND_DOWN)
        .div(1e6)
        .toString(10)
    }

    return ''
  }

  return {
    getAssetList,
    formatBalance,
  }
}

export default useAsset
