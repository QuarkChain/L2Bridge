import { ReactElement } from 'react'
import { useSetRecoilState} from 'recoil'

import { useModal } from 'components/Modal'
import SendProcessModal from 'components/Modal/SendProcessModal'

import SendProcessStore, { ProcessStatus } from 'store/SendProcessStore'

import SendForm from './SendForm'
import {Container } from 'react-bootstrap'
import styled from 'styled-components'
import { COLOR } from 'consts'

const StyledContainer = styled(Container)`
  height: 100%;
  @media (max-width: 575px) {
    padding: 20px 0;
    width: 100vw;
    overflow-x: hidden;
  }
  color: ${COLOR.blueGray};
`

const Send = (): ReactElement => {
  const sendTxModal = useModal()
  const setSendProcessStatus = useSetRecoilState(
    SendProcessStore.sendProcessStatus
  )

  const onClickSendButton = async (): Promise<void> => {
    setSendProcessStatus(ProcessStatus.Confirm)
    sendTxModal.open()
  }

  return (
    <StyledContainer>
      <SendForm onClickSendButton={onClickSendButton} />
      <SendProcessModal {...sendTxModal} />
    </StyledContainer>
  )
}

export default Send
