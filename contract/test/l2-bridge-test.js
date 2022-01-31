const { web3 } = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("L2Bridge", function () {
  let acc0, acc1, acc2, bridgeSrc, bridgeDst, tokenSrc, tokenDst;

  beforeEach(async function () {
    [acc0, acc1, acc2] = await ethers.getSigners();
    const BridgeSource = await ethers.getContractFactory("TestL2BridgeSource");
    bridgeSrc = await BridgeSource.deploy();
    const BridgeDestination = await ethers.getContractFactory("L2BridgeDestination");
    bridgeDst = await BridgeDestination.deploy();
    const Token = await ethers.getContractFactory("TestERC20");
    tokenSrc = await Token.deploy();
    tokenDst = await Token.deploy();
  });

  it("simple l2bridge deposit/claim test", async function () {
    await tokenSrc.mint(acc0.address, 10000);
    await tokenSrc.approve(bridgeSrc.address, 10000);

    let xferData = {
      srcTokenAddress: tokenSrc.address,
      dstTokenAddress: tokenDst.address,
      destination: acc1.address,
      amount: 1000,
      fee: 0,
      startTime: 0,
      feeRampup: 0,
      expiration: 100000000000, // not expire
    };

    await bridgeSrc.deposit(xferData);

    let rewardData = [];
    await tokenDst.mint(acc2.address, 1000);
    await tokenDst.connect(acc2).approve(bridgeDst.address, 1000);
    await bridgeDst.connect(acc2).claim(xferData);

    rewardData.push({
      transferDataHash: bridgeSrc.getReceiptHash(xferData),
      claimer: acc2.address,
      srcTokenAddress: tokenSrc.address,
      amount: 1000
    });

    await bridgeSrc
      .connect(acc2)
      .processClaims(rewardData, [0]);

    expect(await tokenDst.balanceOf(acc1.address)).to.equal(1000);
    expect(await tokenSrc.balanceOf(acc2.address)).to.equal(1000);
  });

  it("simple l2bridge deposit/expire test", async function () {
    await tokenSrc.mint(acc0.address, 10000);
    await tokenSrc.approve(bridgeSrc.address, 10000);

    let xferData = {
      srcTokenAddress: tokenSrc.address,
      dstTokenAddress: tokenDst.address,
      destination: acc1.address,
      amount: 1000,
      fee: 0,
      startTime: 0,
      feeRampup: 0,
      expiration: 0, // any time expire
    };

    await bridgeSrc.deposit(xferData);

    await bridgeSrc.refund(xferData);

    expect(await tokenSrc.balanceOf(acc1.address)).to.equal(1000);
  });
});