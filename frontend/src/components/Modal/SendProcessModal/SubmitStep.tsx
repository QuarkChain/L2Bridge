import { ReactElement, useEffect, useState } from 'react'
import styled from 'styled-components'
import { CircularProgress } from '@material-ui/core'
import _ from 'lodash'
import { useRecoilValue, useSetRecoilState } from 'recoil'

import { COLOR, NETWORK, STYLE, UTIL } from 'consts'

import AuthStore from 'store/AuthStore'
import SendStore from 'store/SendStore'
import SendProcessStore, { ProcessStatus } from 'store/SendProcessStore'

import { Text } from 'components'
import Button from 'components/Button'
import FormErrorMessage from 'components/FormErrorMessage'
import FormImage from 'components/FormImage'
import ExtLink from 'components/ExtLink'

import { RequestTxResultType } from 'types/send'
import { WalletEnum } from 'types/wallet'
import { BlockChainType } from 'types/network'

import useAsset from 'hooks/useAsset'
import useSend from 'hooks/useSend'
import useNetwork from 'hooks/useNetwork'
// import useTerraTxInfo from 'hooks/useTerraTxInfo'
import { ModalProps } from '..'
import { TokenTypeEnum } from 'types/asset'

const StyledContainer = styled.div`
  padding: 0;
`

const StyledInfoText = styled(Text)`
  white-space: pre-wrap;
  text-align: center;
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  color: ${COLOR.skyGray};
`

const StyledToAddress = styled.div`
  border-radius: ${STYLE.css.borderRadius};
  margin-bottom: 20px;
  font-size: 12px;
  word-break: break-all;
  text-align: center;
`

const StyledAmountText = styled(Text)<{ isError?: boolean }>`
  color: ${(props): string => (props.isError ? 'red' : COLOR.text)};
`

const SubmitStepButton = ({
  modal,
  loading,
  onClickSubmitButton,
}: {
  modal: ModalProps
  loading: boolean
  onClickSubmitButton: () => Promise<void>
}): ReactElement => {
  const status = useRecoilValue(SendProcessStore.sendProcessStatus)
  const loginUser = useRecoilValue(AuthStore.loginUser)

  const IfLoadingText = (): ReactElement => {
    return loading ? (
      <CircularProgress size={20} style={{ color: COLOR.darkGray2 }} />
    ) : (
      <>Submit transaction via {loginUser.walletType}</>
    )
  }

  return status === ProcessStatus.Done ? (
    <Button onClick={modal.close}>Done</Button>
  ) : (
    <Button disabled={loading} onClick={onClickSubmitButton}>
      <IfLoadingText />
    </Button>
  )
}

const SubmitStep = ({ modal }: { modal: ModalProps }): ReactElement => {
  const { submitRequestTx, waitForEtherBaseTransaction } = useSend()
  const { formatBalance } = useAsset()

  // Send Data
  const asset = useRecoilValue(SendStore.asset)
  const amount = useRecoilValue(SendStore.amount)
  const toBlockChain = useRecoilValue(SendStore.toBlockChain)
  const toAddress = useRecoilValue(SendStore.toAddress)
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)
  const amountAfterShuttleFee = useRecoilValue(SendStore.amountAfterShuttleFee)

  const setStatus = useSetRecoilState(SendProcessStore.sendProcessStatus)
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const [requestTxResult, setrequestTxResult] = useState<RequestTxResultType>()
  const [errorMessage, setErrorMessage] = useState('')
  const [sumbitError, setSumbitError] = useState('')

  const [displayAmount] = useState(amount)
  const [displayToAddress] = useState(toAddress)

  const { getScannerLink } = useNetwork()
  // const { getTxInfos } = useTerraTxInfo()
  const [loading, setloading] = useState(false)

  const waitForReceipt = async ({
    submitResult,
  }: {
    submitResult: RequestTxResultType
  }): Promise<void> => {
    if (submitResult.success) {
      setloading(true)
      setStatus(ProcessStatus.Pending)

      try {
        if (fromBlockChain === BlockChainType.qkc) {
          setStatus(ProcessStatus.Done)
        } else {
          if (fromBlockChain === BlockChainType.bsc){
            await waitForEtherBaseTransaction({
              hash: submitResult.hash,
            })
          }
          setloading(false)
          setStatus(ProcessStatus.Done)
        }
      } catch (error) {
        setSumbitError(_.toString(error))
      }
    } else {
      setErrorMessage(submitResult.errorMessage || '')
    }
  }

  const onClickSubmitButton = async (): Promise<void> => {
    setErrorMessage('')
    setloading(true)
    const submitResult = await submitRequestTx()

    setloading(false)
    setrequestTxResult(submitResult)

    waitForReceipt({ submitResult })
  }

  // try confirm immediately
  useEffect(() => {
    // onClickSubmitButton()
  }, [])

  return (
    <StyledContainer>
      <div>
        <StyledInfoText>
          {`Transferring ${asset?.symbol} from ${NETWORK.blockChainName[fromBlockChain]} Network to ${NETWORK.blockChainName[toBlockChain]} Network.\nTransaction will be submitted via ${loginUser.walletType}`}
        </StyledInfoText>
        {loginUser.walletType === WalletEnum.WalletConnect && loading && (
          <FormErrorMessage
            style={{
              whiteSpace: 'pre-wrap',
              textAlign: 'center',
              display: 'block',
            }}
            errorMessage={
              'If loading takes too long after sending transaction on your WalletConnect, \nplease check if your application is up to date.'
            }
          />
        )}
        <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FormImage src={asset?.loguURI || ''} size={24} />
            <Text
              style={{
                fontSize: 22,
                paddingLeft: 10,
                letterSpacing: -0.5,
                wordBreak: 'break-all',
              }}
            >
              {formatBalance(displayAmount, asset?.decimal)} {asset?.symbol}
            </Text>
          </div>
              <div style={{ fontSize: 12 }}>
                <StyledAmountText
                  isError={amountAfterShuttleFee.isLessThanOrEqualTo(0)}
                >
                  {`After bridge fee : (estimated) ${formatBalance(
                    amountAfterShuttleFee,
                    asset?.decimal
                  )} ${asset?.symbol}`}
                </StyledAmountText>
              </div>
        </div>
      </div>

      <StyledToAddress>
        <div>
          <Text style={{ color: COLOR.skyGray, marginBottom: 5 }}>
            To Address
          </Text>
        </div>
        <ExtLink
            href={getScannerLink({
              address: toAddress,
              type: 'address',
              chain: toBlockChain,
            })}
          >
            {displayToAddress}
          </ExtLink>
      </StyledToAddress>

      {requestTxResult?.success && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
          }}
        >
          <div>
            <Text style={{ color: COLOR.skyGray, marginBottom: 5 }}>
              {asset?.type === TokenTypeEnum.Wrapped?"Burn":"Lock"} Tx
            </Text>
          </div>
          <ExtLink
            href={getScannerLink({
              address: requestTxResult.hash,
              type: 'tx',
              chain: fromBlockChain,
            })}
          >
            {UTIL.truncate(requestTxResult.hash, [15, 15])}
          </ExtLink>
          <br/>
          <StyledInfoText
            style={{
              marginTop: 20,
            }}
          >
          {`The transaction has been submitted at ${NETWORK.blockChainParam[fromBlockChain].chainName}, please wait for the ${NETWORK.blockChainParam[toBlockChain].chainName} to process your request`}
          </StyledInfoText>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <SubmitStepButton
          modal={modal}
          onClickSubmitButton={onClickSubmitButton}
          loading={loading}
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <FormErrorMessage errorMessage={errorMessage} />
      </div>
      {sumbitError && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Text>ERROR FROM NETWORK : </Text>
          </div>
          <FormErrorMessage errorMessage={sumbitError} />
        </div>
      )}
    </StyledContainer>
  )
}

export default SubmitStep
