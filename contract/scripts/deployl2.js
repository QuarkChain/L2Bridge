const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying L2 Bridge on", network.name);

  const cfg = require("../deployments.json");
  const l1Bridge = cfg[network.chainId].bridge;

  const BridgeSource = await ethers.getContractFactory("OptimismBridgeSource");
  const bridgeSrc = await BridgeSource.deploy(l1Bridge);
  const bridgeSrcAddress = await bridgeSrc.address;
  console.log("OptimismBridgeSource deployed to:", bridgeSrcAddress);

  const BridgeDestination = await ethers.getContractFactory(
    "OptimismBridgeDestination"
  );
  const HistoryGap = 100;
  const bridgeDest = await BridgeDestination.deploy(l1Bridge, HistoryGap);
  const bridgeDestAddress = await bridgeDest.address;
  console.log("OptimismBridgeDestination deployed to:", bridgeDestAddress);

  // Dump to file
  cfg[network.chainId] = {
    ...cfg[network.chainId],
    bridgeSrc: bridgeSrcAddress,
    bridgeDest: bridgeDestAddress,
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
