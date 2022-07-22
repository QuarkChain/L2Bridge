const { ethers } = require("ethers");
const fs = require("fs");
const { L2TransactionReceipt, L2ToL1MessageStatus } = require('@arbitrum/sdk');
require("dotenv").config();
const deployment = require("../../contract/deployments.json");
const pendingMsgFile = __dirname + "/storage.json";
const claimedDepositsFile = __dirname + "/claims.json";

const { PRIVATE_KEY, L1_RPC, OP_RPC, AB_RPC, L1_CHAIN_ID, DIRECTION, MIN_FEE, GAS_PRICE, CLAIM_INTERVAL_SECONDS, WITHDRAW_INTERVAL_SECONDS } = process.env;

const claimInterval = CLAIM_INTERVAL_SECONDS * 1000;
const withdrawInterval = WITHDRAW_INTERVAL_SECONDS * 1000;
const L2ToL1Delay = L1_CHAIN_ID == 1 ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
const L1ToL2Delay = L1_CHAIN_ID == 1 ? 15 * 60 * 1000 : 5 * 60 * 1000;

const GENESIS_BLOCK = deployment[L1_CHAIN_ID][DIRECTION].genesisSrc;
const srcAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeSrc;
const dstAddress = deployment[L1_CHAIN_ID][DIRECTION].bridgeDest;
const l1Address = deployment[L1_CHAIN_ID][DIRECTION].bridge;

const srcProvider = new ethers.providers.JsonRpcProvider(OP_RPC);
const dstProvider = new ethers.providers.JsonRpcProvider(AB_RPC);
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
], srcProvider);
const dstContract = new ethers.Contract(dstAddress, [
    "event Claim(bytes32 indexed transferDataHash,address indexed claimer,address indexed srcTokenAddress,uint256 amount)",
    "event L2ToL1TxCreated(uint256, bytes32)",
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function getLPFee((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHead(uint256 count,uint256 maxSubmissionCost,uint256 maxGas,uint256 gasPriceBid) public",
], dstProvider).connect(dstSigner);
const l1Contract = new ethers.Contract(l1Address, [
    "function setChainHashInL2Test(uint256 count,bytes32 chainHash,uint32 maxGas) public",
    "function knownHashOnions(uint256) public view returns (bytes32)",],
    l1Provider).connect(l1Signer);

//pending msg to trigger on L1
let storage = new Map(); //count => {txHash, timestamp}
//claimed deposits need to withdraw on src
let claimedDeposits = new Map(); //transferHash => count
let processedBlockDst;
let processedBlockSrc;

const logMain = (...msg) => log("main", ...msg);
const logClaim = (...msg) => log("claim", ...msg);
const logSync = (...msg) => log("sync", ...msg);
const logWithdraw = (...msg) => log("withdraw", ...msg);

async function traceDeposit(fromBlock, sync) {
    let toBlock;
    try {
        let transferData = [];
        toBlock = await srcProvider.getBlockNumber();
        if (toBlock > fromBlock) {
            const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
            logClaim(`from ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
            transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        } else {
            logClaim("waiting for new blocks")
        }
        for (let i = 0; i < transferData.length; i++) {
            logClaim("found transferData from user", transferData[i][2]);
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
            if (await take(transferData[i])) {
                const transCount = await dstContract.transferCount();
                const count = transCount.toNumber();
                claimedDeposits.set(count, [transferDataHash, srcSigner.address, transferData[i][0], String(transferData[i][4])]);
                if (sync) {
                    const txHash = await syncHashOnion(count);
                    if (txHash) {
                        storage.set(count, { tx: txHash, time: Date.now() });
                        triggerL1Msg(count);
                    }
                }
            }
        }
        processedBlockSrc = toBlock;
    } catch (e) {
        console.error(e.reason ? e.reason : e);
    }
    setTimeout(() => traceDeposit(toBlock, sync), claimInterval);
}

async function withdraw(interval) {
    if (claimedDeposits.size === 0) {
        log("withdraw", "no claim records to withdraw.");
        return;
    }
    const count = Math.max(...claimedDeposits.keys());
    if (await withdrawn(count)) {
        log("withdraw", "already withdrawn. count=", count);
        return;
    }
    if (await checkSyncResult(count)) {
        const rewardData = claimedDeposits.values();
        if (await doWithdraw(rewardData)) {
            claimedDeposits.clear();
        };
    } else {
        log("withdraw", `not withdraw: the latest reward data (count ${count}) is not synced to src.`)
    }
    if (interval > 0) {
        setTimeout(() => withdraw(interval), interval);
    }
}

async function doWithdraw(rewardData) {
    try {
        const gas = await srcContract.connect(srcSigner).estimateGas.processClaims(rewardData, [0]);
        logWithdraw("withdraw gas", gas.toString())
        let tx;
        if (GAS_PRICE > 0) {
            const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
            tx = await srcContract.connect(srcSigner).processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3), gasPrice });
        } else {
            tx = await srcContract.connect(srcSigner).processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3) });
        }
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            logWithdraw("withdraw reward success!", tx.hash);
            return true;
        }
    } catch (e) {
        err("withdraw", "withdraw failed:", e.reason ? e.reason : e);
    }
    return false;
}

async function take(transferData) {
    const data = transferData.map(t => String(t));
    logClaim("starting claim order", data);
    let tx;
    try {
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
        err("claim", "claim failed:", data, e.reason ? e.reason : e);
    }
    return false;
}

async function syncHashOnion(count) {
    logSync("syncHashOnion for count", String(count));
    try {
        const maxSubmissionCost = ethers.utils.parseEther("0.001");
        const maxGas = 1000000;
        const gasPriceBid = ethers.utils.parseUnits("10", "gwei");
        let tx;
        if (GAS_PRICE > 0) {
            const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
            tx = await dstContract.declareNewHashChainHead(count, maxSubmissionCost, maxGas, gasPriceBid, { gasPrice });
        } else {
            tx = await dstContract.declareNewHashChainHead(count, maxSubmissionCost, maxGas, gasPriceBid);
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
        logSync(`processedCount from src is ${processed}`);
        return processed.gte(count);
    } catch (e) {
        err("sync", "query known hash onion on L1 failed. ", e.reason);
    }
    return false;
}

async function triggerL1Msg(count) {
    try {
        const item = storage.get(count);
        if (!item) {
            err("sync", "unknown pending msg:", count);
            return;
        }
        const txHash = item.tx;
        const receipt = await dstProvider.getTransactionReceipt(txHash)
        const l2Receipt = new L2TransactionReceipt(receipt);
        const messages = await l2Receipt.getL2ToL1Messages(l1Signer, dstProvider);
        const l2ToL1Msg = messages[0];
        if ((await l2ToL1Msg.status(dstProvider)) == L2ToL1MessageStatus.EXECUTED) {
            console.log(`Message already executed! Nothing else to do here`);
            storage.delete(count);
            return;
        }
        const delay = item.time + L2ToL1Delay + 3 * 1000 - Date.now();
        if (delay > 0) {
            logSync(`waiting for ${delay / 1000 / 3600} hours to finalize msg ${txHash} on L1.`);
        } else {
            logSync(`finalizing msg ${txHash} on L1.`);
        }
        await l2ToL1Msg.waitUntilReadyToExecute(dstProvider, delay)
        logSync("starting finalize count", count);

        const proofInfo = await l2ToL1Msg.getOutboxProof(dstProvider);
        const gas = await l2ToL1Msg.estimateGas.execute(proofInfo);
        const price = await l1Provider.getGasPrice();
        const cost = gas.mul(price);
        logSync(`triggerL1Msg estimate gas &{gas} will cost ${ethers.utils.formatEther(cost)} ether`);
        let tx;
        if (GAS_PRICE > 0) {
            const gasPrice = ethers.utils.parseUnits(GAS_PRICE, "gwei");
            tx = await l2ToL1Msg.execute(proofInfo, { gasPrice });
        } else {
            tx = await l2ToL1Msg.execute(proofInfo);
        }
        logSync("l2ToL1Msg.execute result tx:", tx.hash)
        const rec = await tx.wait();
        if (rec.status == 1) {
            logSync("l2ToL1Msg.execute success! count=", count);
            if (await knownHashOnionsL1(count)) {
                logSync("synced to L1 successfully!");
                logSync(`waiting for ${L1ToL2Delay / 1000 / 3600} hours to check on src`)
                await new Promise(r => setTimeout(r, L1ToL2Delay + 10 * 1000));
                if (await checkSyncResult(count)) {
                    storage.delete(count);
                }
            } else {
                //should not happen
                err("sync", `finalize to L1 failed. count=${count}, finalize tx=${tx.hash}`);
            }
        }
    } catch (e) {
        err("sync", "triggerL1Msg failed. count=", count, e.reason ? e.reason : e);
        if (e.reason == "timemout") {
            await triggerL1Msg(count);
        }
    }
}

async function checkSyncResult(count, chainHead) {
    try {
        logSync(`checkSyncResult on src: count=${count}`);
        const onion = await srcContract.knownHashOnions(count);
        if (onion != ethers.constants.HashZero) {
            logSync("synced onion on src", onion)
            if (chainHead && onion == chainHead) {
                logSync(`Sync hashOnion successfully from dest to src: count=${count}`);
            }
            return true;
        }
        logSync(`onion not on src: count=${count}`);
        return false;
    } catch (e) {
        err("sync", "checkSyncResult failed:", e)
    }
}

async function approve() {
    logMain("Checking token allowance...")
    const abTokens = deployment[L1_CHAIN_ID].tokens.map(t => t.Arbitrum);
    for (let t of abTokens) {
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

function replacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else {
        return value;
    }
}

function reviver(key, value) {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
        }
    }
    return value;
}

function exitHandler() {
    logMain("Exiting...")
    storage.set("processedBlockDst", processedBlockDst);
    storage.set("processedBlockSrc", processedBlockSrc);
    logMain("storage", storage)
    fs.writeFileSync(__dirname + "/storage.json", JSON.stringify(storage, replacer, 2), e => {
        if (e) {
            err("main", e);
        }
    });
    logMain("claimedDeposits", claimedDeposits)
    fs.writeFileSync(__dirname + "/claims.json", JSON.stringify(claimedDeposits, replacer, 2), e => {
        if (e) {
            err("main", e);
        }
    });
    process.exit();
}

function log(module, ...msg) {
    console.log(new Date().toLocaleString(), `[${module}]`, ...msg);
}

function err(module, ...msg) {
    console.error(new Date().toLocaleString(), `[${module}]`, ...msg);
}

async function knownHashOnionsL1(count) {
    try {
        const known = await l1Contract.knownHashOnions(count);
        log("sync", `L1 knowHashOnion of ${count} is ${known}`);
        if (known != ethers.constants.HashZero) {
            return true;
        }
    } catch (e) {
        err("sync", "query known hash onion on L1 failed. ", e.reason);
        return await knownHashOnionsL1(count);
    }
    return false;
}


async function syncNow() {
    const transCount = await dstContract.transferCount();
    const count = transCount.toNumber();
    logSync("Latest transferCount from dst", count);
    if (count == 0) {
        logSync("nothing to sync.");
        return;
    }

    if (await withdrawn(count)) {
        logSync("already withdrawn: count=", count);
        return;
    }
    if (await checkSyncResult(count)) {
        logSync("already synced to src: count=", count);
        return;
    }
    if (storage.get(count)) {
        logSync("already submit to L1, pending for finalize. count=", count);
        await triggerL1Msg(count);
    } else {
        const txHash = await syncHashOnion(count);
        logSync("sync hash onion from dst chain. txHash=", txHash);
        if (txHash) {
            storage.set(count, { tx: txHash, time: Date.now() });
            await triggerL1Msg(count);
        }
    }
}

async function main() {
    logMain(`Staring LP services for bridge from Optimism to Arbitrum, L1 chainId = ${L1_CHAIN_ID}`)
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
    if (fs.existsSync(claimedDepositsFile)) {
        const claims = require(claimedDepositsFile);
        claimedDeposits = JSON.parse(JSON.stringify(claims, replacer), reviver);
        logMain("claimedDeposits", claimedDeposits);
    }
    if (fs.existsSync(pendingMsgFile)) {
        const tasks = require(pendingMsgFile);
        storage = JSON.parse(JSON.stringify(tasks, replacer), reviver);
        logMain("Storage", storage)
        processedBlockDst = storage.get("processedBlockDst");
        processedBlockSrc = storage.get("processedBlockSrc");
        storage.delete("processedBlockDst");
        storage.delete("processedBlockSrc");
    }
    let startBlock;
    if (process.argv.length > 2) {
        const args = process.argv.slice(2);
        if (args[0] === "withdraw") {
            // startBlock = processedBlockDst ? processedBlockDst : GENESIS_BLOCK;
            logMain("Start withdrawing funds from source contract according to local claim record: ", claimedDeposits);
            await withdraw(0);
            logMain("Done withdraw.");
            process.exit(0);
        }
        if (args[0] === "sync") {
            logMain("Start syncing hash onion from dst to src via L1")
            await syncNow();
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
        withdraw(withdrawInterval);
    }
    if (syncFlag) {
        // triger the pending msgs before sync new ones
        logMain("Finalizing the pending cross layer messages if any...");
        // process only the latest count
        if (storage.size > 0) {
            const count = Math.max(...storage.keys());
            if (await withdrawn(count)) {
                logSync("already withdrawn: count=", count);
                storage.clear();
            } else if (await checkSyncResult(count)) {
                logSync("already synced to src: count=", count);
                storage.clear();
            } else {
                for (let k of storage.keys()) {
                    if (k != count) {
                        storage.delete(k);
                    }
                }
                triggerL1Msg(count);
            }
        }
    }
    startBlock = processedBlockSrc ? processedBlockSrc : GENESIS_BLOCK;
    logMain("Staring claim service from block", startBlock, syncFlag ? "with" : "without", "sync");
    traceDeposit(startBlock, syncFlag);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

