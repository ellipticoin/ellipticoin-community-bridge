const {expect} = require("chai");
const {expectEvent} = require("@openzeppelin/test-helpers");
const {getBalance, signRelease} = require("./helpers");
const {solidityKeccak256, hexlify, arrayify} = ethers.utils;
const ELC_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("Bridge", function () {
  let mockERC20;
  let bridge;
  let signers;
  let alice;
  let bob;
  let carol;
  let WELC;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    [alice, bob, carol] = signers;
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    WELCFactory = await ethers.getContractFactory("WELC");
    mockERC20 = await MockERC20Factory.deploy();
    bridge = await BridgeFactory.deploy([
      await alice.getAddress(),
      await bob.getAddress(),
    ], await alice.getAddress());
    WELC = WELCFactory.attach(await bridge._WELC());
    await mockERC20.deployed();
    await bridge.deployed();
  });

  describe("#setSigners", function () {
    it("sets signers", async function () {
      await bridge.setSigners([
        await alice.getAddress(),
        await bob.getAddress(),
      ]);
      expect([await bridge.signers(0), await bridge.signers(1)]).to.deep.eq([
        await alice.getAddress(),
        await bob.getAddress(),
      ]);
    });

    it("fails if not the owner", async function () {
      let bridgeFromBob = await bridge.connect(bob);

      await expect(
        bridgeFromBob.setSigners([
          await alice.getAddress(),
          await bob.getAddress(),
          await carol.getAddress(),
        ])
      ).to.be.revertedWith("Ownable: caller is not the owner");
      expect([
        await bridgeFromBob.signers(0),
        await bridgeFromBob.signers(1),
      ]).to.deep.eq([await alice.getAddress(), await bob.getAddress()]);
    });
  });

  describe("#redeem", function () {
    it("calls transfer on the token", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        await alice.getAddress(),
        amount,
        mockERC20.address,
        blockNumber + 1,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        amount,
        mockERC20.address,
        blockNumber + 1,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      const lastTransfer = await mockERC20.getLastTransfer();
      expect(lastTransfer[0]).to.eq(await alice.getAddress());
      expect(lastTransfer[1]).to.eq(50);
    });

    it("mints wELC if the token is wELC", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        await alice.getAddress(),
        amount,
        ELC_ADDRESS,
        blockNumber + 1,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        amount,
        ELC_ADDRESS,
        blockNumber + 1,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );

      expect(await WELC.balanceOf(await alice.getAddress())).to.eq(50000000000000);
    });

    it("throws an error if you submit the same foreignTransactionId twice", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        await alice.getAddress(),
        amount,
        mockERC20.address,
        blockNumber + 2,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        amount,
        mockERC20.address,
        blockNumber + 2,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      await expect(
        bridge.redeem(
          amount,
          mockERC20.address,
          blockNumber + 2,
          foreignTransactionId,
          alicesSignature,
          signers.indexOf(alice)
        )
      ).to.be.revertedWith("already redeemed");
    });

    it("throws an error if the request has expired", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        await alice.getAddress(),
        amount,
        mockERC20.address,
        blockNumber + 1,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await alice.provider.send("evm_mine", []);
      await expect(
        bridge.redeem(
          amount,
          mockERC20.address,
          blockNumber + 1,
          foreignTransactionId,
          alicesSignature,
          signers.indexOf(alice)
        )
      ).to.be.revertedWith("signature expired");
    });

    it("throws an error if you submit an invalid signature", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature =
        "0x4a416fa14fffeead0d2cca4b883b37f430f9fb3ffa14b43a2ebfd2cbdcfd6936001d9d6248f7fea3ac1f4a4483431515e2a8d85617617d4ea55ccbcfb7411ebe1b";
      await expect(
        bridge.redeem(
          amount,
          mockERC20.address,
          blockNumber + 1,
          foreignTransactionId,
          alicesSignature,
          signers.indexOf(alice)
        )
      ).to.be.revertedWith("invalid signature");
    });
  });

  describe("#undoTransactions", function () {
    it("undoes transactions", async function () {
      let {number: blockNumber} = await alice.provider.getBlock();
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        await alice.getAddress(),
        amount,
        mockERC20.address,
        blockNumber + 1,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        amount,
        mockERC20.address,
        blockNumber + 1,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      expect(await bridge.redeemedTransactions(0)).to.be.true;
      await bridge.undoTransactions(0);
      expect(await bridge.redeemedTransactions(0)).to.be.false;
    });
  });

  describe("#withdraw", function () {
    it("withdraws tokens", async function () {
      let amount = 50;
      await bridge.withdraw(amount, mockERC20.address);

      const lastTransfer = await mockERC20.getLastTransfer();
      expect(lastTransfer[0]).to.eq(await alice.getAddress());
      expect(lastTransfer[1]).to.eq(50);
    });

    it("fails if not the owner", async function () {
      let amount = 50;
      let bridgeFromBob = await bridge.connect(bob);

      await expect(
        bridgeFromBob.withdraw(amount, mockERC20.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("#withdrawETH", function () {
    it("withdraws ETH", async function () {
      let amount = 50;
      await alice.sendTransaction({to: bridge.address, value: amount});
      await bridge.withdrawETH(amount);
    });

    it("fails if not the owner", async function () {
      let amount = 50;
      let bridgeFromBob = await bridge.connect(bob);

      await expect(bridgeFromBob.withdrawETH(amount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
