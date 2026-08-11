import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { baseSepolia, hardhat } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

// Same Reown project used for the WalletConnect relay — AppKit's email/social
// login (Google, Apple, ...) is a feature of that one project, not a
// separate service, so no new account is needed to add it (see providers.tsx).
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// The local Hardhat chain only exists on a developer's machine — offering it
// as a network choice in the deployed app is confusing (users see "Hardhat"
// in their wallet's network switcher with nothing actually running there).
export const networks: [AppKitNetwork, ...AppKitNetwork[]] =
  process.env.NODE_ENV === "development" ? [baseSepolia, hardhat] : [baseSepolia];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: walletConnectProjectId || "nomadia-dev-placeholder",
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
