const { ethers } = require('hardhat')
const { providers, Wallet } = ethers;
require("dotenv").config();

const { RPC_OP, RPC_AB, PRIVATE_KEY } = process.env;

const opProvider = new providers.JsonRpcProvider(RPC_OP)
const abProvider = new providers.JsonRpcProvider(RPC_AB)

const opWallet = new Wallet(PRIVATE_KEY, opProvider)
const abWallet = new Wallet(PRIVATE_KEY, abProvider)
const amount = ethers.utils.parseEther("100000000")
async function main() {
  const Token = await ethers.getContractFactory("TestERC20");
  const opToken = await Token.connect(opWallet).deploy();
  await opToken.deployed();
  console.log("TEST on OP:", opToken.address);
  const opTx = await opToken.mint(opWallet.address, amount);
  await opTx.wait();
  const abToken = await Token.connect(abWallet).deploy();
  await abToken.deployed();
  console.log("TEST on AB:", abToken.address);
  const abTx = await abToken.mint(abWallet.address, amount);
  await abTx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
