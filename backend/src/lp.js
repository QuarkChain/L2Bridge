
const { ethers } = require("ethers");
require("dotenv").config();
const deployment = require("../../contract/deployments.json");

const { INFURA_PROJECT_ID, PRIVATE_KEY, NODE_ENV } = process.env;
console.log("NODE_ENV", NODE_ENV);

const GENESIS_BLOCK = NODE_ENV === "prod" ? 1174785 : 0; // Transaction Index on Optimism L2
const srcRPC = NODE_ENV === "prod" ? `` : `https://optimism-kovan.infura.io/v3/${INFURA_PROJECT_ID}`;
const dstRPC = NODE_ENV === "prod" ? `` : `https://optimism-kovan.infura.io/v3/${INFURA_PROJECT_ID}`;
const l1RPC = NODE_ENV === "prod" ? `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}` : `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`;

const srcAddress = NODE_ENV === "prod" ? "" : deployment['69'].bridgeSrc;
const dstAddress = NODE_ENV === "prod" ? "" : deployment['69'].bridgeDest;
const l1Address = NODE_ENV === "prod" ? "" : deployment['42'].bridge;

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
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHead(uint256 count, uint32 maxGas) public",
], dstProvider).connect(dstSigner);
const l1Contract = new ethers.Contract(l1Address, ["function setChainHashInL2Test(uint256 count,bytes32 chainHash,uint32 maxGas) public"],
    l1Provider).connect(l1Signer);

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
                syncHash(transCount);
            }
        }
    } catch (e) {
        console.error(e.reason ? e.reason : e);
    }
    setTimeout(() => traceDeposit(toBlock), 30 * 1000);
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
            console.log(transferDataHash, status.toNumber());
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
    console.log("claim failed: tx=", tx.hash);
    return false;
}

async function syncHash(count) {
    console.log("syncHash for", count.toString());
    let chainHead;
    try {
        const tx = await dstContract.declareNewHashChainHead(count, 200000, { gasLimit: 200000 });
        const receipt = await tx.wait();
        const head = `0x${receipt.events[1].data.slice(-64)}`;
        console.log("head", head);
        chainHead = head;
    } catch (e) {
        console.error("declareNewHashChainHead failed:", e);
    }
    if (!chainHead) {
        return;
    }
    try {
        const tx = await l1Contract.setChainHashInL2Test(count, chainHead, 200000);
        const receipt = await tx.wait();
        console.log("L1 to src MessageSent", receipt.status);
    } catch (e) {
        console.error("setChainHashInL2Test failed:", e);
    }
    setTimeout(() => checkSync(count, chainHead), NODE_ENV === 'prod' ? 15 * 60 * 1000 : 5 * 3600 * 1000);
}

async function checkSync(count, chainHead) {
    try {
        const onion = await srcContract.knownHashOnions(count);
        if (chainHead == onion) {
            console.log(`Sync hashOnion successfully from dest to src in 1 min: count=${count}`);
            return true;
        }
    } catch (e) {
        console.error("checkSync failed:", e)
    }
    return false;
}

async function knownHashOnions() {
    const transCount = await dstContract.transferCount();
    const total = transCount.toNumber();
    console.log("Total transferfrom dst contract", total);
    for (let i = 19; i <= total; i++) {
        const known = await srcContract.knownHashOnions(i);
        console.log(`Src knowHashOnion of ${i} is ${known}`);
    }
}

async function status(fromBlock) {
    let toBlock = fromBlock;
    try {
        const curBlock = await srcProvider.getBlockNumber();
        toBlock = curBlock - 3; //in case of blocks roll back
        const res = await srcContract.queryFilter(srcContract.filters.Deposit(), fromBlock, toBlock);
        console.log(`from ${fromBlock} to ${toBlock} has ${res.length} Deposits`);
        const transferData = res.map(r => r.args).map(a => [...a.slice(0, 2), ...a.slice(3)]);
        for (let i = 0; i < transferData.length; i++) {
            const transferDataHash = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode([
                    "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256)"],
                    [transferData[i]]));
            const status = await srcContract.transferStatus(transferDataHash);
            console.log(transferDataHash, status.toNumber());
        }
    } catch (e) {
        console.error(e.reason ? e.reason : e);
    }
}

async function main() {
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
            const transCount = await dstContract.transferCount();
            console.log("transferCount", String(transCount))
            await syncHash(transCount);
            return;
        }
    }
    if (withdraw) {
        await traceClaim(startBlock); //specify block number (Transaction Index) manually
    } else {
        const curBlock = await srcProvider.getBlockNumber();
        console.log("Current block number", curBlock)
        traceDeposit(curBlock - 50, sync);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
