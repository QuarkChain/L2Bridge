// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "arb-shared-dependencies/contracts/ArbSys.sol";
import "arb-shared-dependencies/contracts/AddressAliasHelper.sol";

import "../L2BridgeDestination.sol";
import "./ArbitrumL1Bridge.sol";

contract ArbitrumBridgeDestination is L2BridgeDestination {
    ArbSys constant arbsys = ArbSys(address(100));
    address public l1Target;

    event L2ToL1TxCreated(uint256 count, bytes32 chainHash);

    constructor(address _l1Target, uint256 _gap) L2BridgeDestination(_gap) {
        l1Target = _l1Target;
    }

    /// @notice only owner can call
    function updateL1Target(address _l1Target) public {
        l1Target = _l1Target;
    }

    function declareNewHashChainHead(uint256 count, uint32 maxGas) public {
        (uint256 actualCount, bytes32 h) = _declareNewHashChainHead(count);

        bytes memory data = abi.encodeWithSelector(
            ArbitrumL1Bridge.updateChainHash.selector,
            actualCount,
            h
        );

        uint256 withdrawalId = arbsys.sendTxToL1(l1Target, data);

        emit L2ToL1TxCreated(actualCount, h);
    }
}
