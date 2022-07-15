const { ethers } = require("ethers");
const fs = require("fs");
const sdk = require("@eth-optimism/sdk");
require("dotenv").config();
const deployment = require("../../contract/deployments.json");

const { INFURA_PROJECT_ID, PRIVATE_KEY, NODE_ENV } = process.env;

const GENESIS_BLOCK = NODE_ENV === "prod" ? 0 : 4785086; // Transaction Index on Optimism L2
const L2ToL1Delay = NODE_ENV === "prod" ? 7 * 24 * 60 * 60 * 1000 : 60 * 1000;
const L1ToL2Delay = NODE_ENV === "prod" ? 15 * 60 * 1000 : 5 * 60 * 1000;

const srcRPC = NODE_ENV === "prod" ? `` : `https://kovan.optimism.io`;
const dstRPC = NODE_ENV === "prod" ? `` : `https://kovan.optimism.io`;
const l1RPC = NODE_ENV === "prod" ? `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}` : `https://kovan.poa.network`;

const srcAddress = NODE_ENV === "prod" ? "" : deployment['69'].bridgeSrc;
const dstAddress = NODE_ENV === "prod" ? "" : deployment['69'].bridgeDest;
const l1Address = NODE_ENV === "prod" ? "" : deployment['42'].bridge;

const tokens = NODE_ENV === "prod" ? [] : [deployment['69'].tokenSrc, deployment['69'].tokenDest];

const srcProvider = new ethers.providers.JsonRpcProvider(srcRPC);
const dstProvider = new ethers.providers.JsonRpcProvider(dstRPC);
const l1Provider = new ethers.providers.StaticJsonRpcProvider(l1RPC);

const srcSigner = new ethers.Wallet(PRIVATE_KEY, srcProvider);
const dstSigner = new ethers.Wallet(PRIVATE_KEY, dstProvider);
const l1Signer = new ethers.Wallet(PRIVATE_KEY, l1Provider);

const srcContract = new ethers.Contract(srcAddress, [
    "event Deposit(address,address,address,address,uint256,uint256,uint256,uint256,uint256)",
    "function transferStatus(bytes32) public view returns (uint256)",
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function processClaims((bytes32 transferDataHash,address claimer,address srcTokenAddress,uint256 amount)[] memory rewardDataList,uint256[] memory skipFlags) public",
], srcProvider);
const dstContract = new ethers.Contract(dstAddress, [
    "event Claim(bytes32,address,address,uint256)",
    "event L2ToL1TxCreated(uint256, bytes32)",
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHead(uint256 count, uint32 maxGas) public",
], dstProvider).connect(dstSigner);
const l1Contract = new ethers.Contract(l1Address, ["function setChainHashInL2Test(uint256 count,bytes32 chainHash,uint32 maxGas) public"],
    l1Provider).connect(l1Signer);

const dstL1Messenger = new sdk.CrossChainMessenger({
    l1ChainId: NODE_ENV === 'prod' ? 1 : 42,
    l2ChainId: NODE_ENV === 'prod' ? 10 : 69,
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: dstSigner
});

let pendingDstL1Msgs = new Map();

async function traceDeposit(fromBlock, sync) {
    let toBlock = fromBlock;
    try {
        const curBlock = await srcProvider.getBlockNumber();
        toBlock = curBlock - 3; //in case of blocks roll back
        const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
        console.log(`from ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
        const transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        for (let i = 0; i < transferData.length; i++) {
            console.log("transferData", transferData[i].map(d => String(d)));
            const transferDataHash = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode([
                    "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256)"],
                    [transferData[i]]));
            if (await dstContract.claimedTransferHashes(transferDataHash)) {
                console.log("the claim is already bought");
                continue;
            }
            if (await take(transferData[i]) && sync) {
                const transCount = await dstContract.transferCount();
                const txHash = await syncHashOnion(transCount);
                pendingDstL1Msgs.set(txHash, { count: transCount.toNumber(), time: Date.now() });
                triggerL1Msg(txHash, transCount);
            }
        }
    } catch (e) {
        console.error(e.reason ? e.reason : e);
    }
    setTimeout(() => traceDeposit(toBlock, sync), 30 * 1000);
}

async function traceClaim(fromBlock) {
    let rewardData = [];
    let toBlock = fromBlock;
    try {
        const curBlock = await srcProvider.getBlockNumber();
        toBlock = curBlock - 3; //in case of blocks roll back
        const res = await dstContract.queryFilter(dstContract.filters.Claim(), fromBlock, toBlock);
        console.log(`from ${fromBlock} to ${toBlock} has ${res.length} Claim`);
        for (r of res) {
            const transferDataHash = r.args[0];
            const status = await srcContract.transferStatus(transferDataHash);
            console.log(`transferDataHash=${transferDataHash}, status=${status.toNumber()}`);
            if (status.toNumber() === 1) {
                rewardData.push(r.args);
            } else {
                rewardData = [];
            }
            console.log(r.blockNumber, r.args.map(i => String(i)));
        }
    } catch (e) {
        console.log("query Claim failed:", e)
    }
    if (rewardData.length > 0) {
        // console.log("start withdraw", rewardData.map(r => r.map(d => String(d))))
        try {
            const gas = await srcContract.connect(srcSigner).estimateGas.processClaims(rewardData, [0]);
            console.log("withdraw gas", gas.toString())
            const tx = await srcContract.connect(srcSigner).processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3) });
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                console.log("withdraw reward success!", tx.hash);
            }
        } catch (e) {
            console.error("withdraw failed:", e.reason ? e.reason : e);
        }
    }
    // setTimeout(() => traceClaim(toBlock), 100 * 1000);
}

async function take(transferData) {
    let tx;
    try {
        tx = await dstContract.claim(transferData);
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            console.log("claim success");
            return true;
        }
    } catch (e) {
        console.error("claim failed:", transferData, e.reason ? e.reason : e);
    }
    console.log("claim failed: ", tx?.hash);
    return false;
}

async function syncHashOnion(count) {
    if (await checkSyncResult(count)) {
        console.log("already synced to src: count=", count);
        return;
    }
    console.log("syncHashOnion for count", count.toString());
    try {
        const tx = await dstContract.declareNewHashChainHead(count, 1000000, { gasLimit: 1000000 });
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            const chainHead = `0x${receipt.events[1].data.slice(-64)}`;
            console.log("chainHead", chainHead);
            return tx.hash;
        }
    } catch (e) {
        console.error("declareNewHashChainHead failed:", e);
    }
}

async function triggerL1Msg(txHash) {
    try {
        let l2TxTime = Date.now();
        let count = 0;
        const item = pendingDstL1Msgs.get(txHash);
        if (item.time) {
            l2TxTime = item.time;
            count = item.count;
        }
        const delay = l2TxTime + L2ToL1Delay + 3 * 1000 - Date.now();
        console.log(`wait for ${delay / 1000 / 3600} hours to finalize on l1`)
        await new Promise(r => setTimeout(r, delay));
        while (true) {
            const state = await dstL1Messenger.getMessageStatus(txHash);
            if (state === sdk.MessageStatus.READY_FOR_RELAY) {
                console.log("state", state)
                break;
            }
            await new Promise(r => setTimeout(r, 3 * 1000));
        }
        console.log("start finalize");
        const tx = await dstL1Messenger.finalizeMessage(txHash);
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            console.log("finalizeMessage success!");
            if (count > 0) {
                console.log(`waiting for ${L1ToL2Delay / 1000 / 3600} hours to check on src`)
                await new Promise(r => setTimeout(r, L1ToL2Delay + 10 * 1000));
                if (await checkSyncResult(count)) {
                    pendingDstL1Msgs.delete(txHash);
                }
            }
        }
    } catch (e) {
        console.error("CrossChainMessenger failed:", e);
    }
}

async function checkSyncResult(count, chainHead) {
    try {
        console.log(`checkSyncResult on src: count=${count}`);
        const onion = await srcContract.knownHashOnions(count);
        console.log("synced onion on src", onion)
        if (onion != ethers.constants.HashZero) {
            if (chainHead && onion == chainHead) {
                console.log(`Sync hashOnion successfully from dest to src: count=${count}`);
            }
            return true;
        }
        console.log(`onion not on src: count=${count}`);
        return false;
    } catch (e) {
        console.error("checkSyncResult failed:", e)
    }
}

async function approve() {
    for (let t of tokens) {
        const erc20Token = new ethers.Contract(t, [
            "function allowance(address, address) public view returns (uint256)",
            "function approve(address,uint256) public",
        ], dstSigner);
        const allowed = await erc20Token.allowance(dstSigner.address, dstAddress);
        if (allowed.isZero()) {
            await erc20Token.approve(dstAddress, ethers.constants.MaxUint256);
            console.log("approved", t)
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
    console.log("pendingDstL1Msgs", pendingDstL1Msgs)
    fs.writeFileSync(__dirname + "/pending.json", JSON.stringify(pendingDstL1Msgs, replacer, 2), err => {
        if (err) {
            console.log(err);
        }
    });
    process.exit();
}

async function main() {
    // only first time
    // await approve();

    //so the program will not close instantly
    process.stdin.resume();
    //do something when app is closing
    // process.on('exit', () => exitHandler());
    //catches ctrl+c event
    process.on('SIGINT', () => exitHandler());
    //catches uncaught exceptions
    process.on('uncaughtException', () => exitHandler());

    let sync = false;
    let withdraw = false;
    let startBlock = GENESIS_BLOCK;
    if (process.argv.length > 2) {
        const args = process.argv.slice(2);
        if (args[0] === "withdraw") {
            withdraw = true;
            if (args.length > 1) {
                startBlock = args[1];
            }
        }
        if (args[0] === "-sync") {
            sync = true;
        }
        if (args[0] === "sync") {
            console.log("sync hash onion now.");
            const file = __dirname + "/pending.json";
            if (fs.existsSync(file)) {
                const tasks = require(file);
                console.log("tasks", tasks)
                pendingDstL1Msgs = JSON.parse(JSON.stringify(tasks, replacer), reviver);
            }
            // pendingDstL1Msgs.set("0x5823364006ef04b7cb6bed135e70987ecfa68ee9f9c515ebe666a5684cf6457f", { time: Date.now() - 1000 * 60, count: 1 });
            for (let txHash of pendingDstL1Msgs.keys()) {
                await triggerL1Msg(txHash);
            };
            const transCount = await dstContract.transferCount();
            console.log("transferCount", String(transCount))
            const txHash = await syncHashOnion(transCount);
            pendingDstL1Msgs.set(txHash, { time: Date.now(), count: transCount.toNumber() });
            await triggerL1Msg(txHash, transCount);
            return;
        }
    }
    if (withdraw) {
        await traceClaim(startBlock); //specify block number (Transaction Index) manually
    } else {
        const curBlock = await srcProvider.getBlockNumber();
        console.log("Current block number", curBlock)
        traceDeposit(curBlock - 5000, sync);
    }
}

async function knownHashOnionsL1(count) {
    const known = await srcContract.knownHashOnions(count);
    console.log(`L1 knowHashOnion of ${count} is ${known}`);
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
