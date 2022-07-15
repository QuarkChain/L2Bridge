const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("network", network.chainId)
  const cfg = require("../deployments.json");
  const chainMap = {
    42: "69",
    4: "421611",
    31337: "31337",
  };
  const l1Bridge = cfg[network.chainId].bridge;
  const srcBridge = cfg[chainMap[network.chainId]].bridgeSrc;
  const tgtBridge = cfg[chainMap[network.chainId]].bridgeDest;

  const Bridge = await ethers.getContractFactory(
    "OptimismL1Bridge"
  );
  const bridgeL1 = await Bridge.attach(l1Bridge);
  let tx = await bridgeL1.updateL2Source(srcBridge);
  await tx.wait();
  tx = await bridgeL1.updateL2Target(tgtBridge);
  await tx.wait();
  console.log(`updated. src=${srcBridge}, tgt=${tgtBridge}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
