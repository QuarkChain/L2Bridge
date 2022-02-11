import { ReactElement, useEffect } from 'react'
import { Col, Row } from 'react-bootstrap'
import styled from 'styled-components'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
// import _ from 'lodash'

import { COLOR, NETWORK } from 'consts'

// import { BlockChainType } from 'types/network'
import { ValidateItemResultType, ValidateResultType } from 'types/send'
import { AssetSymbolEnum } from 'types/asset'

import { Text } from 'components'
import FormLabel from 'components/FormLabel'
// import { InfoIcon } from 'components'
import FormErrorMessage from 'components/FormErrorMessage'

import useAsset from 'hooks/useAsset'

import AuthStore from 'store/AuthStore'
import SendStore from 'store/SendStore'

const StyledFormSection = styled.div`
  margin-bottom: 20px;
`

const FormFeeInfo = ({
  validationResult,
  feeValidationResult,
}: {
  validationResult: ValidateResultType
  feeValidationResult: ValidateItemResultType
}): ReactElement => {
  const isLoggedIn = useRecoilValue(AuthStore.isLoggedIn)

  // Transaction Data
  const asset = useRecoilValue(SendStore.asset)
  const toBlockChain = useRecoilValue(SendStore.toBlockChain)
  const toBlockChainId = NETWORK.blockChainId[toBlockChain]
  const startTime = useRecoilValue(SendStore.startTime)
  const endTime = useRecoilValue(SendStore.endTime)
  const feeRampup = useRecoilValue(SendStore.feeRampup)

  // Computed data from Send data
  const gasFeeList = useRecoilValue(SendStore.gasFeeList)
  // const [gasFee, setGasFee] = useRecoilState(SendStore.gasFee)
  const setFee = useSetRecoilState(SendStore.fee)
  const [feeDenom] = useRecoilState<AssetSymbolEnum>(
    SendStore.feeDenom
  )
  const shuttleFee = useRecoilValue(SendStore.shuttleFee)
  const amountWithShuttleFee = useRecoilValue(SendStore.amountWithShuttleFee)
  // const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)

  // const assetList = useRecoilValue(SendStore.loginUserAssetList)

  const { formatBalance } = useAsset()

  // const [optionList, setOptionList] = useState<
  //   {
  //     label: AssetSymbolEnum
  //     value: AssetSymbolEnum
  //     isDisabled?: boolean
  //   }[]
  // >([])

  const setStdFee = (props: { feeDenom: AssetSymbolEnum }): void => {
    const stdFee = gasFeeList.find((x) => x.token === props.feeDenom)?.fee
    // const value = stdFee?.amount
    //   .toArray()
    //   .find((x) => x.denom === feeDenom)
    //   ?.amount.toString()
    //
    // setGasFee(UTIL.toBignumber(value))
    setFee(stdFee ? stdFee : 0)
  }

  useEffect(() => {
    setStdFee({ feeDenom })
  }, [feeDenom])

  // disable feeDenom what has no balance
  // useEffect(() => {
  //   if (assetList.length > 0) {
  //     const defaultOptionList = _.map(gasFeeList, ({ token, fee }) => {
  //       let isDisabled = true
  //       if (fee) {
  //         const ownedAmount = UTIL.toBignumber(
  //           assetList.find((x) => x.tokenAddress === token)?.balance
  //         )
  //
  //         const feeAmount = UTIL.toBignumber(
  //           fee.toString()
  //         )
  //
  //         isDisabled = ownedAmount.isLessThan(feeAmount)
  //       }
  //
  //       return {
  //         label: token,
  //         value: token,
  //         isDisabled,
  //       }
  //     })
  //
  //     // setOptionList(defaultOptionList)
  //
  //     const selected = defaultOptionList.find((x) => x.value === feeDenom)
  //     const selectable = defaultOptionList.find((x) => x.isDisabled === false)
  //     if (selected?.isDisabled && selectable) {
  //       setFeeDenom(selectable.value)
  //       setStdFee({ feeDenom: selectable.value })
  //     } else {
  //       setStdFee({ feeDenom })
  //     }
  //   }
  // }, [gasFeeList])

  return (
    <>
      {isLoggedIn &&
        validationResult.isValid && (
          <StyledFormSection>
            <FormLabel title={'Transaction Details'} />

            <div
              style={{
                borderTop: 'dashed 1px #444',
                borderBottom: 'dashed 1px #444',
                fontSize: 13,
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <FormErrorMessage
                  errorMessage={feeValidationResult.errorMessage}
                />
              </div>

              <>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Source Token Address
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {asset?.tokenAddress}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Destination Token Address
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {asset ? asset.mapping ? asset.mapping[toBlockChainId][1] : "" : ""}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Start Time
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {`${new Date(startTime).toUTCString()}`}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Expired Time
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {`${new Date(endTime).toUTCString()}`}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Fee Ramp Up
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {`${(feeRampup / 1000 / 60 / 60)} Hours`}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Bridge fee
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text style={{ opacity: '0.8' }}>
                      {`${formatBalance(shuttleFee, asset?.decimal)} ${asset?.symbol}`}
                    </Text>
                  </Col>
                </Row>
                <Row
                  style={{
                    paddingTop: 8,
                    paddingBottom: 8,
                    margin: 0,
                    borderTop: 'solid 1px rgba(255,255,255,.03)',
                  }}
                >
                  <Col style={{ padding: 0 }}>
                    <Text style={{ paddingRight: 10, color: COLOR.skyGray }}>
                      Total Cost
                    </Text>
                  </Col>
                  <Col style={{ textAlign: 'right', padding: 0 }}>
                    <Text
                      style={{
                        opacity: '0.8',
                        color: amountWithShuttleFee.isLessThanOrEqualTo(0)
                          ? COLOR.red
                          : COLOR.text,
                      }}
                    >
                      {`${formatBalance(amountWithShuttleFee, asset?.decimal)} ${asset?.symbol
                        }`}
                    </Text>
                  </Col>
                </Row>
              </>
            </div>
          </StyledFormSection>
        )}
    </>
  )
}

export default FormFeeInfo
