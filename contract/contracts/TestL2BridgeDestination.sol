//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./L2BridgeDestination.sol";

contract TestL2BridgeDestination is L2BridgeDestination {
    constructor(uint256 _gap) L2BridgeDestination(_gap) {
    }

    function declareNewHashChainHead(uint256 count)
        public
        view
        returns (uint256, bytes32)
    {
        return _declareNewHashChainHead(count);
    }
}
