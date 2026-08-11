// End-to-end functional test against the LIVE Base Sepolia deployment.
// Exercises the full end-user escrow journey with two real wallets:
//   1. Happy path      — both confirm → funds release to the counterparty
//   2. Scam-fix         — after counterparty confirms, depositor refund/cancel is BLOCKED
//   3. Cancel (no-show) — depositor pulls out before counterparty confirms
//   4. Dispute          — counterparty confirmed, arbiter resolves to counterparty
// Public testnet RPCs lag on read-after-write, so state reads poll until settled.
// Run: npx hardhat run scripts/e2e-live.js --network baseSepolia
const hre = require("hardhat");
const { ethers } = hre;

const ESCROW = "0xc3E1b11416cFf3a5572Aa5Dd8305A4Ff1eaC5026";
const TOKEN = "0x46d28aAbf374CE2f9ecD13E3e2D518905EF27A9f";
const AMOUNT = 10n * 10n ** 6n; // 10 mUSDC (6 decimals)
const STATUS = { 0: "None", 1: "Open", 2: "Released", 3: "Refunded", 4: "Disputed" };

let pass = 0;
let fail = 0;
function check(name, cond) {
  console.log(`  ${cond ? "✅" : "❌"} ${name}`);
  cond ? pass++ : fail++;
}

// Poll getOffer until predicate holds (beats public-RPC read-after-write lag).
// Each getOffer round-trips over the network, so this self-paces without sleeping.
async function offerWhen(escrow, id, predicate, tries = 40) {
  let o = await escrow.getOffer(id);
  for (let i = 0; i < tries && !predicate(o); i++) {
    o = await escrow.getOffer(id);
  }
  return o;
}
async function balanceAtLeast(token, addr, target, tries = 40) {
  let b = await token.balanceOf(addr);
  for (let i = 0; i < tries && b < target; i++) {
    b = await token.balanceOf(addr);
  }
  return b;
}

// Assert a state-changing call is REJECTED (reverts). Pass = it reverted (blocked).
// The exact custom-error name is logged when the RPC surfaces it, but public
// testnet RPCs often return a bare "execution reverted"; the precise error names
// are already asserted in the 20/20 hardhat unit tests, so a revert here is proof
// the action was blocked on-chain.
async function expectRejected(name, contract, method, args, expected) {
  try {
    await contract[method].staticCall(...args);
    check(`${name} — BEKLENMEDİK: geçti (bloklanmadı!)`, false);
  } catch (e) {
    const decoded = (e.message || "").includes(expected) ? ` (${expected})` : "";
    check(`${name} — reddedildi${decoded}`, true);
  }
}

async function newOffer(escrow, token, depositor, counterpartyAddr) {
  await (await token.connect(depositor).approve(ESCROW, AMOUNT)).wait();
  const receipt = await (await escrow.connect(depositor).createOffer(TOKEN, AMOUNT, counterpartyAddr)).wait();
  const ev = receipt.logs
    .map((l) => {
      try {
        return escrow.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === "OfferCreated");
  return ev.args.offerId;
}

async function main() {
  const [depositor] = await ethers.getSigners(); // burner = depositor + arbiter + owner
  const cp = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log("Depositor (A):", depositor.address);
  console.log("Counterparty (B):", cp.address);

  const escrow = await ethers.getContractAt("NomadiaEscrow", ESCROW);
  const token = await ethers.getContractAt("MockUSDC", TOKEN);

  await (await depositor.sendTransaction({ to: cp.address, value: ethers.parseEther("0.01") })).wait();
  if ((await token.balanceOf(depositor.address)) < AMOUNT * 10n) {
    await (await token.mint(depositor.address, AMOUNT * 100n)).wait();
  }

  // --- 1. Happy path -------------------------------------------------------
  console.log("\n[1] Happy path — her iki taraf onaylar, release B'ye");
  {
    const bBefore = await token.balanceOf(cp.address);
    const id = await newOffer(escrow, token, depositor, cp.address);
    await (await escrow.connect(cp).confirm(id)).wait();
    await (await escrow.connect(depositor).confirm(id)).wait();
    const o = await offerWhen(escrow, id, (x) => x.status === 2n);
    check(`status Released (${STATUS[Number(o.status)]})`, o.status === 2n);
    check("B mUSDC +10 aldı", (await balanceAtLeast(token, cp.address, bBefore + AMOUNT)) - bBefore === AMOUNT);
  }

  // --- 2. Scam-fix ---------------------------------------------------------
  console.log("\n[2] Scam-fix — B onayladıktan sonra A refund/cancel ÇEKEMEZ");
  {
    const id = await newOffer(escrow, token, depositor, cp.address);
    await (await escrow.connect(cp).confirm(id)).wait();
    await offerWhen(escrow, id, (x) => x.counterpartyConfirmed === true);
    await expectRejected("refund bloklandı", escrow.connect(depositor), "refund", [id], "CounterpartyAlreadyConfirmed");
    await expectRejected("cancel bloklandı", escrow.connect(depositor), "cancel", [id], "CounterpartyAlreadyConfirmed");
    const o = await escrow.getOffer(id);
    check(`fonlar hâlâ escrow'da (${STATUS[Number(o.status)]})`, o.status === 1n);
    // cleanup so funds don't sit locked
    await (await escrow.connect(cp).raiseDispute(id)).wait();
    await (await escrow.connect(depositor).resolveDispute(id, true)).wait();
  }

  // --- 3. Cancel (no-show) -------------------------------------------------
  console.log("\n[3] Cancel — B onaylamadan A geri çeker");
  {
    const id = await newOffer(escrow, token, depositor, cp.address);
    await (await escrow.connect(depositor).cancel(id)).wait();
    const o = await offerWhen(escrow, id, (x) => x.status === 3n);
    check(`status Refunded (${STATUS[Number(o.status)]})`, o.status === 3n);
  }

  // --- 4. Dispute resolution ----------------------------------------------
  console.log("\n[4] Dispute — B onayladı, A stonewall, arbiter B'ye çözer");
  {
    const bBefore = await token.balanceOf(cp.address);
    const id = await newOffer(escrow, token, depositor, cp.address);
    await (await escrow.connect(cp).confirm(id)).wait();
    await (await escrow.connect(cp).raiseDispute(id)).wait();
    const od = await offerWhen(escrow, id, (x) => x.status === 4n);
    check(`status Disputed (${STATUS[Number(od.status)]})`, od.status === 4n);
    await (await escrow.connect(depositor).resolveDispute(id, true)).wait();
    const o = await offerWhen(escrow, id, (x) => x.status === 2n);
    check(`dispute sonrası Released (${STATUS[Number(o.status)]})`, o.status === 2n);
    check("B mUSDC +10 aldı", (await balanceAtLeast(token, cp.address, bBefore + AMOUNT)) - bBefore === AMOUNT);
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} kaldı ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
