const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying L1 Bridge on", network.name);
  const signer = await provider.getSigner();
  const addr = await signer.getAddress();

  const Bridge = await ethers.getContractFactory("OptimismL1Bridge");
  console.log("deployer:", addr);
  const bridge = await Bridge.deploy(
    addr,
    addr,
    "0x4361d0F75A0186C05f971c566dC6bEa5957483fD"
  );
  const bridgeAddress = await bridge.address;
  console.log("l1 Bridge deployed to:", bridgeAddress);

  // Dump to file
  const cfg = require("../deployments.json") || {};

  cfg[network.chainId] = {
    bridge: bridgeAddress,
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
