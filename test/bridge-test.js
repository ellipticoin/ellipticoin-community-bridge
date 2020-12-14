const {expect} = require("chai");
const {expectEvent} = require("@openzeppelin/test-helpers");
const {getBalance, signRelease} = require("./helpers");
const {solidityKeccak256, hexlify, arrayify} = ethers.utils;

describe("Bridge", function () {
  let mockERC20;
  let bridge;
  let alice;
  let bob;
  let carol;
  let WELC;

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    WELCFactory = await ethers.getContractFactory("WELC");
    mockERC20 = await MockERC20Factory.deploy();
    mockWETH = await MockWETHFactory.deploy();
    bridge = await BridgeFactory.deploy([await alice.getAddress(), await bob.getAddress()], mockWETH.address);
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
      expect(await bridge.getSigners()).to.deep.eq([
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
      expect(await bridgeFromBob.getSigners()).to.deep.eq([
        await alice.getAddress(),
        await bob.getAddress(),
      ]);
    });
  });

  describe("#mintWETH", function () {
    it("deposits ETH into WETH and emits an event and call transfer on the token contract", async function () {
      let balance = await ethers.provider.getBalance(await alice.getAddress());
      await expect(bridge.mintWETH(Buffer.alloc(32), {value: 50}))
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

    it("burns the tokens if they are wELC tokens", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      let bobsSignature = await signRelease(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        bob
      );
      await bridge.release(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        [alicesSignature, bobsSignature]
      );

      expect(await WELC.balanceOf(await alice.getAddress())).to.eq(amount)
      expect(await WELC.totalSupply()).to.eq(amount)
      await WELC.approve(bridge.address, amount)
      await expect(bridge.mint(WELC.address, Buffer.alloc(32), amount))
        .to.emit(bridge, "Mint")
        .withArgs(
          WELC.address,
          ethers.utils.hexlify(Buffer.alloc(32)),
          amount
        );
      expect(await WELC.balanceOf(await alice.getAddress())).to.eq(0)
      expect(await WELC.totalSupply()).to.eq(0)
    });
  });

  describe("#releaseWETH", function () {
    it("emits an event and transfers ETH", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        mockWETH.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      let bobsSignature = await signRelease(
        mockWETH.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        bob
      );
      await bridge.mintWETH(Buffer.alloc(32), {value: 50});
      await bridge.releaseWETH(
        await alice.getAddress(),
        50,
        foreignTransactionId,
        [alicesSignature, bobsSignature]
      );

      const lastWithdrawal = await mockWETH.getLastWithdrawal();
      expect(lastWithdrawal[0]).to.eq(bridge.address);
      expect(lastWithdrawal[1]).to.eq(50);
    });
  });

  describe("#release", function () {
    it("emits an event and calls transfer on the token", async function () {
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
      let bobsSignature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        bob
      );
      await bridge.release(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        [alicesSignature, bobsSignature]
      );
      const lastTransfer = await mockERC20.getLastTransfer();
      expect(lastTransfer[0]).to.eq(await alice.getAddress());
      expect(lastTransfer[1]).to.eq(50);
    });

    it("mints wELC if the token is wELC", async function () {
      const amount = 50;
      const foreignTransactionId = 0;
      let alicesSignature = await signRelease(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        alice
      );
      let bobsSignature = await signRelease(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        bob
      );
      await bridge.release(
        WELC.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        [alicesSignature, bobsSignature]
      );

      expect(await WELC.balanceOf(await alice.getAddress())).to.eq(amount)
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
      let bobsSignature = await signRelease(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        bridge.address,
        bob
      );
      await bridge.release(
        mockERC20.address,
        await alice.getAddress(),
        amount,
        foreignTransactionId,
        [alicesSignature, bobsSignature]
      );
      await expect(
        bridge.release(
          mockERC20.address,
          await alice.getAddress(),
          amount,
          foreignTransactionId,
          [alicesSignature, bobsSignature]
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
        bridge.release(
          mockERC20.address,
          await alice.getAddress(),
          amount,
          foreignTransactionId,
          [alicesSignature, bobsSignature]
        )
      ).to.be.revertedWith("revert invalid signature");
    });
  });
});
