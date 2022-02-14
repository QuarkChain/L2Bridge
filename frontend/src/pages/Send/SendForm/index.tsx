import { ReactElement, useEffect, useState } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import styled from 'styled-components'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import _ from 'lodash'
import { useDebouncedCallback } from 'use-debounce'
import BigNumber from 'bignumber.js'
import { ArrowClockwise, ArrowRight, InfoCircleFill } from 'react-bootstrap-icons'

import { COLOR, NETWORK, STYLE } from 'consts'

import { BlockChainType } from 'types/network'
import { ValidateResultType, RequestTxResultType } from 'types/send'
import { Text } from 'components'
import FormInput from 'components/FormInput'
import FormLabel from 'components/FormLabel'
import FormErrorMessage from 'components/FormErrorMessage'

import useSend from 'hooks/useSend'
import useAuth from 'hooks/useAuth'
import useFee from 'hooks/useFee'
import useSendValidate from 'hooks/useSendValidate'
import useAsset from 'hooks/useAsset'
import useInterval from 'hooks/useInterval'

import AuthStore from 'store/AuthStore'
import SendStore from 'store/SendStore'
import SendProcessStore, { ProcessStatus } from 'store/SendProcessStore'

import AssetList from './AssetList'
import SelectBlockChainBox from './SelectBlockChainBox'
import SendFormButton from './SendFormButton'
import FormFeeInfo from './FormFeeInfo'
import useSelectWallet from 'hooks/useSelectWallet'
import useToken from 'hooks/useToken'
import { TokenTypeEnum } from 'types/asset'

const StyledContainer = styled(Container)`
  padding: 40px 0;
  height: 100%;
  @media (max-width: 575px) {
    padding: 20px 0;
    width: 100vw;
    overflow-x: hidden;
  }
  background-color: ${COLOR.blueGray};
`

const StyledMoblieInfoBox = styled.div`
  margin-bottom: 20px;
  border-radius: 1em;
  padding: 12px;
  border: 1px solid ${COLOR.terraSky};
  color: ${COLOR.terraSky};
  font-size: 12px;
  font-weight: 500;
  @media (max-width: 575px) {
    margin-left: 20px;
    margin-right: 20px;
  }
`

const StyledForm = styled.div`
  background-color: ${COLOR.white};
  padding: 40px 80px;
  border-radius: 1em;
  background-color: ${COLOR.lightGrey2};
  @media (max-width: 1199px) {
    padding: 40px;
  }
  @media (max-width: 575px) {
    border-radius: 0;
    padding: 20px;
  }
`

const StyledFormSection = styled.div`
  margin-bottom: 20px;
  background-color: ${COLOR.lightGrey2};
`

const StyledMaxButton = styled.div`
  position: absolute;
  top: 50%;
  margin-top: -13px;
  right: 20px;
  border: 1px solid ${COLOR.terraSky};
  font-size: 12px;
  border-radius: 5px;
  padding: 0 10px;
  line-height: 24px;
  height: 26px;
  color: ${COLOR.terraSky};

  cursor: pointer;

  :hover {
    opacity: 0.8;
  }
`

const StyledRefreshButton = styled.div<{ refreshing: boolean }>`
  display: inline-block;
  color: ${COLOR.primary};
  font-size: 12px;
  font-weight: bold;
  opacity: ${({ refreshing }): number => (refreshing ? 0.5 : 1)};
  cursor: ${({ refreshing }): string => (refreshing ? 'default' : 'pointer')};
  user-select: none;
`

const RefreshButton = (): ReactElement => {
  const isLoggedIn = useRecoilValue(AuthStore.isLoggedIn)
  const { getAssetList } = useAsset()
  const [refreshing, setRefreshing] = useState(false)
  const dbcRefresh = useDebouncedCallback(() => {
    setRefreshing(true)
    getAssetList().finally((): void => {
      setTimeout(() => {
        setRefreshing(false)
      }, 500)
    })
  }, 300)

  return (
    <>
      {isLoggedIn && (
        <Col style={{ textAlign: 'right' }}>
          <StyledRefreshButton
            onClick={(): void => {
              dbcRefresh.callback()
            }}
            refreshing={refreshing}
          >
            <ArrowClockwise style={{ marginRight: 5 }} size={14} />
            <Text
              style={{
                fontWeight: 500,
                fontSize: 10,
                color: COLOR.terraSky
              }}
            >
              {refreshing ? 'REFRESHING...' : 'REFRESH'}
            </Text>
          </StyledRefreshButton>
        </Col>
      )}
    </>
  )
}

const SendForm = ({
  onClickSendButton
}: {
  onClickSendButton: () => Promise<void>
}): ReactElement => {
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const isLoggedIn = useRecoilValue(AuthStore.isLoggedIn)
  const { switchOrAddNetwork } = useAuth()

  const status = useRecoilValue(SendProcessStore.sendProcessStatus)

  // Send Data
  const asset = useRecoilValue(SendStore.asset)
  const [toAddress, setToAddress] = useRecoilState(SendStore.toAddress)
  const [amount, setAmount] = useRecoilState(SendStore.amount)
  const [period, setPeriod] = useRecoilState(SendStore.period)
  const setData = useSetRecoilState(SendStore.data)
  const setStartTime = useSetRecoilState(SendStore.startTime)
  const setEndTime = useSetRecoilState(SendStore.endTime)
  const setFeeRampup = useSetRecoilState(SendStore.feeRampup)
  // const [memo, setMemo] = useRecoilState(SendStore.memo)
  const [toBlockChain, setToBlockChain] = useRecoilState(SendStore.toBlockChain)

  // Computed data from Send data
  // const setTax = useSetRecoilState(SendStore.tax)
  const setGasFeeList = useSetRecoilState(SendStore.gasFeeList)
  // const feeDenom = useRecoilValue<AssetSymbolEnum>(SendStore.feeDenom)
  const setShuttleFee = useSetRecoilState(SendStore.shuttleFee)
  const setAmountWithShuttleFee = useSetRecoilState(
    SendStore.amountWithShuttleFee
  )
  const fromBlockChain = useRecoilValue(
    SendStore.fromBlockChain
  )

  const [validationResult, setValidationResult] = useState<ValidateResultType>({
    isValid: false
  })
  const [inputAmount, setInputAmount] = useState('')
  const [inputPeriod, setInputPeriod] = useState('')
  const [inputData, setInputData] = useState('')
  const [notAllowed, setNotAllowed] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setloading] = useState(false)

  const { getFee } = useFee()
  const { formatBalance, getAssetList } = useAsset()
  const { getQKCFeeList } = useSend()
  const { validateSendData, validateFee } = useSendValidate()
  const feeValidationResult = validateFee()
  const selectWallet = useSelectWallet()
  const { approveToken } = useToken()
  const { waitForEtherBaseTransaction } = useSend()


  const waitForReceipt = async ({
    submitResult,
  }: {
    submitResult: RequestTxResultType
  }): Promise<void> => {
    if (submitResult.success) {
      setloading(true)

      try {
        const receipt = await waitForEtherBaseTransaction({
          hash: submitResult.hash,
        })
        console.log('receipt', receipt)
        setloading(false)
        setNotAllowed(false)

      } catch (error) {
        setErrorMessage(_.toString(error))
      }
    } else {
      setErrorMessage(submitResult.errorMessage || '')
    }
  }


  const onChangeToAddress = ({ value }: { value: string }): void => {
    setToAddress(value)
  }

  const onChangeAmount = ({ value }: { value: string }): void => {
    if (_.isEmpty(value)) {
      setInputAmount('')
      setAmount('')
      setNotAllowed(false)
      return
    }

    if (false === _.isNaN(_.toNumber(value))) {
      setInputAmount(value)
      const decimalSize = new BigNumber(asset?.decimal || 18).toNumber()
      const decimalExp = new BigNumber(10).pow(decimalSize)
      setAmount(new BigNumber(value).times(decimalExp).toString(10))
      setNotAllowed(new BigNumber(value).times(decimalExp).isGreaterThan(asset?.allowance || value))
      calcShuttleFee()
    }
  }

  const onChangePeriod = ({ value }: { value: string }): void => {
    if (_.isEmpty(value)) {
      setInputPeriod('')
      setPeriod(0)
      return
    }

    if (false === _.isNaN(_.toNumber(value))) {
      setInputPeriod(value)
      setPeriod(new BigNumber(value,10).toNumber())
    }
  }

  const onChangeData = ({ value }: { value: string }): void => {
    if (_.isEmpty(value)) {
      setInputData('')
      setData('')
      return
    }

    setInputData(value)
    setData(value)
  }


  const onClickApproveButton = async (): Promise<void> => {
    setErrorMessage('')
    setloading(true)
    const submitResult = await approveToken()

    setloading(false)
    waitForReceipt({ submitResult })
  }

  const onClickMaxButton = async (): Promise<void> => {
    const assetAmount = new BigNumber(asset?.balance || 0)

    onChangeAmount({ value: formatBalance(assetAmount, asset?.decimal) })
  }

  // after confirm send
  useEffect(() => {
    if (status === ProcessStatus.Done) {
      onChangeAmount({ value: '' })
      getAssetList()
    }
  }, [status])

  const calcShuttleFee = async (): Promise<void> => {
    if (!asset) {
      setShuttleFee(new BigNumber(0))
      setAmountWithShuttleFee(new BigNumber(0))
      return
    }
    else {
      const sendAmount = new BigNumber(amount)
      if (sendAmount.isGreaterThan(0)) {
        getFee({
          token: asset,
          amount: sendAmount
        }).then((shuttleFee) => {
          setShuttleFee(shuttleFee)
          const computedAmount = sendAmount.plus(shuttleFee.isLessThan(0) ? 0 : shuttleFee)
          setAmountWithShuttleFee(
            computedAmount.isGreaterThan(0) ? computedAmount : new BigNumber(0)
          )
        })
      } else {
        setShuttleFee(new BigNumber(0))
        setAmountWithShuttleFee(new BigNumber(0))
      }
    }
  }

  // It's for Fee(gas), Tax and ShuttleFee
  const dbcGetFeeInfoWithValidation = useDebouncedCallback(async () => {
    const sendDataResult = validateSendData()
    setValidationResult(sendDataResult)

    const ableToGetFeeInfo =
      isLoggedIn &&
      amount &&
      toAddress

    if (asset?.tokenAddress && ableToGetFeeInfo) {
      if (sendDataResult.isValid) {
        // get terra Send Fee Info
        const qkcFeeList = await getQKCFeeList()
        setGasFeeList(qkcFeeList)
      }
      calcShuttleFee()
      setStartTime(Math.floor(Date.now()/1000))
      setPeriod(period)
      setEndTime(Math.floor(Date.now()/1000) + period)
      setFeeRampup(period)
    }
  }, 300)

  //get terra send fee info
  useEffect(() => {
    dbcGetFeeInfoWithValidation.callback()
    return (): void => {
      dbcGetFeeInfoWithValidation.cancel()
    }
  }, [amount, period, toAddress, toBlockChain, asset?.tokenAddress])

  useEffect(() => {
    getAssetList()
  }, [])

  useInterval(getAssetList, 15000);

  useEffect(() => {
    onChangeAmount({ value: inputAmount })
    onChangePeriod({ value: inputPeriod })
    getAssetList().then((): void => {
      dbcGetFeeInfoWithValidation.callback()
    })
    setToAddress(loginUser.address)
    setStartTime(Math.floor(Date.now()/1000))
    setEndTime(Math.floor(Date.now()/1000) + period)
    setFeeRampup(period)
  }, [
    // to check decimal length by network
    loginUser,
    // to check if asset valid by network
    toBlockChain
  ])

  useEffect(() => {
    STYLE.isSupportBrowser && selectWallet.open()
    setToAddress(loginUser.address)
    if (fromBlockChain === BlockChainType.arbitrum) {
      setToBlockChain(BlockChainType.optimism)
    } else if (fromBlockChain === BlockChainType.optimism) {
      setToBlockChain(BlockChainType.arbitrum)
    }
  }, [fromBlockChain])

  return (
    <StyledContainer>
      {false === STYLE.isSupportBrowser && (
        <div>
          <Row className={'justify-content-md-center'}>
            <Col md={8}>
              <StyledMoblieInfoBox>
                <InfoCircleFill
                  style={{ marginRight: 8, marginTop: -2 }}
                  size={14}
                />
                Bridge only supports desktop Chrome
              </StyledMoblieInfoBox>
            </Col>
          </Row>
        </div>
      )}

      <Row className={'justify-content-md-center'}>
        <Col md={8}>
          <StyledForm>
            <StyledFormSection>
              <Row>
                <Col>
                  <FormLabel title={'Asset'} />
                </Col>
                <RefreshButton />
              </Row>
              <AssetList {...{ selectedAsset: asset, onChangeAmount }} />

              <FormErrorMessage
                errorMessage={validationResult.errorMessage?.asset}
              />
            </StyledFormSection>
            <StyledFormSection>
              <Row>
                <Col>
                  <FormLabel title={'From'} />
                  <SelectBlockChainBox
                    {...{
                      blockChain: fromBlockChain,
                      setBlockChain: (value): void => {
                        switchOrAddNetwork(value)
                      },
                      optionList: [
                        // {
                        //   label:
                        //     NETWORK.blockChainName[BlockChainType.rinkeby],
                        //   value: BlockChainType.rinkeby,
                        // },
                        // {
                        //   label: NETWORK.blockChainName[BlockChainType.ropsten],
                        //   value: BlockChainType.ropsten,
                        // },
                        {
                          label: NETWORK.blockChainName[BlockChainType.arbitrum],
                          value: BlockChainType.arbitrum,
                        },
                        {
                          label: NETWORK.blockChainName[BlockChainType.optimism],
                          value: BlockChainType.optimism,
                        }
                      ]
                    }}
                  />
                </Col>
                <Col
                  xs={1}
                  style={{
                    textAlign: 'center',
                    alignSelf: 'center',
                    paddingLeft: 0,
                    paddingRight: 0,
                    paddingTop: 18
                  }}
                >
                  <ArrowRight color={COLOR.darkGray} size={20} />
                </Col>
                <Col>
                  <FormLabel title={'To'} />
                  <SelectBlockChainBox
                    {...{
                      blockChain: toBlockChain,
                      setBlockChain: setToBlockChain,
                      optionList: [
                        // {
                        //   label:
                        //     NETWORK.blockChainName[BlockChainType.ropsten],
                        //   value: BlockChainType.ropsten,
                        //   isDisabled: fromBlockChain === BlockChainType.ropsten
                        // },
                        // {
                        //   label: NETWORK.blockChainName[BlockChainType.rinkeby],
                        //   value: BlockChainType.rinkeby,
                        //   isDisabled: fromBlockChain === BlockChainType.rinkeby
                        // },
                        {
                          label: NETWORK.blockChainName[BlockChainType.optimism],
                          value: BlockChainType.optimism,
                          isDisabled: fromBlockChain === BlockChainType.optimism
                        },
                        {
                          label: NETWORK.blockChainName[BlockChainType.arbitrum],
                          value: BlockChainType.arbitrum,
                          isDisabled: fromBlockChain === BlockChainType.arbitrum
                        }
                      ]
                    }}
                  />
                </Col>
              </Row>
            </StyledFormSection>

            {asset?.type === TokenTypeEnum.Source && (
            <StyledFormSection>
              <FormLabel title={'Amount'} />
              <div style={{ position: 'relative' }}>
                <FormInput
                  type={'number'}
                  value={inputAmount}
                  onChange={({ target: { value } }): void => {
                    onChangeAmount({ value })
                  }}
                  placeholder={'0'}
                />
                <StyledMaxButton onClick={onClickMaxButton}>
                  Max
                </StyledMaxButton>
              </div>

              {isLoggedIn && (
                <FormErrorMessage
                  errorMessage={validationResult.errorMessage?.amount}
                />
              )}

              <FormLabel title={'Expire Period(sec)'} />
              <div style={{ position: 'relative' }}>
                <FormInput
                  type={'number'}
                  value={inputPeriod}
                  onChange={({ target: { value } }): void => {
                    onChangePeriod({ value })
                  }}
                  placeholder={'0'}
                />
              </div>

              <FormLabel title={'Destination'} />
              <FormInput
                onChange={({ target: { value } }): void => {
                  onChangeToAddress({ value })
                }}
                defaultValue={loginUser.address}
                placeholder={loginUser.address}
              />
              <FormErrorMessage
                errorMessage={validationResult.errorMessage?.toAddress}
              />
            </StyledFormSection>
            )}

            {asset?.type === TokenTypeEnum.Destination && (
            <StyledFormSection>
              <FormLabel title={'Transfer Data'} />
              <FormInput
                type={'string'}
                value={inputData}
                onChange={({ target: { value } }): void => {
                  onChangeData({ value })
                }}
                placeholder={"Transfer Data Tuple"}
              />
            </StyledFormSection>
            )}

            {/* only if from qkc */}
            <FormFeeInfo
              validationResult={validationResult}
              feeValidationResult={feeValidationResult}
            />

            <SendFormButton
              onClickSendButton={notAllowed ? onClickApproveButton : onClickSendButton}
              validationResult={validationResult}
              feeValidationResult={feeValidationResult}
              notAllowed={notAllowed}
              loading={loading}
            />

            <div style={{ textAlign: 'center' }}>
              <FormErrorMessage errorMessage={errorMessage} />
            </div>

          </StyledForm>
        </Col>
      </Row>
    </StyledContainer>
  )
}

export default SendForm
