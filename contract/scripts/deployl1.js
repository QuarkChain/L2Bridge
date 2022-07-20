const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying L1 Bridge on", network.name);
  const signer = await provider.getSigner();
  const addr = await signer.getAddress();

  let bridgeContract = "OptimismL1Bridge";
  let messenger = "0x4361d0F75A0186C05f971c566dC6bEa5957483fD"
  if (network.chainId == 5) {
    // should be Nitro for now
    bridgeContract = "ArbitrumL1Bridge";
    messenger = "0x1fdbbcc914e84af593884bf8e8dd6877c29035a2"
  } else if (network.chainId == 4) {
    // should be Arbi testnet
    bridgeContract = "ArbitrumL1Bridge";
    messenger = "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e"
  }

  const Bridge = await ethers.getContractFactory(bridgeContract);
  const bridgeArgs = [addr, addr, messenger];
  const bridge = await Bridge.deploy(...bridgeArgs);
  const bridgeAddress = await bridge.address;
  console.log("l1 Bridge deployed to:", bridgeAddress);

  // Dump to file
  const cfg = require("../deployments.json") || {};

  cfg[network.chainId] = {
    bridge: bridgeAddress,
    bridgeArgs: bridgeArgs,
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
