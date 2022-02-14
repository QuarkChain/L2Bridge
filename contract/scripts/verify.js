const { ethers } = require("hardhat");
const config = require("../deployments.json");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const chainId = network.chainId;

  if (config[chainId].bridge) {
    //verify L1Bridge
    await hre.run("verify:verify", {
      address: config[chainId].bridge,
      constructorArguments: config[chainId].bridgeArgs,
    });
  } else {
    // verify l2Bridge
    await hre.run("verify:verify", {
      address: config[chainId].bridgeSrc,
      constructorArguments: config[chainId].bridgeSrcArgs,
    });
    await hre.run("verify:verify", {
      address: config[chainId].bridgeDest,
      constructorArguments: config[chainId].bridgeDestArgs,
    });
    await hre.run("verify:verify", {
      address: config[chainId].tokenSrc,
      constructorArguments: config[chainId].tokenSrcArgs,
      contract: "contracts/TestERC20.sol:TestERC20WithName",
    });
    await hre.run("verify:verify", {
      address: config[chainId].tokenDest,
      constructorArguments: config[chainId].tokenDestArgs,
      contract: "contracts/TestERC20.sol:TestERC20WithName",
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
