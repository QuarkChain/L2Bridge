// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "arb-shared-dependencies/contracts/Inbox.sol";
import "arb-shared-dependencies/contracts/Outbox.sol";
import "./L2BridgeSource.sol";
import "./optimism/iAbs_BaseCrossDomainMessenger.sol";

contract L1BridgeArbitrumOptimism {
    address public l2MessageFrom;
    address public l2MessageTo;
    iAbs_BaseCrossDomainMessenger public messenger;
    IInbox public inbox;

    mapping(uint256 => bytes32) public knownHashOnions;

    event MessageSent(address indexed target, uint256 count, bytes32 chainHash);

    constructor(address _messenger, address _inbox) {
        messenger = iAbs_BaseCrossDomainMessenger(_messenger);
        inbox = IInbox(_inbox);
    }

    /// @notice only owner can call
    function updateL2MessageTo(address _l2MessageTo) public {
        l2MessageTo = _l2MessageTo;
    }

    /// @notice only owner can call
    function updateL2MessageFrom(address _l2MessageFrom) public {
        l2MessageFrom = _l2MessageFrom;
    }

    /// @notice only l2MessageFrom can update
    function updateChainHash(uint256 count, bytes32 chainHash) public {
        IBridge bridge = inbox.bridge();
        // this prevents reentrancies on L2 to L1 txs
        require(msg.sender == address(bridge), "NOT_BRIDGE");
        IOutbox outbox = IOutbox(bridge.activeOutbox());
        address l2Sender = outbox.l2ToL1Sender();
        require(l2Sender == l2MessageFrom, "only updateable by L2");
        knownHashOnions[count] = chainHash;
        bytes memory data = abi.encodeWithSelector(
            L2BridgeSource.updateChainHashFromL1.selector,
            count,
            chainHash
        );
        messenger.sendMessage(l2MessageTo, data, 1000000);
        emit MessageSent(l2MessageTo, count, chainHash);
    }
}
