const { ethers, BigNumber } = require("ethers");
const { utils, constants, providers, Wallet, Contract } = ethers;
const sdk = require("@eth-optimism/sdk");
const { L2TransactionReceipt, L2ToL1MessageStatus, L1TransactionReceipt, L1ToL2MessageStatus } = require('@arbitrum/sdk');
const { L1ToL2MessageGasEstimator } = require('@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator');
const { hexDataLength } = require('@ethersproject/bytes');
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
const { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus, tokenPrice, ask } = require("./utils");

const { DEPLOYMENTS, PRIVATE_KEY, RPC_L1, RPC_OP, RPC_AB, L1_CHAIN_ID, DIRECTION, MIN_LP_FEE, MAX_FEE_PER_GAS_L1, SYNC_INTERVAL,
    MAX_PRIORITY_FEE_AB_CLAIM, GAS_PRICE_MULTIPLIER_OP_CLAIM, MAX_FEE_PER_GAS_AB, GAS_PRICE_OP, CLAIM_INTERVAL, CLAIM_TIME_BUFFER } = process.env;
const deployment = require(DEPLOYMENTS);
const claimInterval = CLAIM_INTERVAL * 1000;
const syncInterval = SYNC_INTERVAL * 1000;
if (DIRECTION !== "O2A" && DIRECTION !== "A2O") {
    throw "Supported DIRETION: 'O2A' or 'A2O'";
}
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

const srcNonceManager = new NonceManager(srcSigner);
const dstNonceManager = new NonceManager(dstSigner);
const l1NonceManager = new NonceManager(l1Signer);

const srcContract = new Contract(srcAddress, [
    "event Deposit(address indexed srcTokenAddress,address indexed dstTokenAddress,address indexed source,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup,uint256 expiration)",
    "function transferStatus(bytes32) public view returns (uint256)",
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function processedCount() public view returns (uint256)",
    "function processClaims((bytes32 transferDataHash,address claimer,address srcTokenAddress,uint256 amount)[] memory rewardDataList,uint256[] memory skipFlags) public",
], srcProvider).connect(srcNonceManager);
const dstContract = new Contract(dstAddress, [
    "event Claim(bytes32 indexed transferDataHash,address indexed claimer,address indexed srcTokenAddress,uint256 amount,uint256 count)",
    "event L2ToL1TxCreated(uint256, bytes32)",
    "function GAP() public view returns (uint256)",
    "function rewardHashOnion() public view returns (byte32)",
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function getLPFee((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHeadToArbi(uint256 count,uint32 maxGas) public",
    "function declareNewHashChainHead(uint256 count) public",
], dstProvider).connect(dstNonceManager);
const l1Contract = new Contract(l1Address, [
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function setChainHashInL2(uint256 count,uint256 maxSubmissionCost,uint256 maxGas,uint256 gasPriceL2) public payable returns (uint256)"
], l1Provider).connect(l1NonceManager);

const iface = new utils.Interface(['function updateChainHashFromL1(uint256 count,bytes32 chainHash)']);

const opL1Messenger = new sdk.CrossChainMessenger({
    l1SignerOrProvider: l1NonceManager,
    l2SignerOrProvider: dstSigner,
    l1ChainId: L1_CHAIN_ID,
    l2ChainId: L1_CHAIN_ID == 1 ? 10 : 420
});

let claimedCountStatus;
let processedBlockSrc;
let lastSearchedBlock;
let lastSearchedCount;

let balances = {};

let totalClaim = 0;

async function traceDeposit(fromBlock) {
    let toBlock;
    try {
        let transferData = [];
        toBlock = await srcProvider.getBlockNumber();
        if (toBlock >= fromBlock) {
            const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
            logClaim(`from block ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
            transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        }
        for (let i = 0; i < transferData.length; i++) {
            const { name, decimal } = findTokenByL2Address(transferData[i][1]);
            logClaim(`found transferData with amount of ${utils.formatUnits(transferData[i][3], decimal)} ${name}`);
            if (Date.now() + L2ToL1Delay + CLAIM_TIME_BUFFER * 1000 > transferData[i][7] * 1000) {
                logClaim("rejected: the deposit could be expired before challenge period end");
                continue;
            }
            if (Date.now() < transferData[i][5] * 1000) {
                const timeout = transferData[i][5] * 1000 - Date.now();
                logClaim(`the deposit is not started; will retry in ${timeout / 1000} seconds`);
                setTimeout(() => {
                    takeOrder(transferData[i]);
                }, timeout);
                continue;
            }
            await takeOrder(transferData[i]);
        }
    } catch (e) {
        err("claim", e.code ? "**" + e.code + "**" : e);
    }
    processedBlockSrc = toBlock;
    save();
    setTimeout(() => traceDeposit(toBlock + 1), claimInterval);
}

async function takeOrder(transferData) {
    const transferDataHash = utils.keccak256(
        utils.defaultAbiCoder.encode([
            "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256)"],
            [transferData]));
    const key = transferDataHash.substring(0, 6);
    const { name, decimal, L1: tokenAddrL1 } = findTokenByL2Address(transferData[1]);
    try {
        const logClaimKey = (...msg) => logClaim(`key=${key}`, ...msg);
        logClaimKey(`takeOrder...`)
        if (await dstContract.claimedTransferHashes(transferDataHash)) {
            logClaimKey("already bought");
            return;
        }
        const balance = await getBalance(transferData[1], dstSigner);
        logClaimKey(`balance of ${name}: ${utils.formatUnits(balance, decimal)}`)
        if (balance === 0 || balance.lt(transferData[3])) {
            throw `**INSUFFICIENT BALANCE** of token ${name}`;
        }
        if (BigNumber.from(transferData[4]).isZero()) {
            logClaimKey("no LP fee");
            return;
        }
        const tkPrice = await tokenPrice(tokenAddrL1);
        const maxLpFeeUnitsInUsd = BigNumber.from(transferData[4]).mul((Number(tkPrice) * 100).toFixed(0)).div(100);
        logClaimKey(`min LP fee: $${MIN_LP_FEE}; max LP fee: ${utils.formatUnits(transferData[4], decimal)} ${name} or $${utils.formatUnits(maxLpFeeUnitsInUsd, decimal)}`);
        if (maxLpFeeUnitsInUsd.lt(MIN_LP_FEE * (10 ** decimal))) {
            logClaimKey("rejected: LP fee too low");
            return;
        }
        const lpFeeUnits = await dstContract.getLPFee(transferData);
        const lpFeeUnitsInUsd = lpFeeUnits.mul((Number(tkPrice) * 100).toFixed(0)).div(100);
        logClaimKey(`min LP fee: $${MIN_LP_FEE}; current LP fee: ${utils.formatUnits(lpFeeUnits, decimal)} ${name} or $${utils.formatUnits(lpFeeUnitsInUsd, decimal)}`);
        if (lpFeeUnitsInUsd.lt(MIN_LP_FEE * (10 ** decimal))) {
            const timeout = await timeoutForMinFee(transferData, key);
            if (timeout > 0) {
                logClaimKey(`skip for now due to low LP fee; will retry in ${timeout / 1000} seconds`);
                setTimeout(() => {
                    takeOrder(transferData);
                }, timeout);
            }
            return;
        }
        const data = transferData.map(t => String(t));
        logClaimKey(`start claiming `, data);
        const count = await take(transferData, key);
        if (count > 0) {
            claimedCountStatus.set(count, { token: name, amount: utils.formatUnits(transferData[3], decimal), status: 'claimed' });
            save();
            if (syncInterval === 0) {
                const txHash = await declare(count);
                if (txHash) {
                    const item = claimedCountStatus.get(count);
                    item.status = 'declared';
                    item.tx = txHash;
                    item.time = Date.now();
                    save();
                    passingHash(count);
                }
            }
        }
    } catch (e) {
        err('claim', `key=${key} takeOrder `, e);
    }
}

async function take(transferData, key) {
    let tx;
    try {
        const gasEst = await dstContract.estimateGas.claim(transferData);
        const gasLimit = gasEst.mul(6).div(5);
        // const gasLimit = 120000;
        if (DIRECTION === "O2A") {
            const { gasPrice, maxPriorityFeePerGas: maxPriorityFeePerGasDefault } = await dstProvider.getFeeData();
            let maxPriorityFeePerGas = maxPriorityFeePerGasDefault;
            if (MAX_PRIORITY_FEE_AB_CLAIM > -1) {
                const maxPriorityFeePerGasSet = utils.parseUnits(String(MAX_PRIORITY_FEE_AB_CLAIM), "gwei");
                logClaim(`maxPriorityFeePerGas set ${MAX_PRIORITY_FEE_AB_CLAIM}, maxPriorityFeePerGas default ${utils.formatUnits(maxPriorityFeePerGasDefault, "gwei")}`)
                if (maxPriorityFeePerGasSet.gt(maxPriorityFeePerGasDefault)) {
                    maxPriorityFeePerGas = maxPriorityFeePerGasSet;
                }
            }
            const cost = gasPrice.add(maxPriorityFeePerGas).mul(gasEst);
            logClaim(`key=${key} estimated cost: ${utils.formatEther(cost)} ether`);
            tx = await dstContract.claim(transferData, { gasLimit, maxPriorityFeePerGas });
        } else {
            let gasPrice = await dstProvider.getGasPrice();
            if (GAS_PRICE_MULTIPLIER_OP_CLAIM > 0) {
                gasPrice = gasPrice.mul(GAS_PRICE_MULTIPLIER_OP_CLAIM).div(100);
            }
            const cost = gasPrice.mul(gasEst);
            logClaim(`key=${key} estimated cost: ${utils.formatEther(cost)} ether`);
            tx = await dstContract.claim(transferData, { gasLimit, gasPrice });
        }
        if (tx) {
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                totalClaim++;
                const count = receipt.events.filter(r => r.event === 'Claim')[0].args.count.toNumber();
                if (receipt.effectiveGasPrice) {
                    const cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                    logClaim(`key=${key} claimed successfully with cost of ${utils.formatEther(cost)} ether as count`, count);
                } else {
                    logClaim(`key=${key} claimed successfully as count`, count);
                }
                return count;
            }
            err("claim", `key=${key} tx failed:`, tx.hash);
        }
    } catch (e) {
        if (e.body) {
            const { error } = JSON.parse(e.body);
            err("claim", `key=${key}`, error.message);
        } else
            if (e.reason) {
                err("claim", `key=${key}`, e.reason);
            }
            else {
                err("claim", `key=${key}`, e);
            }
    }
    return 0;
}

async function timeoutForMinFee(transferData, key) {
    let timeSec = MIN_LP_FEE * transferData[6] / (transferData[4] / 1e18);
    try {
        const { number, timestamp } = await dstProvider.getBlock("latest");
        logClaim(`key=${key} latest block: ${number} timestamp=${timestamp}`);
        timeSec = timeSec + parseInt(transferData[5]) - timestamp;
        return timeSec * 1000;
    } catch (e) {
        logClaim(`key=${key} waiting for fee rampup failed: ${e.reason}`);
    }
}

function findTokenByL2Address(l2Addr) {
    l2Addr = l2Addr.toLowerCase();
    for (let t of tokens) {
        if (t.Arbitrum.toLowerCase() === l2Addr.toLowerCase() || t.Optimism.toLowerCase() === l2Addr.toLowerCase()) {
            return t;
        }
    }
    throw "Cannot find token " + l2Addr;
}

async function syncLatestClaimed() {
    logSync("start syncing latest claimed count");
    const unsynced = [];
    for (const k of claimedCountStatus.keys()) {
        if (claimedCountStatus.get(k).status === "claimed") {
            unsynced.push(k);
        }
    }
    if (unsynced.length === 0) {
        logSync(`no claims to sync; will check again in ${syncInterval / 1000} seconds`);
    } else {
        let count;
        try {
            const latestCount = await dstContract.transferCount();
            count = latestCount.toNumber();
        } catch (e) {
            err('sync', "transferCount error", e.code);
        }
        if (count > 0) {
            const txHash = await declare(count);
            if (txHash) {
                let item = claimedCountStatus.get(count); // could be other LP's count
                if (!item) {
                    item = {};
                    claimedCountStatus.set(count, item);
                    unsynced.push(count);
                }
                for (const k of unsynced) {
                    const item = claimedCountStatus.get(k);
                    item.status = 'declared';
                    item.tx = txHash;
                    item.time = Date.now();
                }
                save();
                passingHash(count);
            }
        }
    }
    setTimeout(() => syncLatestClaimed(), syncInterval);
}

async function declare(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount("start declare");
    let tx;
    let gasPrice;
    if (DIRECTION === "A2O") {
        try {
            gasPrice = await srcProvider.getGasPrice();
            if (GAS_PRICE_OP > 0) {
                let gasPriceCeil = utils.parseUnits(GAS_PRICE_OP, "gwei");
                if (gasPrice.gt(gasPriceCeil)) {
                    gasPrice = gasPriceCeil;
                }
            }
            const maxGas = 1000000;
            tx = await dstContract.declareNewHashChainHeadToArbi(count, maxGas, { gasPrice });
        } catch (e) {
            err('sync', `count=${count} declareNewHashChainHeadToArbi error`);
            return null;
        }
    } else {
        try {
            if (MAX_FEE_PER_GAS_AB > 0) {
                const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_AB, "gwei");
                tx = await dstContract.declareNewHashChainHead(count, { maxFeePerGas });
            } else {
                tx = await dstContract.declareNewHashChainHead(count);
            }
        } catch (e) {
            err('sync', `count=${count} declareNewHashChainHead error`);
            return null;
        }
    }
    if (tx) {
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            let cost;
            if (receipt.effectiveGasPrice) {
                cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            } else {
                cost = receipt.gasUsed.mul(gasPrice);
            }
            logSyncCount(`declared successfully costs ${utils.formatEther(cost)} ether`);
            const chainHead = `0x${receipt.events[1].data.slice(-64)}`;
            logSyncCount("chainHead", chainHead);
            return tx.hash;
        }
    }
    return null;
}

async function withdrawn(count) {
    try {
        const processed = await srcContract.processedCount();
        return processed.gte(count);
    } catch (e) {
        err("sync", "query known hash on L1 failed. ", e.code);
    }
    return false;
}

async function passingHash(count) {
    let item = claimedCountStatus.get(count);
    if (!item || !item.tx) {
        logSync(`count=${count} cannot find pending order`);
        const status = await checkCountStatus(count);
        logSync(`count=${count}`, status);
        return;
    }
    if (DIRECTION === "O2A") {
        if (await triggerL1MsgArbitrum(count)) {
            while (true) {
                if (await knownHashOnionsL1(count)) {
                    break;
                }
                await new Promise(r => setTimeout(r, 5 * 1000));
            }
            if (await waitSyncedToL2(count)) {
                await processWithdraw(count);
            }
        } else {
            claimedCountStatus.get(count).status = "triggerFailed";
        }
    } else {
        if (await triggerL1MsgOptimism(count)) {
            while (true) {
                if (await knownHashOnionsL1(count)) {
                    break;
                }
                await new Promise(r => setTimeout(r, 5 * 1000));
            }
            if (await updateHashToArbitrumFromL1(count)) {
                if (await waitSyncedToL2(count)) {
                    await processWithdraw(count);
                }
            }
        } else {
            claimedCountStatus.get(count).status = "triggerFailed";
        }
    }
}

async function triggerL1MsgOptimism(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount("try to trigger Optimism to L1 tx");
    let item = claimedCountStatus.get(count);
    if (!item) {
        logSyncCount(`cannot find pending order`);
        const status = await checkCountStatus(count);
        logSyncCount(status);
        return false;
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
            logSyncCount(`OP status=${sdk.MessageStatus[state]}; expected: ${sdk.MessageStatus[sdk.MessageStatus.READY_FOR_RELAY]}`);
            if (state === sdk.MessageStatus.RELAYED) {
                logSyncCount(`relayed`);
                break;
            }
            if (state === sdk.MessageStatus.READY_FOR_RELAY) {
                logSyncCount(`ready for relay`);
                break;
            }
        } catch (e) {
            err("sync", `count=${count} getMessageStatus`, e.code ? "**" + e.code + "**" : e);
        }
        await new Promise(r => setTimeout(r, 5 * 1000));
    }
    logSyncCount("start finalizing");
    let tx;
    try {
        const gasEst = await opL1Messenger.estimateGas.finalizeMessage(txHash);
        if (MAX_FEE_PER_GAS_L1 > 0) {
            const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_L1, "gwei");
            const cost = gasEst.mul(maxFeePerGas);
            logSyncCount(`finalize using MAX_FEE_PER_GAS_L1 (${MAX_FEE_PER_GAS_L1} gwei) estimated cost ${utils.formatEther(cost)} ether`)
            tx = await opL1Messenger.finalizeMessage(txHash, { maxFeePerGas });
        } else {
            const { maxFeePerGas } = await l1Provider.getFeeData();
            const cost = gasEst.mul(maxFeePerGas);
            logSyncCount(`finalize using default maxFeePerGas ${maxFeePerGas} estimated cost ${utils.formatEther(cost)} ether`)
            tx = await opL1Messenger.finalizeMessage(txHash);
        }
        if (tx) {
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                const cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                logSyncCount(`relay message successfully with cost of ${utils.formatEther(cost)} ether, effective gas price ${utils.formatUnits(receipt.effectiveGasPrice, "gwei")} gwei`);
                claimedCountStatus.get(count).status = "triggered";
                save();
                return true;
            }
            err("sync", `count=${count} finalizeMessage failed. tx: ${tx.hash}`);
        }
    } catch (e) {
        err("sync", `count=${count} finalizeMessage failed`, e.code ? "**" + e.code + "**" : e);
    }
    return false;
}

async function triggerL1MsgArbitrum(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        const item = claimedCountStatus.get(count);
        if (!item) {
            logSyncCount(`cannot find pending order`);
            const status = await checkCountStatus(count);
            logSyncCount(status);
            return false;
        }
        const txHash = item.tx;
        logSyncCount("get transaction receipt from Arbitrum to L1")
        const receipt = await dstProvider.getTransactionReceipt(txHash);
        const l2Receipt = new L2TransactionReceipt(receipt);
        logSyncCount("getL2ToL1Messages")
        const messages = await l2Receipt.getL2ToL1Messages(l1NonceManager, dstProvider);
        const l2ToL1Msg = messages[0]
        if ((await l2ToL1Msg.status(dstProvider)) == L2ToL1MessageStatus.EXECUTED) {
            logSyncCount(`already executed`);
            return true;
        }
        const delay = item.time + L2ToL1Delay - Date.now();
        if (delay > 0) {
            logSyncCount(`Challenge peroid: waiting for ${delay / 1000 / 3600} hours to trigger on L1`);
            await l2ToL1Msg.waitUntilReadyToExecute(dstProvider, 10 * 1000);
        }
        logSyncCount('Outbox entry exists! Trying to execute now');
        let tx;
        if (MAX_FEE_PER_GAS_AB > 0) {
            const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_AB, "gwei");
            tx = await l2ToL1Msg.execute(dstProvider, { maxFeePerGas });
        } else {
            tx = await l2ToL1Msg.execute(dstProvider);
        }
        if (tx) {
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                const cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                logSyncCount(`l2ToL1Msg.execute succesfully with cost of ${utils.formatEther(cost)} ether`);
                claimedCountStatus.get(count).status = "triggered";
                save();
                return true;
            }
            err("sync", `count=${count} l2ToL1Msg.execute failed, tx=${tx.hash}`);
        }
    } catch (e) {
        err("sync", `count=${count} trigger msg from Arbitrum to L1 failed.`, e.code ? "**" + e.code + "**" : e);
    }
    err("sync", `count=${count} triggerL1MsgArbitrum failed`);
    return false;
}

async function waitSyncedToL2(count) {
    logSync(`count=${count} waiting for ${L1ToL2Delay / 60 / 1000} minutes to check on src`)
    await new Promise(r => setTimeout(r, L1ToL2Delay + 10 * 1000));
    while (true) {
        if (await checkSyncResult(count)) {
            break;
        }
        if (!claimedCountStatus.get(count)) {
            //withdrawn with other count
            logSync(`count=${count} cannot find pending order`);
            const status = await checkCountStatus(count);
            logSync(`count=${count}`, status);
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


async function doWithdraw(fromCount, toCount) {
    logWithdraw(`do withdraw from ${fromCount} to ${toCount}`);
    const { result: rewardDataList, searchedBlock } = await retrieveRewardData(fromCount, toCount);
    let tx;
    try {
        if (rewardDataList.length === 0) {
            logWithdraw("no reward data to withdraw.")
            return false;
        }
        const gas = await srcContract.estimateGas.processClaims(rewardDataList, [0]);
        const gasLimit = gas.mul(4).div(3);
        if (DIRECTION === "O2A") {
            let gasPrice = await srcProvider.getGasPrice();
            if (GAS_PRICE_OP > 0) {
                let gasPriceCeil = utils.parseUnits(GAS_PRICE_OP, "gwei");
                if (gasPrice.gt(gasPriceCeil)) {
                    gasPrice = gasPriceCeil;
                }
            }
            tx = await srcContract.processClaims(rewardDataList, [0], { gasLimit, gasPrice });
        } else {
            if (MAX_FEE_PER_GAS_AB > 0) {
                const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_AB, "gwei");
                tx = await srcContract.processClaims(rewardDataList, [0], { gasLimit, maxFeePerGas });
            } else {
                tx = await srcContract.processClaims(rewardDataList, [0], { gasLimit });
            }
        }
        if (tx) {
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                logWithdraw(`withdrawn ${toCount - fromCount + 1} deposits (${fromCount} to ${toCount}) successfully 🤑! `);
                if (receipt.effectiveGasPrice) {
                    const cost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                    logWithdraw(`withdraw costs ${utils.formatEther(cost)} ether`);
                }
                for (let i = fromCount; i <= toCount; i++) {
                    claimedCountStatus.delete(i);
                    save();
                }
                lastSearchedBlock = searchedBlock;
                lastSearchedCount = toCount;
                save();
                return true;
            }
            err("withdraw", `withdraw ${toCount - fromCount + 1} deposits (${fromCount} to ${toCount}) failed 🤔 tx: ${tx.hash}`);
        }
    } catch (e) {
        if (e.body) {
            const { error } = JSON.parse(e.body)
            err("withdraw", error.message)
        } else
            if (e.reason) {
                err("withdraw", e.reason)
            }
            else {
                err("withdraw", e)
            }
    }
    err("withdraw", `withdraw ${toCount - fromCount + 1} deposits (${fromCount} to ${toCount}) failed 🤔`);
    return false;
}


async function updateHashToArbitrumFromL1(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount(`update hash to Arbitrum from L1`);
    let item = claimedCountStatus.get(count);
    if (!item) {
        logSyncCount(`cannot find pending order`);
        const status = await checkCountStatus(count);
        logSyncCount(status);
        return false;
    }
    const newBytes = utils.defaultAbiCoder.encode(
        ['uint256'],
        [count]
    );
    const newBytesLength = hexDataLength(newBytes) + 4 // 4 bytes func identifier
    try {
        const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(srcProvider);
        const gasPriceL1 = await l1Provider.getGasPrice();
        logSyncCount(`L1 gas price: ${utils.formatUnits(gasPriceL1, "gwei")} gwei`);
        const _submissionPriceWei = await l1ToL2MessageGasEstimate.estimateSubmissionFee(
            l1Provider,
            gasPriceL1,
            newBytesLength
        );
        logSyncCount(`Current retryable base submission price: ${utils.formatUnits(_submissionPriceWei, "gwei")} gwei`);
        const submissionPriceWei = _submissionPriceWei.mul(5);
        const gasPriceL2 = await srcProvider.getGasPrice();
        logSyncCount(`L2 gas price: ${utils.formatUnits(gasPriceL2, "gwei")} gwei`);
        const known = await l1Contract.knownHashOnions(count);
        const calldata = iface.encodeFunctionData('updateChainHashFromL1', [count, known]);
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
            gasPriceL2
        );
        const callValue = submissionPriceWei.add(gasPriceL2.mul(maxGas));
        logSyncCount(`Sending hash to L2 with ${utils.formatEther(callValue)} ether callValue for L2 fees`);
        let setTx;
        try {
            const gasEst = await l1Contract.estimateGas.setChainHashInL2(
                count,
                submissionPriceWei,
                maxGas,
                gasPriceL2,
                { value: callValue }
            );
            if (MAX_FEE_PER_GAS_L1 > 0) {
                const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_L1, "gwei");
                const cost = maxFeePerGas.mul(gasEst);
                logSyncCount(`setChainHashInL2 using MAX_FEE_PER_GAS_L1 (${MAX_FEE_PER_GAS_L1} gwei) estimated cost at most: ${utils.formatEther(cost)} ether`);
                setTx = await l1Contract.setChainHashInL2(
                    count,
                    submissionPriceWei,
                    maxGas,
                    gasPriceL2,
                    { value: callValue, maxFeePerGas }
                );
            } else {
                const { maxFeePerGas } = await l1Provider.getFeeData();
                console.log("maxFeePerGas=" + maxFeePerGas)
                const cost = maxFeePerGas.mul(gasEst);
                logSyncCount(`setChainHashInL2 estimated cost at most: ${utils.formatEther(cost)} ether`);
                setTx = await l1Contract.setChainHashInL2(
                    count,
                    submissionPriceWei,
                    maxGas,
                    gasPriceL2,
                    { value: callValue }
                );
            }
        } catch (e) {
            logSyncCount(`setChainHashInL2 failed.`, e);
            claimedCountStatus.get(count).status = "l1ToL2SetChainHashInL2Failed";
            save();
            return false;
        }
        const setRec = await setTx.wait();
        if (setRec.status == 1) {
            item = claimedCountStatus.get(count);
            item.status = "l1ToL2Called";
            item.setTx = setTx.hash;
            save();
            console.log("effectiveGasPrice=" + setRec.effectiveGasPrice)
            if (setRec.effectiveGasPrice) {
                const cost = setRec.gasUsed.mul(setRec.effectiveGasPrice);
                logSyncCount(`setChainHashInL2 successfully on L1 with cost of ${utils.formatEther(cost)} ether`);
            } else {
                logSyncCount(`setChainHashInL2 successfully on L1`);
            }
            const l1TxReceipt = new L1TransactionReceipt(setRec);
            const message = (await l1TxReceipt.getL1ToL2Messages(srcNonceManager))[0];
            logSyncCount("start waiting for redeem to Arbitrum");
            for (let i = 0; i < 3; i++) {
                let result;
                try {
                    result = await message.waitForStatus();
                } catch (e) {
                    err("sync", `count=${count}`, "waitForStatus", e);
                    const status = await message.status();
                    result = { status };
                }
                logSyncCount("status", L1ToL2MessageStatus[result.status]);
                if (result.status === L1ToL2MessageStatus.REDEEMED) {
                    logSyncCount(`L2 retryable txn executed`);
                    claimedCountStatus.get(count).status = "l1ToL2Redeemed";
                    save();
                    return true;
                }
            }
            return redeemRetryableTicket(count, message);
        } else {
            logSyncCount(`L2 setChainHashInL2 failed: ${setTx.hash}`);
        }
    } catch (e) {
        err("sync", `count=${count}`, "updateHashToArbitrumFromL1", e);
    }
    claimedCountStatus.get(count).status = "l1ToL2RedeemFailed";
    save();
    return false;
}

async function redeemRetryableTicket(count, message) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount("try to redeemRetryableTicket");
    let item = claimedCountStatus.get(count);
    if (!item) {
        logSyncCount(`cannot find pending order`);
        const status = await checkCountStatus(count);
        logSyncCount(status);
        return false;
    }
    if (!message) {
        if (!item.setTx) {
            err('sync', `count=${count} cannot find setTx`);
            item.status = "l1ToL2SetChainHashInL2Failed";
            return false;
        }
        const setRec = await l1Provider.getTransactionReceipt(item.setTx);
        const l1TxReceipt = new L1TransactionReceipt(setRec);
        message = (await l1TxReceipt.getL1ToL2Messages(srcNonceManager))[0];
    }
    const status = await message.status();
    if (status === L1ToL2MessageStatus.REDEEMED) {
        logSyncCount(`Already redeemed.`);
        claimedCountStatus.get(count).status = "l1ToL2Redeemed";
        save();
        return true;
    }
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
        //set random timeout to avoid nonce confliction
        // await new Promise(r => setTimeout(r, (count % 10) * 60 * 1000));
        try {
            logSyncCount("start to redeem");
            let redeemTx;
            if (MAX_FEE_PER_GAS_L1 > 0) {
                const maxFeePerGas = utils.parseUnits(MAX_FEE_PER_GAS_L1, "gwei");
                redeemTx = await message.redeem({ maxFeePerGas });
            } else {
                redeemTx = await message.redeem();
            }
            const redeemRec = await redeemTx.wait();
            if (redeemRec.status == 1) {
                if (redeemRec.effectiveGasPrice) {
                    const cost = redeemRec.gasUsed.mul(redeemRec.effectiveGasPrice);
                    logSyncCount(`redeem successfully on L1 with cost of ${utils.formatEther(cost)} ether`);
                } else {
                    logSyncCount(`redeem successfully on L1`);
                }
                claimedCountStatus.get(count).status = "l1ToL2Redeemed";
                save();
                return true;
            }
            err("sync", `count=${count} redeem failed: ${redeemTx.hash}`);
        } catch (e) {
            err("sync", `count=${count}`, "redeem", e);
        }
    }
    return false;
}

async function checkSyncResult(count) {
    logSync(`count=${count} checking hash on src...`);
    try {
        const onion = await srcContract.knownHashOnions(count);
        if (onion != constants.HashZero) {
            logSync(`count=${count} hash found on src`);
            return true;
        }
    } catch (e) {
        err("sync", `count=${count} check sync result failed: `, e.code ? "**" + e.code + "**" : e);
    }
    return false;
}

async function knownHashOnionsL1(count) {
    logSync(`count=${count} checking hash on L1...`);
    try {
        const known = await l1Contract.knownHashOnions(count);
        if (known != constants.HashZero) {
            logSync(`count=${count} hash found on L1`);
            return true;
        }
    } catch (e) {
        err("sync", "query known hash on L1 failed. ", e.code);
        return knownHashOnionsL1(count);
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
        for (let c of claimedCountStatus.keys()) {
            if (c <= count) {
                claimedCountStatus.delete(c);
                save();
            }
        }
        logSyncCount("already withdrawn");
        return;
    }
    let item = claimedCountStatus.get(count);
    if (!item) {
        const answer = await ask(`Count ${count} does not seem initialized locally, and could be managed by others. Continue (y/n)?`);
        if (answer !== 'y') {
            return;
        }
    }
    if (await checkSyncResult(count)) {
        logSyncCount("already synced to src");
        await processWithdraw(count);
        return;
    }
    if (await knownHashOnionsL1(count)) {
        logSyncCount("already synced to L1");
        if (DIRECTION === "A2O" && item && item.status !== "l1ToL2Redeemed") {
            if (item && (item.status === "l1ToL2RedeemFailed" || item.status === "l1ToL2Called")) {
                if (!await redeemRetryableTicket(count)) {
                    err("sync", `count=${count} redeemRetryableTicket failed.`);
                    return;
                }
            }
            if (!await updateHashToArbitrumFromL1(count)) {
                err("sync", `count=${count} updateHashToArbitrumFromL1 failed.`);
                return;
            }
        }
        if (await waitSyncedToL2(count)) {
            await processWithdraw(count);
        }
        return;
    }
    if (item && item.status === "triggered") {
        while (true) {
            if (await knownHashOnionsL1(count)) {
                break;
            }
            await new Promise(r => setTimeout(r, 5 * 1000));
        }
        if (DIRECTION === "A2O") {
            if (!await updateHashToArbitrumFromL1(count)) {
                err("sync", `count=${count} updateHashToArbitrumFromL1 failed.`);
                return;
            }
        }
        if (await waitSyncedToL2(count)) {
            await processWithdraw(count);
            return;
        }
    }
    if (item && item.tx) {
        await passingHash(count);
        return;
    }
    const [gap, transferCount] = await Promise.all([dstContract.GAP(), dstContract.transferCount()]);
    if (count != transferCount && count % gap != 0) {
        logSyncCount("skip sync: cannot declare because hash will not be found on dst");
        return;
    }
    const txHash = await declare(count);
    logSyncCount("sync hash from dst chain.");
    if (txHash) {
        claimedCountStatus.set(count, { status: "declared", tx: txHash, time: Date.now() });
        await passingHash(count);
    }
}

async function checkCountStatus(count) {
    const item = claimedCountStatus.get(count);
    if (item) {
        const { status } = item;
        if (status === "claimed") {
            return `dst: claimed`;
        }
        if (status === "triggered" || status === "triggerFailed") {
            return `dst => L1: ${status}`;
        }
        if (status === "declared") {
            if (item.time) {
                const delay = item.time + L2ToL1Delay - Date.now();
                if (delay > 0) {
                    return `dst => L1: in challenge period, waiting for ${delay / 1000 / 3600} hours to trigger on L1`;
                }
            }
            return `dst => L1: challenge period end, waiting for status change to trigger`;
        }
        // A2O only
        if (status && status.startsWith("l1ToL2")) {
            return `L1 => src: ${status}`;
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
    logWithdraw(`start searching on chain for rewardData from ${fromCount} to ${toCount}`);
    const total = toCount - fromCount + 1;
    let result = [];
    let fromBlock = lastSearchedBlock ? lastSearchedBlock : genesisBlockDst;
    let i = lastSearchedCount ? lastSearchedCount : 0;
    let searchedBlock = lastSearchedBlock;
    try {
        const curBlock = await dstProvider.getBlockNumber();
        out: while (true) {
            const toBlock = Math.min(curBlock, fromBlock + 5000);
            const res = await dstContract.queryFilter(dstContract.filters.Claim(), fromBlock, toBlock);
            if (res.length > 0) {
                logWithdraw(`from block ${fromBlock} to ${toBlock} has ${res.length} Claims`);
            }
            for (r of res) {
                i = i + 1;
                const countInEvent = r.args[4];
                if (countInEvent >= fromCount && countInEvent <= toCount) {
                    result.push(r.args.slice(0, 4));
                    logWithdraw(`add rewardData count=${countInEvent} on block ${r.blockNumber}`);
                    if (result.length === total) {
                        searchedBlock = r.blockNumber;
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
        err("withdraw", "query Claim events failed:", e.code ? "**" + e.code + "**" : e);
    }
    return { result, searchedBlock };
}

async function syncPendings() {
    logMain("sync pending orders if any...")
    for (let c of claimedCountStatus.keys()) {
        syncCount(c);
        await new Promise(r => setTimeout(r, 60 * 1000));
    }
}

async function approve() {
    logMain("Checking token allowance...");
    for (let t of dstTokens) {
        const erc20Token = new Contract(t, [
            "function allowance(address, address) public view returns (uint256)",
            "function approve(address,uint256) public",
        ], dstNonceManager);
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
    save();
    if (!(process.argv.length > 2 && (process.argv[2] === "status" || process.argv[2] === "sync"))) {
        console.log("\nTotally claimed", totalClaim);
    }
    process.exit();
}

function save() {
    saveStatus(processedBlockSrc, lastSearchedBlock, lastSearchedCount, claimedCountStatus);
}

async function queryBalances() {
    const bals = {};
    try {
        const promises = [l1Signer.getBalance(), srcSigner.getBalance(), dstSigner.getBalance()];
        for (let t of tokens) {
            const l1Addr = t.L1;
            const srcAddr = DIRECTION === "O2A" ? t.Optimism : t.Arbitrum;
            const dstAddr = DIRECTION === "O2A" ? t.Arbitrum : t.Optimism;
            // promises.push(getBalance(l1Addr, l1Signer));
            promises.push(getBalance(srcAddr, srcSigner));
            promises.push(getBalance(dstAddr, dstSigner));
        }
        const result = await Promise.all(promises);
        bals.ETH = result.slice(0, 3);
        const tokenPrices = result.slice(3);
        for (let i = 0; i < tokens.length; i++) {
            bals[tokens[i].name] = tokenPrices.slice(i * 2, i * 2 + 2);
        }
    } catch (e) {
        console.log("query balances error", e);
    }
    return bals;
}

async function getBalance(tokenAddr, signer) {
    try {
        const erc20Token = new Contract(tokenAddr, [
            "function balanceOf(address) public view returns (uint256)"
        ], signer);
        const balance = await erc20Token.balanceOf(signer.address);
        return balance;
    } catch (e) {
        err("main", `cannot get balance of ${tokenAddr}`, e);
        // throw `cannot get balance of ${tokenAddr}`;
        return 0;
    }
}
//test only
async function diffBalances() {
    const fmt = (v) => utils.formatEther(v);
    const prt = (a, b) => `${fmt(a)}\t${fmt(b)}\t${a.lt(b) ? '+' : ''}${fmt(b.sub(a))}`;

    if (!balances || !balances.ETH) {
        return;
    }
    logMain(`Checking balances change; please wait...`)
    const [l10e, src0e, dst0e] = balances.ETH;
    const newBals = await queryBalances();
    if (!newBals.ETH) {
        logMain(`Checking balances change failed.`)
        return;
    }
    const [l1e, srce, dste] = newBals.ETH;
    console.log(`\nEthereum ETH: ${prt(l10e, l1e)} `);
    console.log(`${DIRECTION === 'O2A' ? 'Optimism' : 'Arbitrum'} ETH: ${prt(src0e, srce)}`);
    console.log(`${DIRECTION === 'O2A' ? 'Arbitrum' : 'Optimism'} ETH: ${prt(dst0e, dste)}`);
    for (let t of tokens) {
        const [src0, dst0] = balances[t.name];
        const [src, dst] = newBals[t.name];
        console.log(`${DIRECTION === 'O2A' ? 'Optimism' : 'Arbitrum'} ${t.name}: ${prt(src0, src)}`);
        console.log(`${DIRECTION === 'O2A' ? 'Arbitrum' : 'Optimism'} ${t.name}: ${prt(dst0, dst)}`);
    }
}

async function printBalances() {
    logMain("query balances...")
    const newBals = await queryBalances();
    const [l1e, srce, dste] = newBals.ETH;
    console.log("========================================================")
    console.log(`Token\t${DIRECTION === 'O2A' ? 'Optimism\tArbitrum' : 'Arbitrum\tOptimism'}\tEthereum\tTotal`);
    console.log("--------------------------------------------------------")
    console.log(`ETH:\t${utils.formatEther(srce)}\t${utils.formatEther(dste)}\t${utils.formatEther(l1e)}\t${utils.formatEther(l1e.add(srce).add(dste))}`);
    for (let t of tokens) {
        const [src, dst] = newBals[t.name];
        const fmt = (v) => utils.formatUnits(v, t.decimal);
        console.log(`${t.name}:\t${fmt(src)}\t${fmt(dst)}\t--\t${fmt(src.add(dst))}`);
    }
    console.log("========================================================")
}

async function main() {
    logMain(`Starting LP services for L2Bridge 
                          ${DIRECTION === 'O2A' ? '(Optimism => Arbitrum)' : '(Arbitrum => Optimism)'},
                          L1 chainId = ${L1_CHAIN_ID}`);
    logMain(`LP signer address ${l1Signer.address}`);
    process.stdin.resume();
    //do something when app is closing
    process.on('exit', async () => { await exitHandler() });
    //catches ctrl+c event
    process.on('SIGINT', async () => { await exitHandler() });
    process.on('uncaughtException', async e => {
        console.error(e);
        process.exit(1);
    });
    ({ processedBlockSrc, lastSearchedBlock, lastSearchedCount, claimedCountStatus } = loadStatus());
    if (process.argv.length === 2 || (process.argv.length > 2 && process.argv[2] === "sync")) {
        await approve();
    }
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
            process.exit();
        }
        if (args[0] === "status") {
            let count;
            if (args.length > 1) {
                if (isNaN(args[1])) {
                    logMain("invalid count", args[1]);
                    process.exit();
                }
                count = parseInt(args[1]);
                logMain("Status of user specified count", count);
                if (claimedCountStatus.has(count)) {
                    const { token, amount } = claimedCountStatus.get(count);
                    console.log("========================================================")
                    console.log(`count\tamount\ttoken\tstatus`);
                    console.log("----------------------------")
                    const status = await checkCountStatus(c);
                    console.log(count, `\t${amount}\t${token}\t${status}`);
                    console.log("========================================================")
                } else {
                    console.log(count, await checkCountStatus(count));
                }
                logMain("Done status.");
                process.exit();
            }
            logMain("Start checking status of your pending claims...");
            const status = new Map();
            for (let c of claimedCountStatus.keys()) {
                status.set(c, checkCountStatus(c));
            }
            await Promise.all(status.values());
            console.log("========================================================")
            console.log(`count\tamount\ttoken\tstatus`);
            console.log("----------------------------")
            for (let k of status.keys()) {
                const { token, amount } = claimedCountStatus.get(k);
                console.log(k, `\t${amount}\t${token}\t${await status.get(k)}`);
            }
            console.log("========================================================")
            await printBalances();
            logMain("Done status.");
            process.exit();
        }
        if (!isNaN(args[0])) {
            startBlock = parseInt(args[0]);
        }
        if (syncInterval === 0) {
            syncPendings();
        }
    }
    if (!startBlock) {
        startBlock = processedBlockSrc ? processedBlockSrc : await srcProvider.getBlockNumber();
    }
    logMain("Staring claiming service from block", startBlock, syncInterval > -1 ? "with" : "**without**", "sync/withdraw");
    traceDeposit(startBlock);
    if (syncInterval > 0) {
        setTimeout(() => syncLatestClaimed(), syncInterval);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

