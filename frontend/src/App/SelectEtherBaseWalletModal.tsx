import { Fragment, ReactElement } from 'react'
import styled from 'styled-components'
import { useRecoilState, useRecoilValue } from 'recoil'
import { ethers } from 'ethers'

import { COLOR, WALLET, STYLE } from 'consts'

import useAuth from 'hooks/useAuth'
import Button from 'components/Button'
import Text from 'components/Text'
import DefaultModal from 'components/Modal'

// import walletConnectService from 'services/walletConnectService'
// import coinBaseService from 'services/coinBaseService'
import metaMaskService from 'services/metaMaskService'
// import bscService from 'services/bscService'

import SelectWalletStore, {
  SelectWalletModalType,
} from 'store/SelectWalletStore'
import SendStore from 'store/SendStore'

import { WalletEnum } from 'types/wallet'
import { BlockChainType } from 'types/network'

const { walletLogo } = WALLET

const StyledContainer = styled.div`
  padding: 0 30px 30px;
`

const StyledWalletButton = styled(Button)`
  border-radius: ${STYLE.css.borderRadius};
  padding: 16px;
  margin: 8px 0px;
  border: 1px solid #1e2026;
  transition: all 0.3s ease 0s;
  background: ${COLOR.lightGrey};
  color: ${COLOR.black};
  overflow: hidden;

  :hover {
    //border-color: ${COLOR.terraSky};
    background: ${COLOR.lightGrey2};
  }
`

const StyledButtonContents = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`

const SelectEtherBaseWalletModal = (): ReactElement => {
  // const { login, logout } = useAuth()
  const { login } = useAuth()
  const fromBlockChain = useRecoilValue(SendStore.fromBlockChain)

  const [isVisibleModalType, setIsVisibleModalType] = useRecoilState(
    SelectWalletStore.isVisibleModalType
  )

  // const onClickBinanceChain = async (): Promise<void> => {
  //   if (bscService.checkInstalled()) {
  //     const { address, provider } = await bscService.connect()
  //     await login({
  //       user: {
  //         address,
  //         provider: new ethers.providers.Web3Provider(provider),
  //         walletType: WalletEnum.Binance,
  //       },
  //     })
  //   } else {
  //     setIsVisibleModalType(SelectWalletModalType.bscInstall)
  //   }
  // }

  const onClickMetamask = async (): Promise<void> => {
    if (metaMaskService.checkInstalled()) {
      const { address, provider } = await metaMaskService.connect()

      await login({
        user: {
          address,
          provider: new ethers.providers.Web3Provider(provider, "any"),
          walletType: WalletEnum.MetaMask,
        },
      })
      setIsVisibleModalType(undefined)
    } else {
      metaMaskService.install()
    }
  }

  const buttons =
    fromBlockChain !== BlockChainType.bsctest
      ? [
          {
            src: walletLogo[WalletEnum.MetaMask],
            label: 'Metamask',
            onClick: onClickMetamask,
          }]
      : [
          // {
          //   src: walletLogo[WalletEnum.Binance],
          //   label: 'BinanceChain',
          //   onClick: onClickBinanceChain,
          // },
          {
            src: walletLogo[WalletEnum.MetaMask],
            label: 'Metamask',
            onClick: onClickMetamask,
          },
        ]

  return (
    <DefaultModal
      {...{
        isOpen: isVisibleModalType === SelectWalletModalType.etherBaseModal,
        close: (): void => {
          setIsVisibleModalType(undefined)
        },
      }}
      header={<Text>Connect Wallet</Text>}
    >
      <StyledContainer>
        {buttons.map(({ src, label, onClick }) => (
          <Fragment key={label}>
            <StyledWalletButton
              onClick={(): void => {
                setIsVisibleModalType(undefined)
                onClick()
              }}
            >
              <StyledButtonContents>
                <span>{label}</span>
                <img src={src} width={24} height={24} alt="" />
              </StyledButtonContents>
            </StyledWalletButton>
          </Fragment>
        ))}
      </StyledContainer>
    </DefaultModal>
  )
}

export default SelectEtherBaseWalletModal
