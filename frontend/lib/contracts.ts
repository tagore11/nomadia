import { baseSepolia, hardhat } from "wagmi/chains";
import escrowAbi from "./abi/NomadiaEscrow.json";
import erc20Abi from "./abi/MockUSDC.json";

// V0 timeout matches docs/DECISIONS.md D-002/D-013 — 2 hours.
export const ESCROW_TIMEOUT_SECONDS = 2 * 60 * 60;

// V0 only wires up one stablecoin per chain (see TOKEN_ADDRESS below) even
// though the offer form lets a user label their side USDC or USDT — both
// decimal counts match real USDC/USDT on Base, so this holds for the mock too.
export const CRYPTO_DECIMALS = 6;

// Fill in after `npx hardhat run scripts/deploy.js --network baseSepolia`
// in ../contracts. Left empty until a real testnet deploy happens.
export const ESCROW_ADDRESS: Record<number, `0x${string}` | undefined> = {
  [baseSepolia.id]: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS_BASE_SEPOLIA as `0x${string}`) || undefined,
  [hardhat.id]: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS_LOCAL as `0x${string}`) || undefined,
};

export const TOKEN_ADDRESS: Record<number, `0x${string}` | undefined> = {
  [baseSepolia.id]: (process.env.NEXT_PUBLIC_TOKEN_ADDRESS_BASE_SEPOLIA as `0x${string}`) || undefined,
  [hardhat.id]: (process.env.NEXT_PUBLIC_TOKEN_ADDRESS_LOCAL as `0x${string}`) || undefined,
};

export const ESCROW_ABI = escrowAbi;
export const ERC20_ABI = erc20Abi;
