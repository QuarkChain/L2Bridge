// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../L2BridgeSource.sol";

import "./iAbs_BaseCrossDomainMessenger.sol";

contract OptimismL1Bridge {
    address public l2Source;
    address public l2Target;
    iAbs_BaseCrossDomainMessenger public messenger;

    mapping(uint256 => bytes32) public knownHashOnions;

    event MessageSent(
        address indexed target,
        uint256 count,
        bytes32 chainHash,
        uint256 maxGas
    );

    constructor(
        address _l2Source,
        address _l2Target,
        address _messenger
    ) {
        l2Source = _l2Source;
        l2Target = _l2Target;
        messenger = iAbs_BaseCrossDomainMessenger(_messenger);
    }

    /// @notice only owner can call
    function updateL2Target(address _l2Target) public {
        l2Target = _l2Target;
    }

    /// @notice only owner can call
    function updateL2Source(address _l2Source) public {
        l2Source = _l2Source;
    }


    /// @notice only l2Target can update
    function updateChainHash(uint256 count, bytes32 chainHash, uint32 maxGas) public {
        require(msg.sender == address(messenger), "not from messenger");
        address l2Sender = messenger.xDomainMessageSender();
        require(
            l2Sender == l2Target,
            "receipt root only updateable by target L2"
        );
        knownHashOnions[count] = chainHash;
        bytes memory data = abi.encodeWithSelector(
            L2BridgeSource.updateChainHashFromL1.selector,
            count,
            chainHash
        );
        messenger.sendMessage(l2Source, data, maxGas);
        emit MessageSent(l2Source, count, chainHash, maxGas);
    }
}
