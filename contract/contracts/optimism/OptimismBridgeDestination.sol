// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../L2BridgeDestination.sol";
import "../L2BridgeSource.sol";
import "./OptimismL1Bridge.sol";

import "./iAbs_BaseCrossDomainMessenger.sol";

contract OptimismBridgeDestination is L2BridgeDestination {
    address public l1Target;
    iAbs_BaseCrossDomainMessenger public messenger =
        iAbs_BaseCrossDomainMessenger(
            0x4200000000000000000000000000000000000007
        );

    event L2ToL1TxCreated(uint256 count, bytes32 chainHash);

    constructor(address _l1Target) {
        l1Target = _l1Target;
    }

    /// @notice only owner can call
    function updateL1Target(address _l1Target) public {
        l1Target = _l1Target;
    }

    /// @notice only owner can call
    function updateMessenger(address _messenger) public {
        messenger = iAbs_BaseCrossDomainMessenger(_messenger);
    }

    function declareNewHashChainHead(uint256 count, uint32 maxGas) public {
        (uint256 actualCount, bytes32 h) = _declareNewHashChainHead(count);
        bytes memory data = abi.encodeWithSelector(
            OptimismL1Bridge.updateChainHash.selector,
            actualCount,
            h
        );

        messenger.sendMessage(l1Target, data, maxGas);

        emit L2ToL1TxCreated(actualCount, h);
    }
}
