const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying L2 Bridge on", network.name);

  const cfg = require("../deployments.json");
  const chainMap = {
    "69": "42",
    "421611": "4",
    "31337": "31337"
  }
  const l1Bridge = cfg[chainMap[network.chainId]].bridge;

  const BridgeSource = await ethers.getContractFactory("OptimismBridgeSource");
  bridgeSrcArgs = [l1Bridge];
  const bridgeSrc = await BridgeSource.deploy(...bridgeSrcArgs);
  const bridgeSrcAddress = await bridgeSrc.address;
  console.log("OptimismBridgeSource deployed to:", bridgeSrcAddress);

  const BridgeDestination = await ethers.getContractFactory(
    "OptimismBridgeDestination"
  );
  const bridgeDestArgs = [l1Bridge, 100];
  const bridgeDest = await BridgeDestination.deploy(...bridgeDestArgs);
  const bridgeDestAddress = await bridgeDest.address;
  console.log("OptimismBridgeDestination deployed to:", bridgeDestAddress);

  // Dump to file
  cfg[network.chainId] = {
    ...cfg[network.chainId],
    bridgeSrc: bridgeSrcAddress,
    bridgeSrcArgs: bridgeSrcArgs,
    bridgeDest: bridgeDestAddress,
    bridgeDestArgs: bridgeDestArgs,
  };

  fs.writeFile("deployments.json", JSON.stringify(cfg, null, 2), (err) => {
    if (err) {
      console.log(err);
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
