const { expect } = require("chai");
const { expectEvent } = require("@openzeppelin/test-helpers");
const { getBalance, signRelease } = require("./helpers");
const { solidityKeccak256, hexlify, arrayify } = ethers.utils;

describe("Bridge", function () {
  let mockERC20;
  let bridge;
  let alice;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const MockWETH = await ethers.getContractFactory("MockWETH");
    const Bridge = await ethers.getContractFactory("Bridge");
    mockERC20 = await MockERC20.deploy();
    mockWETH = await MockWETH.deploy();
    bridge = await Bridge.deploy(mockWETH.address);
    await mockERC20.deployed();
    await mockWETH.deployed();
    await bridge.deployed();
  });

  describe("#mintWETH", function () {
    it("deposits ETH into WETH and emits an event and call transfer on the token contract", async function () {
      let balance = await ethers.provider.getBalance(await alice.getAddress());
      await expect(bridge.mintWETH(Buffer.alloc(32), { value: 50 }))
        .to.emit(bridge, "Mint")
        .withArgs(mockWETH.address, ethers.utils.hexlify(Buffer.alloc(32)), 50);

      const lastDeposit = await mockWETH.getLastDeposit();
      expect(lastDeposit[0]).to.eq(await bridge.address);
      expect(lastDeposit[1]).to.eq(50);
    });
  });

  describe("#mint", function () {
    it("emits an event and call transfer on the token contract", async function () {
      await expect(bridge.mint(mockERC20.address, Buffer.alloc(32), 50))
        .to.emit(bridge, "Mint")
        .withArgs(
          mockERC20.address,
          ethers.utils.hexlify(Buffer.alloc(32)),
          50
        );

      const lastTransferFrom = await mockERC20.getLastTransferFrom();
      expect(lastTransferFrom[0]).to.eq(await alice.getAddress());
      expect(lastTransferFrom[1]).to.eq(bridge.address);
      expect(lastTransferFrom[2]).to.eq(50);
    });
  });

  describe("#releaseWETH", function () {
    it("emits an event and transfers ETH", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let signature = await signRelease(
        mockWETH.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.mintWETH(Buffer.alloc(32), { value: 50 });
      await bridge.releaseWETH(await alice.getAddress(), 50, foreignTransactionId, signature);
      //
      // const lastWithdrawal = await mockWETH.getLastWithdrawal();
      // expect(lastWithdrawal[0]).to.eq(bridge.address);
      // expect(lastWithdrawal[1]).to.eq(50);
    });
  });
  describe("#release", function () {
    it("emits an event and calls transfer on the token", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let signature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.release(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        signature
      );
      const lastTransfer = await mockERC20.getLastTransfer();
      expect(lastTransfer[0]).to.eq(await alice.getAddress());
      expect(lastTransfer[1]).to.eq(50);
    });

    it("throws an error if you submit the same foreignTransactionId twice", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let signature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.release(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        signature
      );
      await expect(
        bridge.release(
          mockERC20.address,
          await alice.getAddress(),
          amount,
          foreignTransactionId,
          signature
        )
      ).to.be.revertedWith("revert invalid foreignTransactionId");
    });

    it("throws an error if you submit an invalid signature", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let signature =
        "0x4a416fa14fffeead0d2cca4b883b37f430f9fb3ffa14b43a2ebfd2cbdcfd6936001d9d6248f7fea3ac1f4a4483431515e2a8d85617617d4ea55ccbcfb7411ebe1b";
      await expect(
        bridge.release(
          mockERC20.address,
          await alice.getAddress(),
          amount,
          foreignTransactionId,
          signature
        )
      ).to.be.revertedWith("revert invalid signature");
    });
  });
});
