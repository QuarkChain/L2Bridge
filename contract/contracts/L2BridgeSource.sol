//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./L2BridgeLib.sol";

contract L2BridgeSource {
    using SafeERC20 for IERC20;

    uint256 public constant XFER_NEW = 0;
    uint256 public constant XFER_PENDING = 1;
    uint256 public constant XFER_EXPIRED = 2;
    uint256 public constant XFER_DONE = 3;
    uint256 public constant CONTRACT_FEE_BASIS_POINTS = 5;
    uint256 public constant RELAYER_FEE_BASIS_POINTS = 2;

    mapping(bytes32 => uint256) public transferStatus;
    mapping(uint256 => bytes32) public knownHashOnions;

    uint256 processedCount;
    bytes32 processedRewardHashOnion;

    constructor() {}

    /*
     * deposit the user's fund and request to exchange token at destination.
     */
    function deposit(L2BridgeLib.TransferData memory transferData) public {
        bytes32 key = keccak256(abi.encode(transferData));
        require(transferStatus[key] == XFER_NEW, "not new");

        uint256 amountPlusFee = (transferData.amount *
            (10000 + CONTRACT_FEE_BASIS_POINTS)) / 10000;

        IERC20(transferData.srcTokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amountPlusFee
        );

        transferStatus[key] = XFER_PENDING;
    }

    /*
     * refund the user's fund after expiration (no LP exchanges the token at dest.).
     */
    function refund(L2BridgeLib.TransferData memory transferData) public {
        bytes32 key = keccak256(abi.encode(transferData));
        require(transferStatus[key] == XFER_PENDING, "not pending");
        require(transferData.expiration < block.timestamp, "not expire");

        IERC20(transferData.srcTokenAddress).safeTransfer(
            transferData.destination,
            transferData.amount
        );

        transferStatus[key] = XFER_EXPIRED;
    }

    /*
     * withdraw the user's fund by LP after providing the liquidity at destination with
     * confirmed receipt root.
     */
    function processClaims(
        L2BridgeLib.RewardData[] memory rewardDataList,
        uint256[] memory skipFlags
    ) public {
        bytes32 newHead = processedRewardHashOnion;
        for (uint256 i = 0; i < rewardDataList.length; i++) {
            newHead = keccak256(abi.encode(newHead, rewardDataList[i]));

            if (
                skipFlags[i / 256] >> (i % 256) == 0 &&
                transferStatus[rewardDataList[i].transferDataHash] ==
                XFER_PENDING
            ) {
                IERC20(rewardDataList[i].srcTokenAddress).safeTransfer(
                    rewardDataList[i].claimer,
                    rewardDataList[i].amount
                );

                // send the reward to relayer
                // assume amount is smaller than TransferData.amount
                IERC20(rewardDataList[i].srcTokenAddress).safeTransfer(
                    msg.sender,
                    (rewardDataList[i].amount * RELAYER_FEE_BASIS_POINTS) /
                        10000
                );

                transferStatus[rewardDataList[i].transferDataHash] == XFER_DONE;
            }
            // if not pending, it will just skip it.
        }

        require(
            knownHashOnions[processedCount + rewardDataList.length] != newHead,
            "unknown hash"
        );
        processedCount += rewardDataList.length;
        processedRewardHashOnion = newHead;
    }

    /// @notice should be overrided by specific L2 implementations.
    function updateChainHashFromL1(uint256 count, bytes32 chainHash)
        public
        virtual
    {
        knownHashOnions[count] = chainHash;
    }
}
