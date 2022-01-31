import { useRecoilValue } from 'recoil'
import { ethers } from 'ethers'
import _ from 'lodash'
import BigNumber from 'bignumber.js'

import SendStore from 'store/SendStore'

// import { BlockChainType } from 'types/network'
import { ValidateItemResultType, ValidateResultType } from 'types/send'

import useAsset from './useAsset'
import { NETWORK } from 'consts'


const useSendValidate = (): {
  validateFee: () => ValidateItemResultType
  validateSendData: () => ValidateResultType
} => {
  const { formatBalance } = useAsset()

  // Send Data
  const asset = useRecoilValue(SendStore.asset)
  const toAddress = useRecoilValue(SendStore.toAddress)
  const amount = useRecoilValue(SendStore.amount)
  const memo = useRecoilValue(SendStore.memo)
  const toBlockChain = useRecoilValue(SendStore.toBlockChain)
  // const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)

  const assetList = useRecoilValue(SendStore.loginUserAssetList)
  // const feeDenom = useRecoilValue(SendStore.feeDenom)

  // const gasFee = useRecoilValue(SendStore.gasFee)
  // const tax = useRecoilValue(SendStore.tax)

  const shuttleFee = useRecoilValue(SendStore.shuttleFee)

  const validateFee = (): ValidateItemResultType => {

      const sendAmount = new BigNumber(amount)

      if (
        shuttleFee.isLessThan(0)
      ) {
        return {
          isValid: false,
          errorMessage: 'Token price is not available',
        }
      }

      if (
        sendAmount.isLessThanOrEqualTo(shuttleFee)
      ) {
        return {
          isValid: false,
          errorMessage: 'Insufficient amount'
        }
      }

    return { isValid: true }
  }

  const validateAsset = (): ValidateItemResultType => {
    if (asset?.disabled) {
      return {
        isValid: false,
        errorMessage: `${asset.symbol} is not available on ${NETWORK.blockChainName[toBlockChain]}`
      }
    }

    return { isValid: true }
  }

  const validateMemo = (): ValidateItemResultType => {
    if (_.isEmpty(memo)) {
      return { isValid: true, errorMessage: '' }
    }

    if (_.size(memo) >= 256) {
      return {
        isValid: false,
        errorMessage: 'Memo must be shorter than 256 bytes.'
      }
    }

    return { isValid: true }
  }

  const validateToAddress = (): ValidateItemResultType => {
    if (_.isEmpty(toAddress)) {
      return { isValid: false, errorMessage: '' }
    }

    const validAddress = ethers.utils.isAddress(toAddress)

    if (false === validAddress) {
      return { isValid: false, errorMessage: 'Invalid address' }
    }

    return { isValid: true }
  }

  const validateAmount = (): ValidateItemResultType => {
    if (_.isEmpty(amount)) {
      return { isValid: false, errorMessage: '' }
    }

    const bnAmount = new BigNumber(amount)

    if (_.isNaN(bnAmount) || bnAmount.isNegative() || bnAmount.isZero()) {
      return { isValid: false, errorMessage: 'Amount must be greater than 0' }
    }

    const rebalanceDecimal = new BigNumber(asset?.decimal || 18).minus(6)
    const rebalanceExp = new BigNumber(10).pow(rebalanceDecimal)

    if (!bnAmount.div(rebalanceExp).isInteger()) {
      return {
        isValid: false,
        errorMessage: `Amount must be within 6 decimal points`
      }
    }

    const selectedAssetAmount = new BigNumber(
      assetList.find((x) => x.tokenAddress === asset?.tokenAddress)?.balance ||
      '0'
    )
    if (selectedAssetAmount.isLessThanOrEqualTo(0)) {
      return {
        isValid: false,
        errorMessage: 'Insufficient balance'
      }
    }

    if (bnAmount.isGreaterThan(selectedAssetAmount)) {
      return {
        isValid: false,
        errorMessage: `Amount must be between 0 and ${formatBalance(
          selectedAssetAmount.toString(), asset?.decimal
        )}`
      }
    }

    return { isValid: true }
  }

  const validateSendData = (): ValidateResultType => {
    const toAddressValidResult = validateToAddress()
    const amountValidResult = validateAmount()
    const memoValidResult = validateMemo()
    const assetValidResult = validateAsset()

    return {
      isValid: _.every(
        [
          toAddressValidResult,
          amountValidResult,
          memoValidResult,
          assetValidResult
        ],
        (x) => x.isValid
      ),
      errorMessage: {
        toAddress: toAddressValidResult.errorMessage,
        amount: amountValidResult.errorMessage,
        memo: memoValidResult.errorMessage,
        asset: assetValidResult.errorMessage
      }
    }
  }

  return {
    validateFee,
    validateSendData
  }
}

export default useSendValidate
