const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const TIMEOUT_SECONDS = 2 * 60 * 60; // 2 hours, matches the V0 MVP spec

describe("NomadiaEscrow", function () {
  async function deployFixture() {
    const [owner, depositor, counterparty, stranger, arbiter] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const NomadiaEscrow = await ethers.getContractFactory("NomadiaEscrow");
    // owner (default signer) deploys → owner + can manage allowlist/arbiter.
    const escrow = await NomadiaEscrow.deploy(TIMEOUT_SECONDS, arbiter.address);

    // Allowlist the mock token so createOffer accepts it.
    await escrow.setTokenAllowed(await usdc.getAddress(), true);

    const amount = ethers.parseUnits("200", 6); // 200 mUSDC
    await usdc.transfer(depositor.address, amount * 10n);
    await usdc.connect(depositor).approve(await escrow.getAddress(), amount * 10n);

    return { escrow, usdc, owner, depositor, counterparty, stranger, arbiter, amount };
  }

  async function openOffer(ctx) {
    const { escrow, usdc, depositor, counterparty, amount } = ctx;
    await escrow.connect(depositor).createOffer(await usdc.getAddress(), amount, counterparty.address);
    return 1n;
  }

  it("locks the depositor's tokens on createOffer", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, counterparty, amount } = ctx;

    const escrowAddr = await escrow.getAddress();
    await expect(escrow.connect(depositor).createOffer(await usdc.getAddress(), amount, counterparty.address))
      .to.emit(escrow, "OfferCreated")
      .withArgs(1n, depositor.address, counterparty.address, await usdc.getAddress(), amount);

    expect(await usdc.balanceOf(escrowAddr)).to.equal(amount);

    const offer = await escrow.getOffer(1n);
    expect(offer.depositor).to.equal(depositor.address);
    expect(offer.counterparty).to.equal(counterparty.address);
    expect(offer.status).to.equal(1n); // Open
  });

  it("rejects a zero amount or a counterparty equal to self", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, counterparty, amount } = ctx;

    await expect(
      escrow.connect(depositor).createOffer(await usdc.getAddress(), 0, counterparty.address)
    ).to.be.revertedWithCustomError(escrow, "ZeroAmount");

    await expect(
      escrow.connect(depositor).createOffer(await usdc.getAddress(), amount, depositor.address)
    ).to.be.revertedWithCustomError(escrow, "InvalidCounterparty");
  });

  it("rejects a token that is not on the allowlist", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty, amount } = ctx;

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const rogue = await MockUSDC.deploy(); // a different token, never allowlisted
    await rogue.transfer(depositor.address, amount);
    await rogue.connect(depositor).approve(await escrow.getAddress(), amount);

    await expect(
      escrow.connect(depositor).createOffer(await rogue.getAddress(), amount, counterparty.address)
    ).to.be.revertedWithCustomError(escrow, "TokenNotAllowed");
  });

  it("only lets the owner manage the allowlist", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, stranger } = ctx;

    await expect(
      escrow.connect(stranger).setTokenAllowed(await usdc.getAddress(), true)
    ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
  });

  it("releases to the counterparty once both sides confirm", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, counterparty, amount } = ctx;
    await openOffer(ctx);

    await expect(escrow.connect(depositor).confirm(1n))
      .to.emit(escrow, "OfferConfirmed")
      .withArgs(1n, depositor.address);

    expect(await usdc.balanceOf(counterparty.address)).to.equal(0n);

    await expect(escrow.connect(counterparty).confirm(1n))
      .to.emit(escrow, "OfferReleased")
      .withArgs(1n, counterparty.address, amount);

    expect(await usdc.balanceOf(counterparty.address)).to.equal(amount);
    expect((await escrow.getOffer(1n)).status).to.equal(2n); // Released
  });

  it("blocks a non-participant from confirming", async function () {
    const ctx = await deployFixture();
    const { escrow, stranger } = ctx;
    await openOffer(ctx);

    await expect(escrow.connect(stranger).confirm(1n)).to.be.revertedWithCustomError(
      escrow,
      "NotParticipant"
    );
  });

  it("blocks double-confirming from the same side", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor } = ctx;
    await openOffer(ctx);
    await escrow.connect(depositor).confirm(1n);

    await expect(escrow.connect(depositor).confirm(1n)).to.be.revertedWithCustomError(
      escrow,
      "AlreadyConfirmed"
    );
  });

  it("refunds the depositor after the timeout if the counterparty never confirmed", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, stranger, amount } = ctx;
    await openOffer(ctx);

    const before = await usdc.balanceOf(depositor.address);
    await time.increase(TIMEOUT_SECONDS + 1);

    // Refund is permissionless — a stranger can trigger it too.
    await expect(escrow.connect(stranger).refund(1n))
      .to.emit(escrow, "OfferRefunded")
      .withArgs(1n, depositor.address, amount);

    expect(await usdc.balanceOf(depositor.address)).to.equal(before + amount);
    expect((await escrow.getOffer(1n)).status).to.equal(3n); // Refunded
  });

  it("rejects a refund before the timeout has elapsed", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor } = ctx;
    await openOffer(ctx);

    await expect(escrow.connect(depositor).refund(1n)).to.be.revertedWithCustomError(
      escrow,
      "TimeoutNotReached"
    );
  });

  // --- SECURITY: the half-confirm scam this redesign closes -----------------

  it("BLOCKS the depositor from refunding after the counterparty confirmed (scam fix)", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);

    // Counterparty handed over cash IRL and confirmed on-chain.
    await escrow.connect(counterparty).confirm(1n);

    // Even after the full timeout, the depositor can NOT claw back the crypto.
    await time.increase(TIMEOUT_SECONDS + 1);
    await expect(escrow.connect(depositor).refund(1n)).to.be.revertedWithCustomError(
      escrow,
      "CounterpartyAlreadyConfirmed"
    );
    // Funds still safely in escrow.
    expect((await escrow.getOffer(1n)).status).to.equal(1n); // Open
  });

  it("lets the depositor cancel before the counterparty confirms", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, amount } = ctx;
    await openOffer(ctx);

    const before = await usdc.balanceOf(depositor.address);
    await expect(escrow.connect(depositor).cancel(1n))
      .to.emit(escrow, "OfferRefunded")
      .withArgs(1n, depositor.address, amount);

    expect(await usdc.balanceOf(depositor.address)).to.equal(before + amount);
    expect((await escrow.getOffer(1n)).status).to.equal(3n); // Refunded
  });

  it("blocks cancel once the counterparty has confirmed", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);
    await escrow.connect(counterparty).confirm(1n);

    await expect(escrow.connect(depositor).cancel(1n)).to.be.revertedWithCustomError(
      escrow,
      "CounterpartyAlreadyConfirmed"
    );
  });

  it("blocks a non-depositor from cancelling", async function () {
    const ctx = await deployFixture();
    const { escrow, stranger } = ctx;
    await openOffer(ctx);

    await expect(escrow.connect(stranger).cancel(1n)).to.be.revertedWithCustomError(
      escrow,
      "NotParticipant"
    );
  });

  // --- SECURITY: dispute + arbiter resolution -------------------------------

  it("lets the arbiter resolve a stuck offer to the counterparty", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, counterparty, arbiter, amount } = ctx;
    await openOffer(ctx);

    // Counterparty paid & confirmed; depositor stonewalls. Counterparty disputes.
    await escrow.connect(counterparty).confirm(1n);
    await expect(escrow.connect(counterparty).raiseDispute(1n))
      .to.emit(escrow, "OfferDisputed")
      .withArgs(1n, counterparty.address);
    expect((await escrow.getOffer(1n)).status).to.equal(4n); // Disputed

    await expect(escrow.connect(arbiter).resolveDispute(1n, true))
      .to.emit(escrow, "OfferReleased")
      .withArgs(1n, counterparty.address, amount);

    expect(await usdc.balanceOf(counterparty.address)).to.equal(amount);
    expect((await escrow.getOffer(1n)).status).to.equal(2n); // Released
  });

  it("lets the arbiter resolve a dispute back to the depositor", async function () {
    const ctx = await deployFixture();
    const { escrow, usdc, depositor, counterparty, arbiter, amount } = ctx;
    await openOffer(ctx);

    const before = await usdc.balanceOf(depositor.address);
    await escrow.connect(counterparty).confirm(1n);
    await escrow.connect(depositor).raiseDispute(1n);

    await expect(escrow.connect(arbiter).resolveDispute(1n, false))
      .to.emit(escrow, "OfferRefunded")
      .withArgs(1n, depositor.address, amount);

    expect(await usdc.balanceOf(depositor.address)).to.equal(before + amount);
    expect((await escrow.getOffer(1n)).status).to.equal(3n); // Refunded
  });

  it("blocks a non-arbiter from resolving a dispute", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);
    await escrow.connect(counterparty).confirm(1n);
    await escrow.connect(counterparty).raiseDispute(1n);

    await expect(escrow.connect(depositor).resolveDispute(1n, false)).to.be.revertedWithCustomError(
      escrow,
      "NotArbiter"
    );
  });

  it("blocks confirm/refund/cancel on a disputed offer", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);
    await escrow.connect(counterparty).confirm(1n);
    await escrow.connect(depositor).raiseDispute(1n);

    await time.increase(TIMEOUT_SECONDS + 1);
    await expect(escrow.connect(depositor).confirm(1n)).to.be.revertedWithCustomError(escrow, "OfferNotOpen");
    await expect(escrow.connect(depositor).refund(1n)).to.be.revertedWithCustomError(escrow, "OfferNotOpen");
    await expect(escrow.connect(depositor).cancel(1n)).to.be.revertedWithCustomError(escrow, "OfferNotOpen");
  });

  it("disables disputes when no arbiter is set", async function () {
    const ctx = await deployFixture();
    const { escrow, owner, depositor, counterparty } = ctx;
    await escrow.connect(owner).setArbiter(ethers.ZeroAddress);
    await openOffer(ctx);
    await escrow.connect(counterparty).confirm(1n);

    await expect(escrow.connect(counterparty).raiseDispute(1n)).to.be.revertedWithCustomError(
      escrow,
      "DisputesDisabled"
    );
  });

  // --- state-machine guards -------------------------------------------------

  it("rejects a refund on an offer that already released", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);
    await escrow.connect(depositor).confirm(1n);
    await escrow.connect(counterparty).confirm(1n);

    await time.increase(TIMEOUT_SECONDS + 1);
    await expect(escrow.connect(depositor).refund(1n)).to.be.revertedWithCustomError(escrow, "OfferNotOpen");
  });

  it("rejects confirming an offer that was already refunded", async function () {
    const ctx = await deployFixture();
    const { escrow, depositor, counterparty } = ctx;
    await openOffer(ctx);

    await time.increase(TIMEOUT_SECONDS + 1);
    await escrow.connect(depositor).refund(1n);

    await expect(escrow.connect(counterparty).confirm(1n)).to.be.revertedWithCustomError(
      escrow,
      "OfferNotOpen"
    );
  });
});
