
const { ethers } = require("ethers");
require("dotenv").config();

const { INFURA_PROJECT_ID, PRIVATE_KEY } = process.env;

// const srcProvider = new ethers.providers.WebSocketProvider(`wss://rinkeby.infura.io/ws/v3/${INFURA_PROJECT_ID}`, "rinkeby");
// const srcProvider = new ethers.providers.WebSocketProvider(`wss://optimism-kovan.infura.io/ws/v3/${INFURA_PROJECT_ID}`, "optimism-kovan");
const srcProvider = new ethers.providers.JsonRpcProvider(`https://optimism-kovan.infura.io/v3/${INFURA_PROJECT_ID}`);
const dstProvider = new ethers.providers.JsonRpcProvider(`https://optimism-kovan.infura.io/v3/${INFURA_PROJECT_ID}`);
const l1Provider = new ethers.providers.StaticJsonRpcProvider(`https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`);

const srcSigner = new ethers.Wallet(PRIVATE_KEY, srcProvider);
const dstSigner = new ethers.Wallet(PRIVATE_KEY, dstProvider);
const l1Signer = new ethers.Wallet(PRIVATE_KEY, l1Provider);

const srcAddress = "0x524867916F136b56083b7b1F071d228361A6600E";
const dstAddress = "0x0AD853E840cCa279F24c59698751aD2635E5c533";
const l1Address = "0x34Fb74842eFd8f43EaB03DE3c713868D0ba6dC0c";

const srcContract = new ethers.Contract(srcAddress, [
    "event Deposit(address,address,address,address,uint256,uint256,uint256,uint256,uint256)",
    "function knownHashOnions(uint256) public view returns (bytes32)",
    "function processClaims((bytes32 transferDataHash,address claimer,address srcTokenAddress,uint256 amount)[] memory rewardDataList,uint256[] memory skipFlags) public",
], srcProvider);
const dstContract = new ethers.Contract(dstAddress, [
    "function claimedTransferHashes(bytes32) public view returns (bool)",
    "function transferCount() public view returns (uint256)",
    "function claim((address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup, uint256 expiration) memory transferData) public",
    "function declareNewHashChainHead(uint256 count, uint32 maxGas) public",
], dstProvider).connect(dstSigner);
const l1Contract = new ethers.Contract(l1Address, ["function setChainHashInL2Test(uint256 count,bytes32 chainHash,uint32 maxGas) public"], l1Provider).connect(l1Signer);

const rewardData = [];
async function start(fromBlock) {
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
                rewardData.push([
                    transferDataHash,
                    dstSigner.address,
                    transferData[i][0],
                    transferData[i][3],
                ]);
                continue;
            }
            if (await take(transferData[i])) {
                rewardData.push([
                    transferDataHash,
                    dstSigner.address,
                    transferData[i][0],
                    transferData[i][3],
                ]);
                const transCount = await dstContract.transferCount();
                await syncHash(transCount);
            }
        }
    } catch (e) {
        console.error(e.reason ? e.reason : e);
    }
    setTimeout(() => start(toBlock), 60 * 1000);
}

async function withdraw() {
    if (rewardData.length > 0) {
        console.log("start withdraw", rewardData.map(r => r.map(d => String(d))))
        try {
            const gas = await srcContract.connect(srcSigner).estimateGas.processClaims(rewardData, [0]);
            console.log("gas", gas)
            const tx = await srcContract.connect(srcSigner).processClaims(rewardData, [0], { gasLimit: gas.mul(4).div(3) });
            const receipt = await tx.wait();
            if (receipt.status == 1) {
                console.log("withdraw reward success!", tx.hash)
                rewardData = [];
            }
        } catch (e) {
            console.error("withdraw failed:", e.reason ? e.reason : e);
        }
    } else {
        console.log("nothing to withdraw")
    }
    setTimeout(() => withdraw(), 0.004 * 3600 * 1000);
}

async function take(transferData) {
    try {
        const tx = await dstContract.claim(transferData);
        const receipt = await tx.wait();
        if (receipt.status == 1) {
            console.log("claim success");
            return true;
        }
    } catch (e) {
        console.error("claim failed:", transferData, e.reason ? e.reason : e);
        return false;
    }
}

async function syncHash(count) {
    console.log("syncHash for", count.toNumber());
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
    await new Promise(r => setTimeout(r, 60000));
    const os = await srcContract.knownHashOnions(count);
    console.log(`Sync hashOnion done: count=${count} chainHead=${chainHead}, knownHashOnion=${os}`);
}

async function syncHashHistory() {
    const transCount = await dstContract.transferCount();
    const total = transCount.toNumber();
    console.log("Total transferfrom dst contract", total);
    for (let i = 0; i < total; i++) {
        const known = await srcContract.knownHashOnions(i);
        console.log(`Src knowHashOnion of ${i} is ${known}`);
        if (known == ethers.constants.HashZero) {
            await syncHash(i);
        }
    }
}

async function main() {
    const curBlock = await srcProvider.getBlockNumber();
    console.log("Current block number", curBlock)
    const fromBlock = curBlock - 50000;
    start(fromBlock);
    withdraw();


}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
