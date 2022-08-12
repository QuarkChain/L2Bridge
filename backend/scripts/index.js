const { ethers } = require("ethers");
const sdk = require("@eth-optimism/sdk");
const { L2TransactionReceipt, L2ToL1MessageStatus, L1TransactionReceipt, L1ToL2MessageStatus } = require('@arbitrum/sdk');
const { L1ToL2MessageGasEstimator } = require('@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator')
const { hexDataLength } = require('@ethersproject/bytes');
require("dotenv").config();
const deployment = require("../../contract/deployments.json");
const { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus } = require("./utils");

const { PRIVATE_KEY, L1_RPC, OP_RPC, AB_RPC, L1_CHAIN_ID, DIRECTION, MIN_FEE, GAS_PRICE, CLAIM_INTERVAL_SECONDS, WITHDRAW_INTERVAL_SECONDS } = process.env;
const claimInterval = CLAIM_INTERVAL_SECONDS * 1000;
const withdrawInterval = WITHDRAW_INTERVAL_SECONDS * 1000;

const L2ToL1Delay = L1_CHAIN_ID == 1 ? 7 * 24 * 3600 * 1000 : (DIRECTION == "O2A" ? 24 * 3600 * 1000 : 60 * 1000);
const L1ToL2Delay = L1_CHAIN_ID == 1 ? (DIRECTION == "O2A" ? 5 * 3600 * 1000 : 15 * 60 * 1000) : 1 * 60 * 1000;

const genesisBlockSrc = deployment[L1_CHAIN_ID][DIRECTION].genesisSrc;
const genesisBlockDst = deployment[L1_CHAIN_ID][DIRECTION].genesisDst;
const srcAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeSrc;
const dstAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeDest;
const l1Address = deployment[L1_CHAIN_ID][DIRECTION].bridge;

const srcProvider = new ethers.providers.JsonRpcProvider(DIRECTION == "O2A" ? OP_RPC : AB_RPC);
const dstProvider = new ethers.providers.JsonRpcProvider(DIRECTION == "O2A" ? AB_RPC : OP_RPC);
const l1Provider = new ethers.providers.StaticJsonRpcProvider(L1_RPC);

const srcSigner = new ethers.Wallet(PRIVATE_KEY, srcProvider);
const dstSigner = new ethers.Wallet(PRIVATE_KEY, dstProvider);
const l1Signer = new ethers.Wallet(PRIVATE_KEY, l1Provider);

const srcContract = new ethers.Contract(srcAddress, [
    "event Deposit(address indexed srcTokenAddress,address indexed dstTokenAddress,address indexed source,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup,uint256 expiration)",
    "function transferStatus(bytes32) public view returns (uint256)",
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function processedCount() public view returns (uint256)",
    "function processClaims((bytes32 transferDataHash,address claimer,address srcTokenAddress,uint256 amount)[] memory rewardDataList,uint256[] memory skipFlags) public",
], srcProvider).connect(srcSigner);
const dstContract = new ethers.Contract(dstAddress, [
    "event Claim(bytes32 indexed transferDataHash,address indexed claimer,address indexed srcTokenAddress,uint256 amount)",
    "event L2ToL1TxCreated(uint256, bytes32)",
    "function GAP() public view returns (uint256)",
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function getLPFee((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHeadToArbi(uint256 count,uint32 maxGas) public",
    "function declareNewHashChainHead(uint256 count) public",
], dstProvider).connect(dstSigner);
const l1Contract = new ethers.Contract(l1Address, [
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function setChainHashInL2(uint256 count,uint256 maxSubmissionCost,uint256 maxGas,uint256 gasPriceBid) public payable returns (uint256)"
], l1Provider).connect(l1Signer);

//pending msg to trigger on L1
let pendingL1Msgs = new Map(); //count => {txHash, timestamp}
//claimed deposits need to withdraw on src
let claimedDeposits = new Map(); //transferHash => count
let processedBlockDst;
let processedBlockSrc;

async function traceDeposit(fromBlock, sync) {
    let toBlock;
    try {
        let transferData = [];
        toBlock = await srcProvider.getBlockNumber();
        // console.log("timestamp",         (await srcProvider.getBlock(toBlock)).timestamp);
        if (toBlock > fromBlock) {
            const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
            logClaim(`from ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
            transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        } else {
            logClaim("waiting for new blocks")
        }
        for (let i = 0; i < transferData.length; i++) {
            logClaim("found transferData amount", ethers.utils.formatEther(transferData[i][3]));
            if (Date.now() > transferData[i][7] * 1000) {
                logClaim("the deposit is expired");
                continue;
            }
            if (Date.now() < transferData[i][5] * 1000) {
                logClaim("the deposit is not started");
                continue;
            }
            const transferDataHash = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode([
                    "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256)"],
                    [transferData[i]]));
            const [lpFee, bought] = await Promise.all([dstContract.getLPFee(transferData[i]), dstContract.claimedTransferHashes(transferDataHash)]);
            if (bought) {
                logClaim("the claim is already bought");
                continue;
            }
            if (lpFee.lt(ethers.utils.parseEther(MIN_FEE))) {
                logClaim("skip due to low LP fee:", ethers.utils.formatUnits(lpFee));
                // toBlock = fromBlock; //  will loop again start from current fromBlock;
                continue;
            }
            logClaim(`will claim with fee=${ethers.utils.formatUnits(lpFee)}`)
            if (await take(transferData[i])) {
                const transCount = await dstContract.transferCount();
                const count = transCount.toNumber();
                claimedDeposits.set(count, [transferDataHash, srcSigner.address, transferData[i][0], String(transferData[i][4])]);
                if (sync) {
                    const txHash = await syncHashOnion(count);
                    if (txHash) {
                        pendingL1Msgs.set(count, { tx: txHash, time: Date.now() });
                        triggerL1Msg(count);
                    }
                }
            }
        }
        processedBlockSrc = toBlock;
    } catch (e) {
        err("claim", e.reason ? e.reason : e);
    }
    setTimeout(() => traceDeposit(toBlock, sync), claimInterval);
}

async function withdrawRecursive(interval) {
    if (claimedDeposits.size === 0) {
        logWithdraw("no claim records to withdraw.");
        return;
    }
    logWithdraw(`Starting withdraw...`)
    const processed = await srcContract.processedCount();
    logWithdraw(`processedCount from src is ${processed}`);
    const fromCount = processed.toNumber() + 1;
    const maxCount = Math.max(...claimedDeposits.keys());
    // check sync from latest to oldest count
    for (let count = maxCount; count >= fromCount; count--) {
        if (await withdrawn(count)) {
            logWithdraw("already withdrawn. count=", count);
            break;
        }
        if (await checkSyncResult(count)) {
            if (!await withdrawWithLocalData(fromCount, count)) {
                logWithdraw(`skip count ${count}.`)
            }
        } else {
            logWithdraw(`skip count ${count}: reward data is not synced to src.`)
        }
    }
    if (interval > 0) {
        logWithdraw(`next withdraw in ${interval / 1000} seconds.`);
        setTimeout(() => withdrawRecursive(interval), interval);
    }
}

async function withdrawWithLocalData(fromCount, toCount) {
    logWithdraw(`withdrawWithLocalData from ${fromCount} to ${toCount}`)
    const rewardDataList = [];
    for (let i = fromCount; i <= toCount; i++) {
        const rewardData = claimedDeposits.get(i);
        if (!rewardData) {
            logWithdraw(`cannot find withdrawData locally: count=${i}`);
            return false;
        }
        logWithdraw(i, rewardData)
        rewardDataList.push(rewardData);
    }
    if (await doWithdraw(rewardDataList)) {
        for (let i = fromCount; i <= toCount; i++) {
            claimedDeposits.delete(i);
        }
    };
}

async function doWithdraw(rewardData) {
    try {
        logWithdraw("do withdraw with", rewardData)
        if (rewardData.length === 0) {
            logWithdraw("no reward data to withdraw.")
            return false;
        }
        const gas = await srcContract.estimateGas.processClaims(rewardData, [0]);
        logWithdraw("withdraw gas", gas.toString())
        let tx;
        if (GAS_PRICE > 0) {
            const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
            tx = await srcContract.processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3), gasPrice });
        } else {
            tx = await srcContract.processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3) });
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            logWithdraw("withdraw reward success 🤑!", tx.hash);
            return true;
        }
    } catch (e) {
        err("withdraw", "withdraw failed 🤔", e.reason ? e.reason : e);
    }
    return false;
}

async function take(transferData) {
    const data = transferData.map(t => String(t));
    logClaim("starting claim order", data);
    let tx;
    try {
        const gas = await dstContract.estimateGas.claim(transferData);
        logClaim("gas", String(gas))
        if (GAS_PRICE > 0) {
            const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
            tx = await dstContract.claim(transferData, { gasPrice });
        } else {
            tx = await dstContract.claim(transferData);
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            logClaim("claim success");
            return true;
        }
        err("claim", "tx failed:", data, tx.hash);
    } catch (e) {
        err("claim", "claim failed:", data, e);
    }
    return false;
}

async function syncHashOnion(count) {
    logSync("syncHashOnion for count", String(count));
    try {
        let tx;
        if (DIRECTION == "A2O") {
            try {
                const maxGas = 1000000;
                const gas = await dstContract.estimateGas.declareNewHashChainHeadToArbi(count, maxGas);
                logSync("declareNewHashChainHeadToArbi gas", String(gas));
                if (GAS_PRICE > 0) {
                    const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
                    tx = await dstContract.declareNewHashChainHeadToArbi(count, maxGas, { gasPrice });
                } else {
                    tx = await dstContract.declareNewHashChainHeadToArbi(count, maxGas);
                }
            } catch (e) {
                err("sync", "syncHashOnion count=", count, e.error);
                throw "declareNewHashChainHeadToArbi error";
            }
        } else {
            try {
                const gas = await dstContract.estimateGas.declareNewHashChainHead(count);
                logSync("declareNewHashChainHead gas", String(gas));
                if (GAS_PRICE > 0) {
                    const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
                    tx = await dstContract.declareNewHashChainHead(count, { gasPrice });
                } else {
                    tx = await dstContract.declareNewHashChainHead(count);
                }
            } catch (e) {
                err("sync", "syncHashOnion count=", count, e);
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
        if (e.reason == "timeout") {
            return await syncHashOnion(count);
        }
    }
    return null
}

async function withdrawn(count) {
    try {
        const processed = await srcContract.processedCount();
        return processed.gte(count);
    } catch (e) {
        err("sync", "query known hash onion on L1 failed. ", e.reason);
    }
    return false;
}

async function triggerL1Msg(count) {
    if (DIRECTION == "O2A") {
        await triggerL1MsgArbitrum(count);
    } else {
        await triggerL1MsgOptimism(count);
    }
}

async function triggerL1MsgOptimism(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        logSyncCount("triggering L2 to L1 msg");
        const item = pendingL1Msgs.get(count);
        if (!item) {
            err("sync", "unknown pending msg for count", count);
            return;
        }
        const txHash = item.tx;
        const dstL1Messenger = new sdk.CrossChainMessenger({
            l1SignerOrProvider: l1Signer,
            l2SignerOrProvider: dstSigner,
            l1ChainId: L1_CHAIN_ID,
            l2ChainId: L1_CHAIN_ID == 1 ? 10 : 28 // boba
        });
        const delay = item.time + L2ToL1Delay + 3 * 1000 - Date.now();
        // const delay = 0;
        if (delay > 0) {
            logSyncCount(`waiting for ${delay / 1000 / 3600} hours to finalize msg ${txHash} on L1`);

            await new Promise(r => setTimeout(r, delay));
        } else {
            logSyncCount(`finalizing msg ${txHash} on L1, checking status...`);
        }
        while (true) {
            try {
                const state = await dstL1Messenger.getMessageStatus(txHash);
                logSyncCount(`op status=${state}; expected: ${sdk.MessageStatus.READY_FOR_RELAY}`);
                if (state === sdk.MessageStatus.RELAYED) {
                    logSyncCount(`relayed`);
                    // pendingL1Msgs.delete(count);
                    break;
                }
                if (state === sdk.MessageStatus.READY_FOR_RELAY) {
                    logSyncCount(`ready for relay`);
                    break;
                }
                await new Promise(r => setTimeout(r, 3 * 1000));
            } catch (e) {
                err("sync", `check status count=${count}`, e.reason ? e.reason : e);
            }
        }
        logSyncCount("starting finalize");
        let tx;
        try {
            const gas = await dstL1Messenger.estimateGas.finalizeMessage(txHash);
            const price = await l1Provider.getGasPrice();
            const cost = gas.mul(price);
            logSyncCount(`triggerL1MsgOptimism estimate gas &{gas} will cost ${ethers.utils.formatEther(cost)} ether`);
            if (GAS_PRICE > 0) {
                const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
                tx = await dstL1Messenger.finalizeMessage(txHash, { gasPrice });
            } else {
                tx = await dstL1Messenger.finalizeMessage(txHash);
            }
        } catch (e) {
            err("sync", `count=${count} finalizeMessage failed`, e)
            // Error: state root for message not yet published but
            // seems boba relay message automatically.
        }
        if (tx) {
            logSyncCount("l2ToL1Msg.execute result tx:", tx.hash)
            await tx.wait();
            logSyncCount("relay message success!");
        }
        if (await knownHashOnionsL1(count)) {
            await postL1Synced(count);
        }
    } catch (e) {
        err("sync", "triggerL1MsgOptimism failed. count=", count, e.reason ? e.reason : e);
        if (e.reason == "timemout") {
            logSyncCount("retry triggerL1MsgOptimism");
            await triggerL1MsgOptimism(count);
        }
    }
}
async function triggerL1MsgArbitrum(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        const item = pendingL1Msgs.get(count);
        if (!item) {
            err("sync", "unknown pending msg for count", count);
            return;
        }
        const txHash = item.tx;
        logSyncCount("getTransactionReceipt from Arbitrum to Ethereum")
        const receipt = await dstProvider.getTransactionReceipt(txHash)
        const l2Receipt = new L2TransactionReceipt(receipt);
        logSyncCount("getL2ToL1Messages")
        // await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 3000))

        const delay = item.time + L2ToL1Delay + 3 * 1000 - Date.now();
        // const delay = 0;
        if (delay > 0) {
            logSyncCount(`waiting for ${delay / 1000 / 3600} hours to check data availablility on L1`);
            await new Promise(r => setTimeout(r, delay));
        } else {
            logSyncCount(`checking data availablility...`);
        }
        let dataIsOnL1;
        while (true) {
            try {
                // if dataIsOnL1, sequencer has posted it and it inherits full rollup/L1 security
                dataIsOnL1 = await l2Receipt.isDataAvailable(dstProvider, l1Provider)
                logSyncCount(`ab isDataAvailable: ${dataIsOnL1}`);
            } catch (e) {
                err("sync", `check status count=${count}`, e.reason ? e.reason : e);
            }
            if (dataIsOnL1) {
                // const messages = await l2Receipt.getL2ToL1Messages(l1Signer, dstProvider);
                // l2ToL1Msg = messages[0];
                // if ((await l2ToL1Msg.status(dstProvider)) == L2ToL1MessageStatus.EXECUTED) {
                logSyncCount(`data is now avaliable on L1`);
                break;
            }
            await new Promise(r => setTimeout(r, 3 * 1000));
        }
        if (await knownHashOnionsL1(count)) {
            await postL1Synced(count);
        }
    } catch (e) {
        err("sync", "triggerL1MsgArbitrum failed. count=", count, e.reason ? e.reason : e);
        if (e.reason == "timemout") {
            logSyncCount("retry triggerL1MsgArbitrum");
            await triggerL1MsgArbitrum(count);
        }
    }
}

async function postL1Synced(count) {
    if (DIRECTION == "A2O") {
        if (!await updateHashToArbitrumFromL1(count)) {
            return;
        }
    }
    logSync(`waiting for ${L1ToL2Delay / 1000 / 3600} hours to check on src`)
    await new Promise(r => setTimeout(r, L1ToL2Delay + 10 * 1000));
    while (true) {
        if (await checkSyncResult(count)) {
            break;
        }
        await new Promise(r => setTimeout(r, 3 * 1000));
    }
}

async function updateHashToArbitrumFromL1(count) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    logSyncCount(`updateHashToArbitrumFromL1`)
    const newBytes = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [count]
    )
    const newBytesLength = hexDataLength(newBytes) + 4 // 4 bytes func identifier
    try {
        const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(srcProvider)
        const _submissionPriceWei = await l1ToL2MessageGasEstimate.estimateSubmissionFee(
            l1Provider,
            await l1Provider.getGasPrice(),
            newBytesLength
        )
        logSyncCount(`Current retryable base submission price: ${_submissionPriceWei.toString()}`)
        const submissionPriceWei = _submissionPriceWei.mul(5)
        const gasPriceBid = await srcProvider.getGasPrice()
        logSyncCount(`L2 gas price: ${gasPriceBid.toString()}`)
        const ABI = ['function updateChainHashFromL1(uint256 count,bytes32 chainHash)']
        const iface = new ethers.utils.Interface(ABI)
        const calldata = iface.encodeFunctionData('updateChainHashFromL1', [ethers.constants.One, ethers.constants.HashZero])
        logSyncCount(`calldata=${calldata}`)
        const maxGas = await l1ToL2MessageGasEstimate.estimateRetryableTicketGasLimit(
            l1Address,
            srcAddress,
            0,
            srcSigner.address,
            srcSigner.address,
            calldata,
            ethers.utils.parseEther('1'),
            submissionPriceWei,
            100000,
            gasPriceBid
        )
        logSyncCount(`submissionPriceWei=${submissionPriceWei};maxGas=${maxGas}`)
        const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas))
        logSyncCount(`Sending hash to L2 with ${callValue.toString()} callValue for L2 fees:`)
        const setTx = await l1Contract.setChainHashInL2(
            count,
            submissionPriceWei,
            maxGas,
            gasPriceBid,
            { value: callValue, }
        )
        const setRec = await setTx.wait()
        logSyncCount(`Set hash txn confirmed on L1! ${setRec.transactionHash}`)
        const l1TxReceipt = new L1TransactionReceipt(setRec);
        const message = (await l1TxReceipt.getL1ToL2Messages(srcSigner))[0]
        logSyncCount("start waiting for status")
        const result = await message.waitForStatus()
        logSyncCount("result", result);
        if (result.status === L1ToL2MessageStatus.REDEEMED) {
            logSyncCount(`L2 retryable txn executed ${message.l2TxHash}`)
            return true;
        }
        if (result.status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
            logSyncCount("redeem");
            const response = await message.redeem()
            const receipt = await response.wait()
            if (receipt.status == 1) {
                logSyncCount("redeem successfully");
                return true;
            }
        }
        logSyncCount(`L2 retryable txn FAILED with status ${result.status}`)
    } catch (e) {
        err("sync", "count=", count, "updateHashToArbitrumFromL1", e)
    }
    return false;
}

async function checkSyncResult(count, chainHead) {
    const logSyncCount = (...msg) => logSync(`count=${count}`, ...msg);
    try {
        logSyncCount(`checkSyncResult on src`);
        const onion = await srcContract.knownHashOnions(count);
        if (onion != ethers.constants.HashZero) {
            logSyncCount("synced onion on src", onion)
            pendingL1Msgs.delete(count);
            if (chainHead && onion == chainHead) {
                logSync(`Sync hashOnion successfully from dest to src`);
            }
            return true;
        }
        logSyncCount(`onion NOT on src`);
        return false;
    } catch (e) {
        err("sync", `count=${count} checkSyncResult failed: `, e)
    }
}

async function approve() {
    const tokensToApprove = DIRECTION == "O2A" ?
        deployment[L1_CHAIN_ID].tokens.map(t => t.Arbitrum)
        : deployment[L1_CHAIN_ID].tokens.map(t => t.Optimism);
    logMain("Checking token allowance...", tokensToApprove, dstSigner.address, dstAddress)
    for (let t of tokensToApprove) {
        const erc20Token = new ethers.Contract(t, [
            "function allowance(address, address) public view returns (uint256)",
            "function approve(address,uint256) public",
        ], dstSigner);
        const allowed = await erc20Token.allowance(dstSigner.address, dstAddress);
        if (allowed.isZero()) {
            await erc20Token.approve(dstAddress, ethers.constants.MaxUint256);
            logSync("approved token", t)
        }
    }
}

function exitHandler() {
    logMain("Exiting...");
    saveStatus(processedBlockSrc, processedBlockDst, pendingL1Msgs, claimedDeposits);
    process.exit();
}

async function knownHashOnionsL1(count) {
    try {
        const known = await l1Contract.knownHashOnions(count);
        if (known != ethers.constants.HashZero) {
            return true;
        }
        logSync(`count=${count} onion NOT on L1`);
    } catch (e) {
        err("sync", "query known hash onion on L1 failed. ", e.reason);
        // return await knownHashOnionsL1(count);
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
        logSyncCount("already withdrawn");
        return;
    }
    if (await checkSyncResult(count)) {
        logSyncCount("already synced to src");
        return;
    }
    if (await knownHashOnionsL1(count)) {
        logSyncCount("already synced to L1");
        await postL1Synced(count);
        return;
    }
    if (pendingL1Msgs.get(count)) {
        logSyncCount("already submit to L1, pending for finalize.");
        await triggerL1Msg(count);
        return;
    }
    const [gap, transferCount] = await Promise.all([dstContract.GAP(), dstContract.transferCount()]);
    logSyncCount("transferCount", String(transferCount));
    if (count != transferCount && count % gap != 0) {
        logSyncCount("skip sync: hash will not be found on dst");
        return;
    }
    const txHash = await syncHashOnion(count);
    logSyncCount("sync hash onion from dst chain. txHash=", txHash);
    if (txHash) {
        pendingL1Msgs.set(count, { tx: txHash, time: Date.now() });
        await triggerL1Msg(count);
    }
}

async function main() {
    logMain(`Staring LP services for L2Bridge 
                ${DIRECTION === 'O2A' ? '(Optimism => Arbitrum)' : '(Arbitrum => Optimism)'},
                L1 chainId = ${L1_CHAIN_ID}`)
    // only first time
    await approve();

    //so the program will not close instantly
    process.stdin.resume();
    //do something when app is closing
    // process.on('exit', () => exitHandler());
    //catches ctrl+c event
    process.on('SIGINT', () => exitHandler());
    //catches uncaught exceptions
    process.on('uncaughtException', e => {
        err("main", e);
        exitHandler();
    });

    let syncFlag = false;
    let withdrawFlag = false;
    ({ processedBlockSrc, processedBlockDst, pendingL1Msgs, claimedDeposits } = loadStatus());
    console.log("claimedDeposits", claimedDeposits)
    let startBlock;
    if (process.argv.length > 2) {
        const args = process.argv.slice(2);
        if (args[0] === "withdraw") {
            // startBlock = processedBlockDst ? processedBlockDst : genesisBlockSrc;
            logMain("Start withdrawing funds from source contract according to local claim record: ", claimedDeposits);
            await withdrawRecursive(0);
            logMain("Done withdraw.");
            process.exit(0);
        }
        if (args[0] === "sync") {
            logMain("Start syncing hash onion from dst to src via L1")
            let count = -1;
            if (args.length > 1) {
                count = parseInt(args[1]);
                logSync("with user specified count", count);
            } else {
                const transCount = await dstContract.transferCount();
                count = transCount.toNumber();
                logSync("with latest claimed count from dst", count);
            }
            await syncCount(count);
            logMain("Done sync.");
            process.exit(0);
        }
        if (args.includes("-sync")) {
            syncFlag = true;
        }
        if (args.includes("-withdraw")) {
            withdrawFlag = true;
        }
    }
    if (withdrawFlag) {
        withdrawRecursive(withdrawInterval);
    }
    if (syncFlag) {
        // triger the pending msgs before sync new ones
        logMain("Finalizing the pending cross layer messages if any...");
        if (pendingL1Msgs.size > 0) {
            // TODO: process only the latest count?
            // const count = Math.max(...pendingL1Msgs.keys());
            for (let count of pendingL1Msgs.keys()) {
                logSync("sync pending count=", count);
                if (await withdrawn(count)) {
                    logSync("already withdrawn: count=", count);
                } else if (await checkSyncResult(count)) {
                    logSync("already synced to src: count=", count);
                } else {
                    //delay with a timeout to avoid nonce conflicts: setTimeout()
                    triggerL1Msg(count);
                    await new Promise(r => setTimeout(r, 60 * 1000));
                }
            }
        }
    }
    startBlock = processedBlockSrc ? processedBlockSrc : genesisBlockSrc;
    logMain("Staring claim service from block", startBlock, syncFlag ? "with" : "without", "sync");
    traceDeposit(startBlock, syncFlag);
}

async function retrieveRewardData(fromBlock, toBlock, total) {
    let rewardData = [];
    try {
        if (!toBlock) {
            toBlock = await srcProvider.getBlockNumber();
        }
        const res = await dstContract.queryFilter(dstContract.filters.Claim(null, dstSigner.address), fromBlock, toBlock);
        logWithdraw(`from ${fromBlock} to ${toBlock} has ${res.length} Claim`);
        let i = 1;
        for (r of res) {
            const transferDataHash = r.args[0];
            const status = await srcContract.transferStatus(transferDataHash);
            if (status.toNumber() === 1) {
                logWithdraw(`add rewardData of status ${status.toNumber()}`);
                rewardData.push(r.args);
            } else {
                logWithdraw(`skip rewardData of status ${status.toNumber()}`)
                rewardData = [];
            }
            logWithdraw(i++, r.blockNumber, r.args.map(i => String(i)));
            if (i > total) {
                break;
            }
        }
    } catch (e) {
        err("withdraw", "query Claim failed:", e);
    }
    // processedBlockDst = toBlock;
    return rewardData;
}

async function retreiveWithdraw() {
    const data = await retrieveRewardData(genesisBlockDst, genesisBlockDst + 5000, 1)
    await doWithdraw(data);
}
// knownHashOnionsL1(1).catch((error) => {
// checkSyncResult(8).catch((error) => {
// retreiveWithdraw().catch((error) => {
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

