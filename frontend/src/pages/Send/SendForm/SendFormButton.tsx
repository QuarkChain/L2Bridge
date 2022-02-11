import { ReactElement } from 'react'
import { useRecoilValue } from 'recoil'
import { CircularProgress } from '@material-ui/core'
import { COLOR, STYLE } from 'consts'
import { ValidateItemResultType, ValidateResultType } from 'types/send'

import { Button } from 'components'
import useSelectWallet from 'hooks/useSelectWallet'

import AuthStore from 'store/AuthStore'
import SendStore from 'store/SendStore'

const SendFormButton = ({
  validationResult,
  onClickSendButton,
  feeValidationResult,
  notAllowed,
  loading
}: {
  validationResult: ValidateResultType
  onClickSendButton: () => Promise<void>
  feeValidationResult: ValidateItemResultType
  notAllowed: boolean,
  loading: boolean,
}): ReactElement => {
  const selectWallet = useSelectWallet()
  const isLoggedIn = useRecoilValue(AuthStore.isLoggedIn)
  const asset = useRecoilValue(SendStore.asset)

  let ableButton = validationResult.isValid && feeValidationResult.isValid

  const IfLoadingText = (): ReactElement => {
    return loading ? (
      <CircularProgress size={20} style={{ color: COLOR.darkGray2 }} />
    ) : (
      <>Allow the Bridge to use your {asset?.symbol}</>
    )
  }

  return isLoggedIn ? (
    <Button onClick={onClickSendButton} disabled={!ableButton || loading}>
      {notAllowed ? (
        <IfLoadingText />) : "Next"}
    </Button>
  ) : (
    <Button
      disabled={false === STYLE.isSupportBrowser}
      onClick={selectWallet.open}
    >
      Connect Wallet
    </Button>
  )
}

export default SendFormButton
