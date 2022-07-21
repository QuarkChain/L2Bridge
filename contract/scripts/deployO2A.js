const { providers, Wallet } = require('ethers')
const hre = require('hardhat')
const ethers = require('ethers')

const fs = require("fs");
require("dotenv").config();

const { OP_RPC, AB_RPC, L1_RPC, MESSENGER, INBOX, PRIVATE_KEY } = process.env;

const l1Provider = new providers.JsonRpcProvider(L1_RPC)
const opProvider = new providers.JsonRpcProvider(OP_RPC)
const abProvider = new providers.JsonRpcProvider(AB_RPC)

const l1Wallet = new Wallet(PRIVATE_KEY, l1Provider)
const opWallet = new Wallet(PRIVATE_KEY, opProvider)
const abWallet = new Wallet(PRIVATE_KEY, abProvider)

console.log("deployer", l1Wallet.address)

const main = async () => {
    const L1Bridge = (await hre.ethers.getContractFactory('L1BridgeO2A')).connect(l1Wallet)
    console.log('Deploying L1 L1Bridge')
    const bridgeArgs = [MESSENGER, INBOX]
    const l1Bridge = await L1Bridge.deploy(...bridgeArgs)
    await l1Bridge.deployed()
    console.log(`deployed to ${l1Bridge.address}`)
    const SrcBridge = (await hre.ethers.getContractFactory('OptimismBridgeSource')).connect(opWallet)
    console.log('Deploying source bridge on Optimism')
    const bridgeSrcArgs = [l1Bridge.address]
    const srcBridge = await SrcBridge.deploy(...bridgeSrcArgs)
    await srcBridge.deployed()
    console.log(`deployed to ${srcBridge.address}`)
    const genesisSrc = await opProvider.getBlockNumber()
    const DstBridge = (await hre.ethers.getContractFactory('ArbitrumBridgeDestination')).connect(abWallet)
    console.log('Deploying destination bridge on Arbitrum')
    const bridgeDestArgs = [l1Bridge.address, 100]
    const dstBridge = await DstBridge.deploy(...bridgeDestArgs)
    await dstBridge.deployed()
    console.log(`deployed to ${dstBridge.address}`)

    console.log('Updating L2 bridge addresses to L1Bridge')
    const updateL2SourceTx = await l1Bridge.updateL2Source(srcBridge.address);
    await updateL2SourceTx.wait();
    const updateL2TargetTx = await l1Bridge.updateL2Target(dstBridge.address);
    const receipt = await updateL2TargetTx.wait();
    console.log(`updated. src=${srcBridge.address}, dst=${dstBridge.address}`);

    const { chainId } = await l1Provider.getNetwork()
    let cfg = {}
    if (fs.existsSync("deployments.json")) {
        try {
            cfg = require("../deployments.json");
        } catch (e) {
            console.log(e)
        }
    }
    cfg[chainId] = {
        ...cfg[chainId],
        "O2A": {
            genesisSrc,
            bridge: l1Bridge.address,
            bridgeArgs: bridgeArgs,
            bridgeSrc: srcBridge.address,
            bridgeSrcArgs: bridgeSrcArgs,
            bridgeDest: dstBridge.address,
            bridgeDestArgs: bridgeDestArgs,
        }
    };

    console.log("cfg", JSON.stringify(cfg, null, 2))
    fs.writeFileSync("deployments.json", JSON.stringify(cfg, null, 1));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
