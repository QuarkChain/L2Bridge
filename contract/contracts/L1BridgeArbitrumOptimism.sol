// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "arb-shared-dependencies/contracts/Inbox.sol";
import "arb-shared-dependencies/contracts/Outbox.sol";
import "./L2BridgeSource.sol";
import "./optimism/iAbs_BaseCrossDomainMessenger.sol";

contract L1BridgeArbitrumOptimism {
    address public l2Source;
    address public l2Target;
    iAbs_BaseCrossDomainMessenger public messenger;
    IInbox public inbox;

    mapping(uint256 => bytes32) public knownHashOnions;

    event MessageSent(address indexed target, uint256 count, bytes32 chainHash);

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

    /// @notice only l2Source can update
    function updateChainHash(uint256 count, bytes32 chainHash) public {
        IBridge bridge = inbox.bridge();
        // this prevents reentrancies on L2 to L1 txs
        require(msg.sender == address(bridge), "NOT_BRIDGE");
        IOutbox outbox = IOutbox(bridge.activeOutbox());
        address l2Sender = outbox.l2ToL1Sender();
        require(l2Sender == l2Source, "only updateable by L2");

        knownHashOnions[count] = chainHash;
        bytes memory data = abi.encodeWithSelector(
            L2BridgeSource.updateChainHashFromL1.selector,
            count,
            chainHash
        );
        messenger.sendMessage(l2Target, data, 1000000);
        emit MessageSent(l2Target, count, chainHash);
    }
}
