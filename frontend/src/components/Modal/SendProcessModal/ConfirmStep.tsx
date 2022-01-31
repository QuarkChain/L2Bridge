import { ReactElement } from 'react'
import styled from 'styled-components'
import { ArrowRight } from 'react-bootstrap-icons'
import { Col, Row } from 'react-bootstrap'
import { useRecoilValue, useSetRecoilState } from 'recoil'

import { COLOR, NETWORK, STYLE } from 'consts'

import { Text } from 'components'
import Button from 'components/Button'
import FormImage from 'components/FormImage'

import SendStore from 'store/SendStore'
import SendProcessStore, { ProcessStatus } from 'store/SendProcessStore'

import useAsset from 'hooks/useAsset'

import { BlockChainType } from 'types/network'
import AuthStore from '../../../store/AuthStore'
import useNetwork from '../../../hooks/useNetwork'
import ExtLink from '../../ExtLink'
// import { AssetNativeDenomEnum } from 'types/asset'

const StyledContainer = styled.div`
  padding: 0;
`

const StyledFromToBlockChainBox = styled.div`
  border-radius: ${STYLE.css.borderRadius};
  box-shadow: rgba(0, 0, 0, 0.1) 0px 5px 10px;
  padding: 20px;
  margin: 20px 0;
`

const StyledSection = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  word-break: break-all;
`

const StyledSecH = styled.div`
  display: inline-block;
  color: ${COLOR.skyGray};
  white-space: nowrap;
`

const StyledSecD = styled.div`
  display: inline-block;
  text-align: right;
  padding-left: 10px;
`

const StyledSecDText = styled(Text)<{ isError?: boolean }>`
  color: ${(props): string => (props.isError ? 'red' : COLOR.text)};
`

const ConfirmStep = (): ReactElement => {
  const setStatus = useSetRecoilState(SendProcessStore.sendProcessStatus)
  const { formatBalance } = useAsset()

  // Send Data
  const asset = useRecoilValue(SendStore.asset)
  const toAddress = useRecoilValue(SendStore.toAddress)
  const amount = useRecoilValue(SendStore.amount)
  const toBlockChain = useRecoilValue(SendStore.toBlockChain)
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)
  const loginUser = useRecoilValue(AuthStore.loginUser)
  const { getScannerLink } = useNetwork()

  // Computed data from Send data
  // const gasFee = useRecoilValue(SendStore.gasFee)
  // const tax = useRecoilValue(SendStore.tax)
  // const feeDenom = useRecoilValue<AssetNativeDenomEnum>(SendStore.feeDenom)
  const shuttleFee = useRecoilValue(SendStore.shuttleFee)
  const amountAfterShuttleFee = useRecoilValue(SendStore.amountAfterShuttleFee)
  const toBlockChainId = NETWORK.blockChainId[toBlockChain]

  return (
    <StyledContainer>
      <div style={{ textAlign: 'center' }}>
        <Text
          style={{ fontSize: 22, letterSpacing: -0.5, wordBreak: 'break-all' }}
        >
          {formatBalance(amount, asset?.decimal)} {asset?.symbol}
        </Text>
      </div>
      <StyledFromToBlockChainBox>
        <Row>
          <Col style={{ textAlign: 'center' }}>
            <div style={{ paddingBottom: 5 }}>
              <Text style={{ color: COLOR.skyGray, fontSize: 10 }}>From</Text>
            </div>

            <FormImage
              src={NETWORK.blockChainImage[fromBlockChain]}
              size={36}
            />

            <div style={{ fontSize: 13, fontWeight: 500 }}>
              <Text>{NETWORK.blockChainName[fromBlockChain]}</Text>
            </div>
          </Col>
          <Col
            xs={1}
            style={{
              textAlign: 'center',
              alignSelf: 'center',
              paddingLeft: 0,
              paddingRight: 0
            }}
          >
            <ArrowRight color={COLOR.darkGray} size={20} />
          </Col>
          <Col style={{ textAlign: 'center' }}>
            <div style={{ paddingBottom: 5 }}>
              <Text style={{ color: COLOR.skyGray, fontSize: 10 }}>To</Text>
            </div>

            <FormImage src={NETWORK.blockChainImage[toBlockChain]} size={36} />

            <div style={{ fontSize: 13, fontWeight: 500 }}>
              <Text>{NETWORK.blockChainName[toBlockChain]}</Text>
            </div>
          </Col>
        </Row>
      </StyledFromToBlockChainBox>

      <StyledSection>
        <StyledSecH>Asset</StyledSecH>
        <StyledSecD>
          <div style={{ alignItems: 'center', textAlign: 'right' }}>
            <span style={{ marginRight: 8, verticalAlign: 'middle' }}>
              <FormImage src={asset?.loguURI || ''} size={16} />
            </span>
            <StyledSecDText>{asset?.symbol}</StyledSecDText>
          </div>
        </StyledSecD>
      </StyledSection>

      <StyledSection>
        <StyledSecH>Source</StyledSecH>
        <StyledSecD>
          <StyledSecDText>
            <ExtLink
              href={getScannerLink({
                address: loginUser.address + (fromBlockChain === BlockChainType.qkc ? NETWORK.QKC_SHARDID.SHARD0.substr(2) : ''),
                type: 'address',
                chain: fromBlockChain
              })}
            >
              {loginUser.address + (fromBlockChain === BlockChainType.qkc ? NETWORK.QKC_SHARDID.SHARD0.substr(2) : '')}
            </ExtLink>
          </StyledSecDText>
        </StyledSecD>
      </StyledSection>

      <StyledSection>
        <StyledSecH>Destination</StyledSecH>
        <StyledSecD>
          <StyledSecDText>
            <ExtLink
              href={getScannerLink({
                address: toAddress + (toBlockChain !== BlockChainType.qkc ? '' : NETWORK.QKC_SHARDID.SHARD0.substr(2)),
                type: 'address',
                chain: toBlockChain
              })}
            >
              {toAddress + (toBlockChain !== BlockChainType.qkc ? '' : NETWORK.QKC_SHARDID.SHARD0.substr(2))}
            </ExtLink>
          </StyledSecDText>
        </StyledSecD>
      </StyledSection>

      <StyledSection>
        <StyledSecH>Bridge fee</StyledSecH>
        <StyledSecD>
          {shuttleFee &&
            <div>
              <StyledSecDText>
                {`(estimated) ${formatBalance(shuttleFee, asset?.decimal)}`}
                <ExtLink
                  href={getScannerLink({
                    address: asset?.tokenAddress + (fromBlockChain !== BlockChainType.qkc ? '' : NETWORK.QKC_SHARDID.SHARD0.substr(2)),
                    type: 'address',
                    chain: fromBlockChain
                  })}
                >
                  {asset?.symbol}
                </ExtLink>
              </StyledSecDText>
            </div>
          }
        </StyledSecD>
      </StyledSection>

      <StyledSection>
        <StyledSecH>You will receive</StyledSecH>
        <StyledSecD>
            <div>
              <StyledSecDText
                isError={amountAfterShuttleFee.isLessThanOrEqualTo(0)}
              >
                {` (estimated) ${formatBalance(amountAfterShuttleFee, asset?.decimal)}`}
                <ExtLink
                  href={getScannerLink({
                    address: asset?asset.mapping?asset.mapping[toBlockChainId][1]:"" + (toBlockChain !== BlockChainType.qkc ? '' : NETWORK.QKC_SHARDID.SHARD0.substr(2)):"",
                    type: 'address',
                    chain: toBlockChain
                  })}
                >
                  {asset?asset.mapping?asset.mapping[toBlockChainId][0]:"":""}
                </ExtLink>
              </StyledSecDText>
            </div>
        </StyledSecD>
      </StyledSection>
      <br />
      <Button
        onClick={(): void => {
          setStatus(ProcessStatus.Submit)
        }}
      >
        Confirm
      </Button>
    </StyledContainer>
  )
}

export default ConfirmStep
