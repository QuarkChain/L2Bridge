//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./L2BridgeSource.sol";

contract TestL2BridgeDestination is L2BridgeDestination {
    function declareNewHashChainHead(uint256 count)
        public
        pure
        returns (uint256, bytes32)
    {
        return _declareNewHashChainHead(count);
    }
}
