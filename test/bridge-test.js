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
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    WELCFactory = await ethers.getContractFactory("WELC");
    mockERC20 = await MockERC20Factory.deploy();
    mockWETH = await MockWETHFactory.deploy();
    bridge = await BridgeFactory.deploy(
      [await alice.getAddress(), await bob.getAddress()],
      mockWETH.address
    );
    WELC = WELCFactory.attach(await bridge._WELC());
    await mockERC20.deployed();
    await mockWETH.deployed();
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
    it.only("emits an event and calls transfer on the token", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        mockERC20.address,
        amount,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      const lastTransfer = await mockERC20.getLastTransfer();
      expect(lastTransfer[0]).to.eq(await alice.getAddress());
      expect(lastTransfer[1]).to.eq(50);
    });

    it("mints wELC if the token is wELC", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        ELC_ADDRESS,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        ELC_ADDRESS,
        amount,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );

      expect(await WELC.balanceOf(await alice.getAddress())).to.eq(amount);
    });

    it("throws an error if you submit the same foreignTransactionId twice", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        mockERC20.address,
        amount,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      await expect(
        bridge.redeem(
          mockERC20.address,
          amount,
          foreignTransactionId,
          alicesSignature,
          signers.indexOf(alice)
        )
      ).to.be.revertedWith("revert invalid foreignTransactionId");
    });

    it("throws an error if you submit an invalid signature", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature =
        "0x4a416fa14fffeead0d2cca4b883b37f430f9fb3ffa14b43a2ebfd2cbdcfd6936001d9d6248f7fea3ac1f4a4483431515e2a8d85617617d4ea55ccbcfb7411ebe1b";
      let bobsSignature = await signRelease(
        mockERC20.address,
        await bob.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await expect(
        bridge.redeem(
          mockERC20.address,
          amount,
          foreignTransactionId,
          alicesSignature,
          signers.indexOf(alice)
        )
      ).to.be.revertedWith("revert invalid signature");
    });
  });

  describe("#undoTransactions", function () {
    it("emits an event and call transfer on the token contract", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      await bridge.redeem(
        mockERC20.address,
        amount,
        foreignTransactionId,
        alicesSignature,
        signers.indexOf(alice)
      );
      await bridge.redeemedTransactions(0);
      await bridge.undoTransactions([0]);
      expect(await bridge.redeemedTransactions(0)).to.be.false;
    });
  });
});
