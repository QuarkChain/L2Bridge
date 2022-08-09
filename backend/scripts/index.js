const { ethers, BigNumber } = require("ethers");
const fetch = require("node-fetch");
const { utils, constants, providers, Wallet, Contract } = ethers;
const sdk = require("@eth-optimism/sdk");
const { L2TransactionReceipt, L2ToL1MessageStatus, L1TransactionReceipt, L1ToL2MessageStatus } = require('@arbitrum/sdk');
const { L1ToL2MessageGasEstimator } = require('@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator');
const { hexDataLength } = require('@ethersproject/bytes');
require("dotenv").config();
const { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus } = require("./utils");

const { DEPLOYMENTS, PRIVATE_KEY, RPC_L1, RPC_OP, RPC_AB, L1_CHAIN_ID, DIRECTION, MIN_FEE, GAS_PRICE_L1, GAS_PRICE_OP, GAS_PRICE_AB, CLAIM_INTERVAL_SECONDS } = process.env;
const deployment = require(DEPLOYMENTS);
const claimInterval = CLAIM_INTERVAL_SECONDS * 1000;
const gasPriceSrc = DIRECTION === "O2A" ? GAS_PRICE_OP : GAS_PRICE_AB;
const gasPriceDst = DIRECTION === "O2A" ? GAS_PRICE_AB : GAS_PRICE_OP;
const L2ToL1Delay = L1_CHAIN_ID == 1 ? 7 * 24 * 3600 * 1000 : (DIRECTION === "O2A" ? 24 * 3600 * 1000 : 60 * 1000);
const L1ToL2Delay = DIRECTION === "O2A" ? (L1_CHAIN_ID == 1 ? 15 * 60 * 1000 : 2 * 60 * 1000) : 60 * 1000;

const genesisBlockSrc = deployment[L1_CHAIN_ID][DIRECTION].genesisSrc;
const genesisBlockDst = deployment[L1_CHAIN_ID][DIRECTION].genesisDst;
const srcAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeSrc;
const dstAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeDest;
const l1Address = deployment[L1_CHAIN_ID][DIRECTION].bridge;

const tokens = deployment[L1_CHAIN_ID].tokens;
const dstTokens = DIRECTION === "O2A" ? tokens.map(t => t.Arbitrum) : tokens.map(t => t.Optimism);

const srcProvider = new providers.JsonRpcProvider(DIRECTION === "O2A" ? RPC_OP : RPC_AB);
const dstProvider = new providers.JsonRpcProvider(DIRECTION === "O2A" ? RPC_AB : RPC_OP);
const l1Provider = new providers.StaticJsonRpcProvider(RPC_L1);

const srcSigner = new Wallet(PRIVATE_KEY, srcProvider);
const dstSigner = new Wallet(PRIVATE_KEY, dstProvider);
const l1Signer = new Wallet(PRIVATE_KEY, l1Provider);

const srcContract = new Contract(srcAddress, [
    "event Deposit(address indexed srcTokenAddress,address indexed dstTokenAddress,address indexed source,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup,uint256 expiration)",
    "function transferStatus(bytes32) public view returns (uint256)",
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function processedCount() public view returns (uint256)",
    "function processClaims((bytes32 transferDataHash,address claimer,address srcTokenAddress,uint256 amount)[] memory rewardDataList,uint256[] memory skipFlags) public",
], srcProvider).connect(srcSigner);
const dstContract = new Contract(dstAddress, [
    "event Claim(bytes32 indexed transferDataHash,address indexed claimer,address indexed srcTokenAddress,uint256 amount)",
    "event L2ToL1TxCreated(uint256, bytes32)",
    "function GAP() public view returns (uint256)",
    "function rewardHashOnion() public view returns (byte32)",
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function getLPFee((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHeadToArbi(uint256 count,uint32 maxGas) public",
    "function declareNewHashChainHead(uint256 count) public",
], dstProvider).connect(dstSigner);
const l1Contract = new Contract(l1Address, [
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function setChainHashInL2(uint256 count,uint256 maxSubmissionCost,uint256 maxGas,uint256 gasPriceBid) public payable returns (uint256)"
], l1Provider).connect(l1Signer);

const iface = new utils.Interface(['function updateChainHashFromL1(uint256 count,bytes32 chainHash)']);
const calldata = iface.encodeFunctionData('updateChainHashFromL1', [constants.One, constants.HashZero]);

const opL1Messenger = new sdk.CrossChainMessenger({
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: dstSigner,
    l1ChainId: L1_CHAIN_ID,
    l2ChainId: L1_CHAIN_ID == 1 ? 10 : 420
});

//pending msg to trigger on L1
let claimedCountStatus; //count => {txHash, timestamp}
let processedBlockSrc;

let balances = {};
const cachePrices = {};

async function traceDeposit(fromBlock, sync) {
    let toBlock;
    try {
        let transferData = [];
        toBlock = await srcProvider.getBlockNumber();
        const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
        logClaim(`from ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
        transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        for (let i = 0; i < transferData.length; i++) {
            logClaim(`found transferData with amount ${utils.formatEther(transferData[i][3])}`);
            if (Date.now() + L2ToL1Delay > transferData[i][7] * 1000) {
                logClaim("rejected: the deposit could be expired before challenge period end");
                continue;
            }
            if (Date.now() < transferData[i][5] * 1000) {
                const timeout = transferData[i][5] * 1000 - Date.now();
                logClaim(`the deposit is not started; will retry in ${timeout / 1000} seconds`);
                setTimeout(() => {
                    takeOrder(transferData[i], sync);
                }, timeout);
                continue;
            }
            const transferDataHash = utils.keccak256(
                utils.defaultAbiCoder.encode([
                    "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256)"],
                    [transferData[i]]));
            if (await dstContract.claimedTransferHashes(transferDataHash)) {
                logClaim("the claim is already bought");
                continue;
            }
            await takeOrder(transferData[i], sync);
        }
        processedBlockSrc = toBlock;
    } catch (e) {
        err("claim", e.reason ? e.reason : e);
    }
    if (isNaN(toBlock)) {
        toBlock = processedBlockSrc;
    }
    setTimeout(() => traceDeposit(toBlock, sync), claimInterval);
}

async function takeOrder(transferData, sync) {
    const lpFee = await dstContract.getLPFee(transferData);
    const tokenAddrL1 = findL1Address(transferData[1]);
    const tkPrice = await tokenPrice(tokenAddrL1);
    const lpFeeInUsd = lpFee.mul(tkPrice * 100).div(100);
    logClaim(`current LP fee in USD = ${utils.formatUnits(lpFeeInUsd)} max LP fee=${utils.formatUnits(transferData[4])}`);
    if (lpFeeInUsd.lt(utils.parseEther(MIN_FEE))) {
        const timeout = await timeoutForMinFee(transferData);
        console.log("timeout", timeout)
        if (timeout > 0) {
            logClaim(`skip for now due to low LP fee; will retry in ${timeout / 1000} seconds`);
            setTimeout(() => {
                takeOrder(transferData, sync);
            }, timeout);
            return;
        }
    }
    const data = transferData.map(t => String(t));
    logClaim(`start claiming`, data);
    if (await take(transferData)) {// possibility that this count could be another claim?
        const transCount = await dstContract.transferCount();
        const count = transCount.toNumber();
        claimedCountStatus.set(count, { status: 'claimed' });
        if (sync) {
            const txHash = await declare(count);
            if (txHash) {
                claimedCountStatus.set(count, { status: 'declared', tx: txHash, time: Date.now() });
                triggerL1Msg(count);
            }
        }
    }
}

function findL1Address(l2Addr) {
    l2Addr = l2Addr.toLowerCase();
    for (let t of tokens) {
        if (t.Arbitrum.toLowerCase() === l2Addr.toLowerCase() || t.Optimism.toLowerCase() === l2Addr.toLowerCase()) {
            return t.L1;
        }
    }
    throw "Cannot find L1 address for " + l2Addr;
}

async function tokenPrice(tokenAddress) {
    tokenAddress = tokenAddress.toLowerCase();
    try {
        const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`
        const resp = await fetch(url);
        const data = await resp.json();
        const price = data[tokenAddress].usd;
        cachePrices[tokenAddress] = price;
        logClaim(`price of ${tokenAddress}`, price);
        return price;
    } catch (e) {
        logClaim(`get token price failed`, tokenAddress, e.code ? e.code : e);
        return cachePrices[tokenAddress] || 1;
    }
}

async function take(transferData) {
    let tx;
    try {
        const gasLimit = 200000;
        if (gasPriceDst > 0) {
            const gasPrice = utils.parseUnits(gasPriceDst, "gwei");
            tx = await dstContract.claim(transferData, { gasLimit, gasPrice });
        } else {
            tx = await dstContract.claim(transferData, { gasLimit });
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            logClaim("claim success");
            return true;
        }
        err("claim", "tx failed:", transferData, tx.hash);
    } catch (e) {
        err("claim", "claim failed:", transferData, e);
    }
    return false;
}

// struct TransferData {
//     address srcTokenAddress;
//     address dstTokenAddress;
//     address destination;
//     uint256 amount;
//     uint256 fee;
//     uint256 startTime;
//     uint256 feeRampup;
//     uint256 expiration;
// }
async function timeoutForMinFee(transferData) {
    const minFee = utils.parseEther(MIN_FEE);
    if (minFee.gt(transferData[4]) || BigNumber.from(transferData[4]).isZero()) {
        return -1;
    }
    let timeSec = MIN_FEE * transferData[6] / (transferData[4] / 1e18);
    const { number, timestamp } = await dstProvider.getBlock("latest");
    logClaim("timestamp", timestamp, "number", number)
    timeSec = timeSec + parseInt(transferData[5]) - timestamp;
    return timeSec * 1000;
}

async function doWithdraw(fromCount, toCount) {
    logWithdraw(`do withdraw from ${fromCount} to ${toCount}`);
    const rewardDataList = await retrieveRewardData(fromCount, toCount);
    try {
        if (rewardDataList.length === 0) {
            logWithdraw("no reward data to withdraw.")
            return false;
        }
        const gas = await srcContract.estimateGas.processClaims(rewardDataList, [0]);
        logWithdraw("withdraw gas", gas.toString())
        let tx;
        if (gasPriceSrc > 0) {
            const gasPrice = utils.parseUnits(gasPriceSrc, "gwei");
            tx = await srcContract.processClaims(rewardDataList, [0], { gasLimit: gas.mul(4).div(3), gasPrice });
        } else {
            tx = await srcContract.processClaims(rewardDataList, [0], { gasLimit: gas.mul(4).div(3) });
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            logWithdraw(`withdrawn ${toCount - fromCount + 1} deposits successfully 🤑! ${tx.hash}`);
            for (let i = fromCount; i < toCount; i++) {
                claimedCountStatus.delete(i);
            }
            return true;
        }
    } catch (e) {
        err("withdraw", "withdraw failed 🤔", e.reason ? e.reason : e);
    }
    return false;
}
async function declare(count) {
    logSync("declare for count", String(count));
    try {
        let tx;
        if (DIRECTION === "A2O") {
            try {
                const maxGas = 1000000;
                const gas = await dstContract.estimateGas.declareNewHashChainHeadToArbi(count, maxGas);
                logSync("declareNewHashChainHeadToArbi gas", String(gas));
                if (gasPriceDst > 0) {
                    const gasPrice = utils.parseUnits(gasPriceDst, "gwei");
                    tx = await dstContract.declareNewHashChainHeadToArbi(count, maxGas, { gasPrice });
                } else {
                    tx = await dstContract.declareNewHashChainHeadToArbi(count, maxGas);
                }
            } catch (e) {
                err("sync", "declare count=", count, e.error);
                throw "declareNewHashChainHeadToArbi error";
            }
        } else {
            try {
                const gas = await dstContract.estimateGas.declareNewHashChainHead(count);
                logSync("declareNewHashChainHead gas", String(gas));
                if (gasPriceDst > 0) {
                    const gasPrice = utils.parseUnits(gasPriceDst, "gwei");
                    tx = await dstContract.declareNewHashChainHead(count, { gasPrice });
                } else {
                    tx = await dstContract.declareNewHashChainHead(count);
                }
            } catch (e) {
                err("sync", "declare count=", count, e);
                throw "declareNewHashChainHead error";
            }
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            const chainHead = `0x${receipt.events[1].data.slice(-64)}`;
            logSync("chainHead", chainHead);
            return tx.hash;
        }
    } catch (e) {
        err("sync", "declareNewHashChainHead failed.", e.reason ? e.reason : e);
        if (e.code === "TIMEOUT") {
            return await declare(count);
        }
    }
    return null
}

async function withdrawn(count) {
    try {
        const processed = await srcContract.processedCount();
        return processed.gte(count);
    } catch (e) {
        err("sync", "query known hash on L1 failed. ", e.reason);
    }
    return false;
}

async function triggerL1Msg(count) {
    if (DIRECTION === "O2A") {
        await triggerL1MsgArbitrum(count);
    } else {
        await triggerL1MsgOptimism(count);
    }
}

async function triggerL1MsgOptimism(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        logSyncCount("try to trigger L2 to Optimism tx");
        let item = claimedCountStatus.get(count);
        if (!item || !item.tx) {
            err("sync", "unknown pending msg for count", count);
            return;
        }
        const txHash = item.tx;
        const delay = item.time + L2ToL1Delay - Date.now();
        if (delay > 0) {
            logSyncCount(`Challenge peroid: waiting for ${delay / 1000 / 3600} hours to trigger on L1`);
            await new Promise(r => setTimeout(r, delay));
        }
        while (true) {
            try {
                const state = await opL1Messenger.getMessageStatus(txHash);
                logSyncCount(`OP status=${state}; expected: ${sdk.MessageStatus.READY_FOR_RELAY}`);
                if (state === sdk.MessageStatus.RELAYED) {
                    logSyncCount(`relayed`);
                    break;
                }
                if (state === sdk.MessageStatus.READY_FOR_RELAY) {
                    logSyncCount(`ready for relay`);
                    break;
                }
            } catch (e) {
                err("sync", `check status count=${count}`, e.reason ? e.reason : e);
            }
            await new Promise(r => setTimeout(r, 5 * 1000));
        }
        logSyncCount("start finalizing");
        try {
            let tx;
            const gas = await opL1Messenger.estimateGas.finalizeMessage(txHash);
            const price = await l1Provider.getGasPrice();
            const cost = gas.mul(price);
            logSyncCount(`triggerL1MsgOptimism will cost ${utils.formatEther(cost)} ether`);
            if (GAS_PRICE_L1 > 0) {
                const gasPrice = utils.parseUnits(GAS_PRICE_L1, "gwei");
                tx = await opL1Messenger.finalizeMessage(txHash, { gasPrice });
            } else {
                tx = await opL1Messenger.finalizeMessage(txHash);
            }
            if (tx) {
                const recpt = await tx.wait();
                if (recpt.status == 1) {
                    logSyncCount("relay message success!");
                    item.status = "triggered";
                } else {
                    err("sync", `count=${count} l2ToL1Msg.execute failed in tx: ${tx.hash}`);
                    return;
                }
            }
        } catch (e) {
            err("sync", `count=${count} finalizeMessage failed`, e.reason ? e.reason : e);
            return;
        }
        while (true) {
            if (await knownHashOnionsL1(count)) {
                break;
            }
            await new Promise(r => setTimeout(r, 3 * 1000));
        }
        if (await updateHashToArbitrumFromL1(count)) {
            if (await waitSyncedToL2(count)) {
                await processWithdraw(count);
            }
        }
    } catch (e) {
        err("sync", `count=${count} trigger msg from Optimism to L1 failed.`, e.reason ? e.reason : e);
        if (e.reason == "timemout") {
            logSyncCount("retry triggerL1MsgOptimism");
            await triggerL1MsgOptimism(count);
        }
    }
}
async function triggerL1MsgArbitrum(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        const item = claimedCountStatus.get(count);
        if (!item || !item.tx) {
            err("sync", "unknown pending msg for count", count);
            return;
        }
        const txHash = item.tx;
        logSyncCount("get transaction receipt from Arbitrum to L1")
        const receipt = await dstProvider.getTransactionReceipt(txHash);
        const l2Receipt = new L2TransactionReceipt(receipt);
        logSyncCount("getL2ToL1Messages")
        const messages = await l2Receipt.getL2ToL1Messages(l1Signer, dstProvider);
        const l2ToL1Msg = messages[0]
        if ((await l2ToL1Msg.status(dstProvider)) == L2ToL1MessageStatus.EXECUTED) {
            logSyncCount(`already executed`)
        } else {
            const delay = item.time + L2ToL1Delay - Date.now();
            if (delay > 0) {
                logSyncCount(`Challenge peroid: waiting for ${delay / 1000 / 3600} hours to trigger on L1`);
                await l2ToL1Msg.waitUntilReadyToExecute(dstProvider, delay);
            }
            logSyncCount('Outbox entry exists! Trying to execute now')
            const res = await l2ToL1Msg.execute(dstProvider);
            const rec = await res.wait();
            logSyncCount(`Done! Your transaction is executed; status=${rec.status}`)
            item.status = "triggered";
        }
        while (true) {
            if (await knownHashOnionsL1(count)) {
                break;
            }
            await new Promise(r => setTimeout(r, 5 * 1000));
        }
        if (await waitSyncedToL2(count)) {
            await processWithdraw(count);
        }
    } catch (e) {
        err("sync", `count=${count} trigger msg from Arbitrum to L1 failed.`, e.reason ? e.reason : e);
        if (e.code === "TIMEOUT") {
            logSyncCount("retry triggerL1MsgArbitrum");
            await triggerL1MsgArbitrum(count);
        }
    }
}

async function waitSyncedToL2(count) {
    logSync(`count=${count} waiting for ${L1ToL2Delay / 60 / 1000} minutes to check on src`)
    await new Promise(r => setTimeout(r, L1ToL2Delay + 10 * 1000));
    while (true) {
        if (await checkSyncResult(count)) {
            break;
        }
        await new Promise(r => setTimeout(r, 5 * 1000));
    }
    return true;
}

async function processWithdraw(count) {
    let fromCount;
    try {
        const processed = await srcContract.processedCount();
        logWithdraw(`processed count from src is ${processed}`);
        fromCount = processed.toNumber() + 1;
    } catch (e) {
        err("withdraw", `count=${count} processedCount() failed`, e);
    }
    if (fromCount) {
        await doWithdraw(fromCount, count);
    }
}

async function updateHashToArbitrumFromL1(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount(`update hash to Arbitrum from L1`);
    const newBytes = utils.defaultAbiCoder.encode(
        ['uint256'],
        [count]
    );
    const newBytesLength = hexDataLength(newBytes) + 4 // 4 bytes func identifier
    try {
        const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(srcProvider);
        const _submissionPriceWei = await l1ToL2MessageGasEstimate.estimateSubmissionFee(
            l1Provider,
            await l1Provider.getGasPrice(),
            newBytesLength
        );
        logSyncCount(`Current retryable base submission price: ${utils.formatUnits(_submissionPriceWei, "gwei")} gwei`);
        const submissionPriceWei = _submissionPriceWei.mul(5);
        const gasPriceBid = await srcProvider.getGasPrice();
        logSyncCount(`L2 gas price: ${utils.formatUnits(gasPriceBid, "gwei")} gwei`);
        const maxGas = await l1ToL2MessageGasEstimate.estimateRetryableTicketGasLimit(
            l1Address,
            srcAddress,
            0,
            srcSigner.address,
            srcSigner.address,
            calldata,
            utils.parseEther('1'),
            submissionPriceWei,
            100000,
            gasPriceBid
        );
        const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas));
        logSyncCount(`Sending hash to L2 with ${utils.formatEther(callValue)} ether callValue for L2 fees.`);
        const setTx = await l1Contract.setChainHashInL2(
            count,
            submissionPriceWei,
            maxGas,
            gasPriceBid,
            { value: callValue, }
        );
        const setRec = await setTx.wait();
        let item = claimedCountStatus.get(count);
        item.status = "l1ToL2Called";
        logSyncCount(`Set hash txn confirmed on L1!`);
        const l1TxReceipt = new L1TransactionReceipt(setRec);
        const message = (await l1TxReceipt.getL1ToL2Messages(srcSigner))[0];
        logSyncCount("start waiting for status");
        let result;
        try {
            result = await message.waitForStatus();
        } catch (e) {
            err("sync", `count=${count}`, "waitForStatus", e.reason ? e.reason : e);
            const status = await message.status();
            result = { status };
        }
        logSyncCount("result", result);
        if (result.status === L1ToL2MessageStatus.REDEEMED) {
            logSyncCount(`L2 retryable txn executed ${message.l2TxHash}`);
            item.status = "l1ToL2Redeemed";
            return true;
        }
        if (result.status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
            logSyncCount("ready for redeem");
            const response = await message.redeem();
            const receipt = await response.wait();
            if (receipt.status == 1) {
                logSyncCount("redeem successfully");
                item.status = "l1ToL2Redeemed";
                return true;
            }
        }
        item.status = "l1ToL2RedeemFailed";
        logSyncCount(`L2 retryable txn FAILED with status ${result.status}`);
    } catch (e) {
        err("sync", `count=${count}`, "updateHashToArbitrumFromL1", e.reason ? e.reason : e);
        if (e.code === "TIMEOUT") {
            logSyncCount(`retry updateHashToArbitrumFromL1...`);
            return await updateHashToArbitrumFromL1(count);
        }
    }
    return false;
}

async function checkSyncResult(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        const onion = await srcContract.knownHashOnions(count);
        if (onion != constants.HashZero) {
            logSyncCount("found synced hash on src!")
            claimedCountStatus.delete(count);
            return true;
        }
        logSyncCount(`hash NOT on src`);
    } catch (e) {
        err("sync", `count=${count} check sync result failed: `, e.reason ? e.reason : e);
    }
    return false;
}

async function knownHashOnionsL1(count) {
    logSync(`count=${count} checking hash on L1...`);
    try {
        const known = await l1Contract.knownHashOnions(count);
        if (known != constants.HashZero) {
            return true;
        }
        logSync(`count=${count} hash NOT on L1`);
    } catch (e) {
        err("sync", "query known hash on L1 failed. ", e.reason);
    }
    return false;
}

async function syncCount(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    if (count == 0) {
        logSyncCount("nothing to sync.");
        return;
    }
    if (await withdrawn(count)) {
        claimedCountStatus.delete(count);
        logSyncCount("already withdrawn");
        return;
    }
    if (await checkSyncResult(count)) {
        logSyncCount("already synced to src");
        await processWithdraw(count);
        return;
    }
    let item = claimedCountStatus.get(count);
    if (await knownHashOnionsL1(count)) {
        logSyncCount("already synced to L1");
        if (item && item.status == "l1ToL2RedeemFailed") {
            // A2O only
            if (!await updateHashToArbitrumFromL1(count)) {
                err("sync", "updateHashToArbitrumFromL1 failed.");
                return;
            }
            item.status = "l1ToL2Redeemed";
        }
        if (await waitSyncedToL2(count)) {
            await processWithdraw(count);
        }
        return;
    }
    if (item && item.tx) {
        await triggerL1Msg(count);
        return;
    }
    const [gap, transferCount] = await Promise.all([dstContract.GAP(), dstContract.transferCount()]);
    if (count != transferCount && count % gap != 0) {
        logSyncCount("skip sync: hash will not be found on dst; you can sync latest count:", String(transferCount));
        return;
    }
    const txHash = await declare(count);
    logSyncCount("sync hash from dst chain.");
    if (txHash) {
        claimedCountStatus.set(count, { tx: txHash, time: Date.now() });
        await triggerL1Msg(count);
    }
}

async function checkCountStatus(count) {
    const { status, time } = claimedCountStatus.get(count);
    if (status) {
        if (status === "claimed") {
            return `dst: claimed`;
        }
        if (status === "triggered") {
            return `dst => L1: ${status}`;
        }
        if (status === "declared" || time) {
            const delay = time + L2ToL1Delay - Date.now();
            if (delay > 0) {
                return `dst => L1: waiting for ${delay / 1000 / 3600} hours to trigger on L1`;
            }
        }
        // A2O only
        if (status.startsWith("l1ToL2")) {
            return `L1 => src:  ${status}`;
        }
        return status;
    }
    if (await withdrawn(count)) {
        return "withdrawn";
    }
    if (await checkSyncResult(count)) {
        return "synced to src (ready to withdraw)";
    }
    if (await knownHashOnionsL1(count)) {
        return `L1 => src`;
    }
    return "unknown";
}

async function retrieveRewardData(fromCount, toCount) {
    logWithdraw(`start searching onchain for rewardData from ${fromCount} to ${toCount}`);
    const total = toCount - fromCount + 1;
    let result = [];
    let fromBlock = genesisBlockDst;
    let i = 0;
    try {
        const curBlock = await dstProvider.getBlockNumber();
        out: while (true) {
            const toBlock = Math.min(curBlock, fromBlock + 5000);
            const res = await dstContract.queryFilter(dstContract.filters.Claim(), fromBlock, toBlock);
            logWithdraw(`from ${fromBlock} to ${toBlock} has ${res.length} Claims`);
            for (r of res) {
                i = i + 1;
                if (i >= fromCount && i <= toCount) {
                    result.push(r.args);
                    logWithdraw(`add rewardData count=${i} on block${r.blockNumber}`);
                    if (result.length === total) {
                        break out;
                    }
                }
            }
            if (toBlock == curBlock) {
                break;
            }
            fromBlock = toBlock;
        }
    } catch (e) {
        err("withdraw", "query Claim events failed:", e.reason ? e.reason : e);
        if (e.code === "TIMEOUT") {
            logWithdraw('retry retrieveRewardData');
            return await retrieveRewardData(fromCount, toCount);
        }
    }
    return result;
}

async function approve() {
    logMain("Checking token allowance...")
    for (let t of dstTokens) {
        const erc20Token = new Contract(t, [
            "function allowance(address, address) public view returns (uint256)",
            "function approve(address,uint256) public",
        ], dstSigner);
        const allowed = await erc20Token.allowance(dstSigner.address, dstAddress);
        if (allowed.isZero()) {
            await erc20Token.approve(dstAddress, constants.MaxUint256);
            logSync("approved token", t)
        }
    }
}

let exiting = false;
async function exitHandler() {
    if (exiting) {
        return;
    }
    exiting = true;
    if (claimedCountStatus) {
        saveStatus(processedBlockSrc, claimedCountStatus);
    }
    await diffBalances();
    process.exit();
}

async function queryBalances() {
    logMain(`Query balances...`)
    const bals = {};
    bals.ETH = await Promise.all([l1Signer.getBalance(), srcSigner.getBalance(), dstSigner.getBalance()]);
    for (let t of tokens) {
        const srcAddr = DIRECTION === "O2A" ? t.Optimism : t.Arbitrum;
        const dstAddr = DIRECTION === "O2A" ? t.Arbitrum : t.Optimism;
        bals[t.name] = await Promise.all([getBalance(srcAddr, srcSigner), getBalance(dstAddr, dstSigner)]);
    }
    return bals;
}

async function getBalance(tokenAddr, signer) {
    const erc20Token = new ethers.Contract(tokenAddr, [
        "function balanceOf(address) public view returns (uint256)"
    ], signer);
    const balance = await erc20Token.balanceOf(srcSigner.address);
    return balance;
}

const fmt = (v) => utils.formatEther(v);
const prt = (a, b) => `${fmt(a)}\t${fmt(b)}\t${a.lt(b) ? '+' : ''}${fmt(b.sub(a))}`;

async function diffBalances() {
    logMain(`Checking balances change...`)
    const [l10e, src0e, dst0e] = balances.ETH;
    const newBals = await queryBalances();
    const [l1e, srce, dste] = newBals.ETH;
    console.log(`Ethereum ETH: ${prt(l10e, l1e)} `);
    console.log(`${DIRECTION === 'O2A' ? 'Optimism' : 'Arbitrum'} ETH: ${prt(src0e, srce)}`);
    console.log(`${DIRECTION === 'O2A' ? 'Arbitrum' : 'Optimism'} ETH: ${prt(dst0e, dste)}`);
    for (let t of tokens) {
        const [src0, dst0] = balances[t.name];
        const [src, dst] = newBals[t.name];
        console.log(`${DIRECTION === 'O2A' ? 'Optimism' : 'Arbitrum'} ${t.name}: ${prt(src0, src)}`);
        console.log(`${DIRECTION === 'O2A' ? 'Arbitrum' : 'Optimism'} ${t.name}: ${prt(dst0, dst)}`);
    }
}

async function main() {
    logMain(`Staring LP services for L2Bridge 
                          ${DIRECTION === 'O2A' ? '(Optimism => Arbitrum)' : '(Arbitrum => Optimism)'},
                          L1 chainId = ${L1_CHAIN_ID}`)
    process.stdin.resume();
    //do something when app is closing
    process.on('exit', async () => { await exitHandler() });
    //catches ctrl+c event
    process.on('SIGINT', async () => { await exitHandler() });
    process.on('uncaughtException', async e => {
        err("main", e);
        await exitHandler();
    });
    ({ processedBlockSrc, claimedCountStatus } = loadStatus());
    if (!(process.argv.length > 2 && process.argv[2] === "status")) {
        balances = await queryBalances();
        await approve();
    }
    let syncFlag = false;
    let startBlock;
    if (process.argv.length > 2) {
        const args = process.argv.slice(2);
        if (args[0] === "sync") {
            //sync, and withdraw if possible
            logMain("Start syncing hash from dst to src via L1...")
            let count;
            if (args.length > 1) {
                if (isNaN(args[1])) {
                    logMain("invalid count", args[1]);
                    process.exit(0);
                }
                count = parseInt(args[1]);
                logMain("with user specified count", count);
            } else {
                const transCount = await dstContract.transferCount();
                count = transCount.toNumber();
                logMain("with latest claimed count from dst", count);
            }
            await syncCount(count);
            logMain("Done sync.");
            return;
        }
        if (args[0] === "status") {
            const start = Date.now()
            logMain("Start checking status of your pending claims...");
            const result = new Map();
            for (let c of claimedCountStatus.keys()) {
                result.set(c, checkCountStatus(c));
            }
            await Promise.all(result.values());
            logMain("===============================")
            for (let k of result.keys()) {
                logMain(k, await result.get(k));
            }
            logMain("===============================")
            logMain("Done status. in " + (Date.now() - start) / 1000 + "seconds");
            process.exit();
        }
        if (args[0] === "-sync") {
            syncFlag = true;
        }
    }
    startBlock = processedBlockSrc ? processedBlockSrc : genesisBlockSrc;
    logMain("Staring claiming service from block", startBlock, syncFlag ? "with" : "without", "sync/withdraw");
    traceDeposit(startBlock, syncFlag);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

