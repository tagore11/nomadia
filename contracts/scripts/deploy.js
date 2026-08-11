const hre = require("hardhat");

// 2 hours, matches the V0 MVP spec (docs/DECISIONS.md D-002/D-013).
const TIMEOUT_SECONDS = 2 * 60 * 60;

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Beta arbiter = the deployer wallet by default (manually-supervised closed
  // beta). Override with ARBITER_ADDRESS for a dedicated dispute multisig.
  const arbiter = process.env.ARBITER_ADDRESS || deployer.address;

  const NomadiaEscrow = await hre.ethers.getContractFactory("NomadiaEscrow");
  const escrow = await NomadiaEscrow.deploy(TIMEOUT_SECONDS, arbiter);
  await escrow.waitForDeployment();

  // Testnet/local only — never deploy this to `base` mainnet. Real USDC/USDT
  // addresses replace it there (see lib/contracts.ts TOKEN_ADDRESS).
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const token = await MockUSDC.deploy();
  await token.waitForDeployment();

  // Allowlist the token the escrow is allowed to hold. On mainnet this is the
  // single real Base USDC address instead of the mock.
  const allowTx = await escrow.setTokenAllowed(await token.getAddress(), true);
  await allowTx.wait();

  console.log(`NomadiaEscrow deployed to: ${await escrow.getAddress()}`);
  console.log(`MockUSDC deployed to: ${await token.getAddress()}`);
  console.log(`Arbiter: ${arbiter}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Timeout: ${TIMEOUT_SECONDS}s`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
