//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./L2BridgeLib.sol";

contract L2BridgeDestination {
    using SafeERC20 for IERC20;

    uint256 public transferCount;
    mapping(bytes32 => bool) public claimedTransferHashes;

    bytes32 public rewardHashOnion;
    bytes32[] rewardHashOnionHistoryList;

    constructor() {}

    function getLPFee(L2BridgeLib.TransferData memory transferData)
        public
        view
        returns (uint256)
    {
        uint256 currentTime = block.timestamp;
        if (currentTime < transferData.startTime) {
            return 0;
        } else if (
            currentTime >= transferData.startTime + transferData.feeRampup
        ) {
            return transferData.fee;
        } else {
            return
                (transferData.fee * (currentTime - transferData.startTime)) /
                transferData.feeRampup;
        }
    }

    /*
     * claim the transfer token at source by exchange the corresponding destination token.
     */
    function claim(L2BridgeLib.TransferData memory transferData)
        public
        payable
    {
        // TODO: add minimal buy fee to prevent dust attack.
        bytes32 key = keccak256(abi.encode(transferData));
        require(!claimedTransferHashes[key], "already bought");
        claimedTransferHashes[key] = true;

        uint256 amount = transferData.amount - getLPFee(transferData);
        IERC20(transferData.dstTokenAddress).safeTransferFrom(
            msg.sender,
            transferData.destination,
            amount
        );

        // construct reward data and append it to onion
        L2BridgeLib.RewardData memory rewardData = L2BridgeLib.RewardData({
            transferDataHash: key,
            claimer: msg.sender,
            srcTokenAddress: transferData.srcTokenAddress,
            amount: transferData.amount
        });
        bytes32 rewardDataHash = keccak256(abi.encode(rewardData));
        rewardHashOnion = keccak256(
            abi.encode(rewardHashOnion, rewardDataHash)
        );
        transferCount++;

        // save to history per 100 transfers
        if (transferCount % 100 == 0) {
            rewardHashOnionHistoryList.push(rewardHashOnion);
        }
    }

    /*
     * delcare new hash chain head to source
     */
    function _declareNewHashChainHead(uint256 count)
        internal
        view
        returns (uint256, bytes32)
    {
        if (count == 0 || count == transferCount) {
            return (count, rewardHashOnion);
        }

        require(count % 100 == 0, "hash not found");
        return (count, rewardHashOnionHistoryList[count / 100]);
    }
}
