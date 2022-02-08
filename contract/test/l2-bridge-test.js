const { web3 } = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("L2Bridge", function () {
  let acc0, acc1, acc2, bridgeSrc, bridgeDst, tokenSrc, tokenDst, xferData;

  beforeEach(async function () {
    [acc0, acc1, acc2] = await ethers.getSigners();
    const BridgeSource = await ethers.getContractFactory("TestL2BridgeSource");
    bridgeSrc = await BridgeSource.deploy();
    const BridgeDestination = await ethers.getContractFactory(
      "TestL2BridgeDestination"
    );
    bridgeDst = await BridgeDestination.deploy(1);
    const Token = await ethers.getContractFactory("TestERC20");
    tokenSrc = await Token.deploy();
    tokenDst = await Token.deploy();
    await tokenSrc.mint(acc0.address, 10000);
    await tokenSrc.approve(bridgeSrc.address, 10000);
    await tokenDst.mint(acc2.address, 1000);
    await tokenDst.connect(acc2).approve(bridgeDst.address, 1000);
    xferData = {
      srcTokenAddress: tokenSrc.address,
      dstTokenAddress: tokenDst.address,
      destination: acc1.address,
      amount: 1000,
      fee: 0,
      startTime: 0,
      feeRampup: 0,
      expiration: 100000000000, // not expire
    };
  });

  it("simple l2bridge deposit/expire test", async function () {
    xferData.expiration = 0;
    await bridgeSrc.deposit(xferData);
    await bridgeSrc.refund(xferData);
    expect(await tokenSrc.balanceOf(acc1.address)).to.equal(1000);

    xferData.expiration = 100000000000;
    await bridgeSrc.deposit(xferData);
    await expect(bridgeSrc.refund(xferData)).to.be.revertedWith("not expire");
    expect(await tokenSrc.balanceOf(acc0.address)).to.equal(8000);
  });

  it("l2bridge deposit/claim test", async function () {
    await bridgeSrc.deposit(xferData);
    let key = await bridgeSrc.getReceiptHash(xferData);
    await expect(bridgeDst.connect(acc2).claim(xferData))
      .to.emit(bridgeDst, "Claim")
      .withArgs(key, acc2.address, xferData.srcTokenAddress, xferData.amount);
    let res = await bridgeDst.declareNewHashChainHead(1);
    expect(res[0]).to.equal(1);
    await bridgeSrc.updateChainHashFromL1(res[0], res[1]);
    expect(await bridgeSrc.knownHashOnions(res[0])).to.equal(res[1]);

    let rewardData = [];
    rewardData.push({
      transferDataHash: key,
      claimer: acc2.address,
      srcTokenAddress: tokenSrc.address,
      amount: xferData.amount,
    });

    await bridgeSrc.connect(acc2).processClaims(rewardData, [0]);

    expect(await tokenDst.balanceOf(acc1.address)).to.equal(1000);
    expect(await tokenSrc.balanceOf(acc2.address)).to.equal(1000);
  });
});
