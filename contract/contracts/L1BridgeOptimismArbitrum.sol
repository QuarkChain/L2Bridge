// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "arb-shared-dependencies/contracts/Inbox.sol";
import "./L2BridgeSource.sol";
import "./optimism/iAbs_BaseCrossDomainMessenger.sol";

contract L1BridgeOptimismArbitrum {
    address public l2Source;
    address public l2Target;
    iAbs_BaseCrossDomainMessenger public messenger;
    IInbox public inbox;

    mapping(uint256 => bytes32) public knownHashOnions;

    event RetryableTicketCreated(uint256 indexed ticketId);

    constructor(address _messenger, address _inbox) {
        messenger = iAbs_BaseCrossDomainMessenger(_messenger);
        inbox = IInbox(_inbox);
    }

    /// @notice only owner can call
    function updateL2Target(address _l2Target) public {
        l2Target = _l2Target;
    }

    /// @notice only owner can call
    function updateL2Source(address _l2Source) public {
        l2Source = _l2Source;
    }

    function setChainHashInL2(
        uint256 count,
        uint256 maxSubmissionCost,
        uint256 maxGas,
        uint256 gasPriceBid
    ) public payable returns (uint256) {
        bytes memory data = abi.encodeWithSelector(
            L2BridgeSource.updateChainHashFromL1.selector,
            count,
            knownHashOnions[count]
        );
        uint256 ticketID = inbox.createRetryableTicket{value: msg.value}(
            l2Target,
            0,
            maxSubmissionCost,
            msg.sender,
            msg.sender,
            maxGas,
            gasPriceBid,
            data
        );

        emit RetryableTicketCreated(ticketID);
        return ticketID;
    }

    /// @notice only l2Source can update
    function updateChainHash(uint256 count, bytes32 chainHash) public payable {
        require(msg.sender == address(messenger), "not from op messenger");
        address l2Sender = messenger.xDomainMessageSender();
        require(
            l2Sender == l2Source,
            "receipt root only updateable by target L2"
        );
        knownHashOnions[count] = chainHash;
    }
}
