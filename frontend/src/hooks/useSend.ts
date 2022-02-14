import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import _ from 'lodash'

import AuthStore from 'store/AuthStore'
import NetworkStore from 'store/NetworkStore'
import SendStore from 'store/SendStore'
import { NETWORK } from 'consts'

import { AssetSymbolEnum, TokenTypeEnum} from 'types/asset'
import { EtherBaseReceiptResultType, RequestTxResultType } from 'types/send'
import { WalletEnum } from 'types/wallet'

import useEtherBaseContract from './useEtherBaseContract'

const shuttleAddress = require('../consts/address.json')
const {blockChainId} = NETWORK

type UseSendType = {
  initSendData: () => void
  submitRequestTx: () => Promise<RequestTxResultType>
  getQKCFeeList: () => Promise<{
    token: AssetSymbolEnum
    fee?: Number
  }[]>
  waitForEtherBaseTransaction: (props: {
    hash: string
  }) => Promise<EtherBaseReceiptResultType | string | undefined>
}

const useSend = (): UseSendType => {
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const etherBaseExt = useRecoilValue(NetworkStore.etherBaseExt)

  // const [gasPricesFromServer, setGasPricesFromServer] = useRecoilState(
  //   SendStore.gasPrices
  // )

  // Send Data
  const [asset, setAsset] = useRecoilState(SendStore.asset)
  const [toAddress, setToAddress] = useRecoilState(SendStore.toAddress)
  const [sendAmount, setSendAmount] = useRecoilState(SendStore.amount)
  // const [memo, setMemo] = useRecoilState(SendStore.memo)
  const [sendData, setSendData] = useRecoilState(SendStore.data)
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)
  const toBlockChain = useRecoilValue(SendStore.toBlockChain)
  const shuttleFee = useRecoilValue(SendStore.shuttleFee)
  const startTime = useRecoilValue(SendStore.startTime)
  const endTime = useRecoilValue(SendStore.endTime)
  const feeRampup = useRecoilValue(SendStore.feeRampup)
  const setFee = useSetRecoilState(SendStore.fee)

  const { getEtherBaseContract } = useEtherBaseContract()

  const initSendData = (): void => {
    setAsset(undefined)
    setToAddress('')
    setSendAmount('')
    setSendData('')
    setFee(0)
  }

  const getQKCFeeList = async (): Promise<{
    token: AssetSymbolEnum
    fee?: Number
  }[]> => {
    if (etherBaseExt) {
      return Promise.all(
        _.map(AssetSymbolEnum, async (token) => {
          try {
            const shuttleFee = 0
            return {
              token,
              fee: shuttleFee
            }
          } catch {
            return {
              token
            }
          }
        })
      )
    }
    return []
  }

  // function for 'submitRequestTxFromEtherBase'
  const handleTxErrorFromEtherBase = (error: any): RequestTxResultType => {
    if (loginUser.walletType === WalletEnum.Binance) {
      return {
        success: false,
        errorMessage: _.toString(error.error)
      }
    } else if (loginUser.walletType === WalletEnum.MetaMask) {
      return {
        success: false,
        errorMessage: error?.message
      }
    }

    return {
      success: false,
      errorMessage: _.toString(error)
    }
  }

  const submitRequestTx = async (): Promise<RequestTxResultType> => {
    if (!asset) {
      return {
        success: false,
      }
    }
    const bridgeAddress = shuttleAddress[fromBlockChain]
    const contract = getEtherBaseContract({ contract: bridgeAddress })

    if (contract && loginUser.provider) {
      const signer = loginUser.provider.getSigner()
      const withSigner = contract.connect(signer)

      try {
        if (asset.type === TokenTypeEnum.Source) {
          let tx
          let pa = [asset.tokenAddress, asset?.mapping[blockChainId[toBlockChain]][1], toAddress, sendAmount, shuttleFee.toString(), startTime, feeRampup, endTime]
          let para = JSON.stringify(pa)
          console.log('para:', para)
          tx = withSigner.deposit(pa)
          const { hash } = await tx
          return { success: true, hash, para }
        } else {
          let tx
          let para = JSON.parse(sendData)
          console.log('para:', para)
          tx = withSigner.claim(para)
          const { hash } = await tx
          return { success: true, hash, para }
        }
      } catch (error) {
        return handleTxErrorFromEtherBase(error)
      }
    }

    return {
      success: false,
    }
  }

  const waitForEtherBaseTransaction = async ({
    hash
  }: {
    hash: string
  }): Promise<EtherBaseReceiptResultType | undefined> => {
    if (asset?.tokenAddress) {
      const receipt = await loginUser.provider?.waitForTransaction(hash)
      console.log('receipt', receipt)
      return receipt
    }
  }

  return {
    initSendData,
    submitRequestTx,
    getQKCFeeList,
    waitForEtherBaseTransaction
  }
}

export default useSend
