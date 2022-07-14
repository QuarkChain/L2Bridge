const { ethers } = require("hardhat");
const hardhat = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying L2 Bridge on", network.name, network);

  const cfg = require("../deployments.json");
  const chainMap = {
    69: ["42", "kovan"], // op => kovan
    421611: ["4", "rinkeby"], // arbi testnet => rinkeby
    421612: ["5", "goerli"], // arbi nitro => goerli
    31337: ["31337", ""],
  };
  const l1Bridge = cfg[chainMap[network.chainId][0]].bridge;

  let bridgeSourceContract = "OptimismBridgeSource";
  let bridgeDestContract = "OptimismBridgeDestination";

  if (network.chainId == 421611 || network.chainId == 421612) {
    bridgeSourceContract = "ArbitrumBridgeSource";
    bridgeDestContract = "ArbitrumBridgeDestination";
  }

  const BridgeSource = await ethers.getContractFactory(bridgeSourceContract);
  bridgeSrcArgs = [l1Bridge];
  const bridgeSrc = await BridgeSource.deploy(...bridgeSrcArgs);
  const bridgeSrcAddress = await bridgeSrc.address;
  console.log("BridgeSource deployed to:", bridgeSrcAddress);

  const BridgeDestination = await ethers.getContractFactory(bridgeDestContract);
  const bridgeDestArgs = [l1Bridge, 100];
  const bridgeDest = await BridgeDestination.deploy(...bridgeDestArgs);
  const bridgeDestAddress = await bridgeDest.address;
  console.log("BridgeDestination deployed to:", bridgeDestAddress);

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

  console.log("deployment file updated");

  let l1RPC = hardhat.config.networks[chainMap[network.chainId][1]].url;

  let l1Provider = new ethers.providers.JsonRpcProvider(l1RPC);
  let privateKey = hardhat.config.networks[chainMap[network.chainId][1]].accounts[0];
  let l1Wallet = new ethers.Wallet(privateKey, l1Provider)

  const l1Abi = [
    "function updateL2Target(address)",
    "function updateL2Source(address)",
  ];
  const l1BridgeContract = new ethers.Contract(l1Bridge, l1Abi, l1Wallet);
  await l1BridgeContract.updateL2Target(bridgeDestAddress);
  await l1BridgeContract.updateL2Source(bridgeSrcAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
