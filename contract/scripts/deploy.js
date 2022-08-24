const { ethers } = require('hardhat')
const { providers, Wallet } = ethers;
const fs = require("fs");
require("dotenv").config();

const { RPC_OP, RPC_AB, RPC_L1, MESSENGER, INBOX, PRIVATE_KEY } = process.env;

const l1Provider = new providers.JsonRpcProvider(RPC_L1)
const opProvider = new providers.JsonRpcProvider(RPC_OP)
const abProvider = new providers.JsonRpcProvider(RPC_AB)

const l1Wallet = new Wallet(PRIVATE_KEY, l1Provider)
const opWallet = new Wallet(PRIVATE_KEY, opProvider)
const abWallet = new Wallet(PRIVATE_KEY, abProvider)

const deploy = async (direction) => {
    let srcWallet, dstWallet, L1Contract, SrcContract, DstContract
    if (direction === "O2A") {
        srcWallet = opWallet
        dstWallet = abWallet
        L1Contract = 'L1BridgeArbitrumOptimism' //L1 Bridge's direction is from DstContract to SrcContract
        SrcContract = 'OptimismBridgeSource'
        DstContract = 'ArbitrumBridgeDestination'
    } else {
        srcWallet = abWallet
        dstWallet = opWallet
        L1Contract = 'L1BridgeOptimismArbitrum'
        SrcContract = 'ArbitrumBridgeSource'
        DstContract = 'OptimismBridgeDestination'
    }
    const { chainId } = await l1Provider.getNetwork()
    console.log(`Deploying L2Bridge contracts. direction=${direction}, L1 chainId=${chainId}, deployer=${l1Wallet.address}`)
    const L1Bridge = (await ethers.getContractFactory(L1Contract)).connect(l1Wallet)
    console.log(`Deploying ${L1Contract}`)
    const bridgeArgs = [MESSENGER, INBOX]
    const l1Bridge = await L1Bridge.deploy(...bridgeArgs)
    await l1Bridge.deployed()
    console.log(`deployed to ${l1Bridge.address}`)
    const SrcBridge = (await ethers.getContractFactory(SrcContract)).connect(srcWallet)
    console.log(`Deploying ${SrcContract}`)
    const bridgeSrcArgs = [l1Bridge.address]
    const srcBridge = await SrcBridge.deploy(...bridgeSrcArgs)
    await srcBridge.deployed()
    console.log(`deployed to ${srcBridge.address}`)
    const genesisSrc = await srcWallet.provider.getBlockNumber()
    const DstBridge = (await ethers.getContractFactory(DstContract)).connect(dstWallet)
    console.log(`Deploying ${DstContract}`)
    const bridgeDestArgs = [l1Bridge.address, 100]
    const dstBridge = await DstBridge.deploy(...bridgeDestArgs)
    await dstBridge.deployed()
    console.log(`deployed to ${dstBridge.address}`)
    const genesisDst = await dstWallet.provider.getBlockNumber()

    console.log('Updating L2 bridge addresses to L1Bridge')
    //L1 Bridge's direction is from DstContract to SrcContract
    const updateL2SourceTx = await l1Bridge.updateL2MessageFrom(dstBridge.address);
    await updateL2SourceTx.wait();
    const updateL2TargetTx = await l1Bridge.updateL2MessageTo(srcBridge.address);
    await updateL2TargetTx.wait();
    console.log(`updated. src=${dstBridge.address}, dst=${srcBridge.address}`);

    let cfg = {}
    if (fs.existsSync("deployments.json")) {
        try {
            cfg = require("../deployments.json");
        } catch (e) {
            console.log(e)
        }
    }
    if (!cfg[chainId]) {
        cfg[chainId] = {}
    }
    cfg[chainId][direction] = {
        genesisSrc,
        genesisDst,
        bridge: l1Bridge.address,
        bridgeArgs,
        bridgeSrc: srcBridge.address,
        bridgeSrcArgs,
        bridgeDest: dstBridge.address,
        bridgeDestArgs,
    }
    console.log("cfg", JSON.stringify(cfg, null, 2))
    fs.writeFileSync("deployments.json", JSON.stringify(cfg, null, 1));
}

const main = async () => {
    if (process.argv.length === 3) {
        const args = process.argv.slice(2);
        if (args[0] === "O2A" || args[0] === "A2O") {
            await deploy(args[0]);
            process.exit(0)
        }
    }
    console.log("Valid parameter is O2A or A2O")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
