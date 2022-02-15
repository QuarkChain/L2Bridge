const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("Deploying Test Tokens on", network.name);

  const cfg = require("../deployments.json");

  const Token = await ethers.getContractFactory("TestERC20WithName");
  const tokenSrcArgs = ["Source"];
  const tokenSrc = await Token.deploy(...tokenSrcArgs);
  const tokenSrcAddress = await tokenSrc.address;
  console.log("TokenSource deployed to:", tokenSrcAddress);
  const tokenDestArgs = ["Destination"];
  const tokenDest = await Token.deploy(...tokenDestArgs);
  const tokenDestAddress = await tokenDest.address;
  console.log("TokenDestination deployed to:", tokenDestAddress);

  // Dump to file
  cfg[network.chainId] = {
    ...cfg[network.chainId],
    tokenSrc: tokenSrcAddress,
    tokenSrcArgs: tokenSrcArgs,
    tokenDest: tokenDestAddress,
    tokenDestArgs: tokenDestArgs,
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
