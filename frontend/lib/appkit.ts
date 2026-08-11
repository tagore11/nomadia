"use client";

// Initialises Reown AppKit once, at module load. This is the step that was
// missing: `<appkit-button>` is a web component that only gets registered (and
// its connect modal wired up) by createAppKit — without this call the button
// renders but does nothing. createAppKit also unlocks email + Google/Apple
// social sign-in, which provision an embedded wallet, so a non-crypto user can
// get a wallet identity with one tap.

import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, networks, walletConnectProjectId } from "./wagmi";

// metadata.url must match the ACTUAL origin the app runs on, otherwise Reown's
// social-login OAuth rejects the request (error=missing_parameter_mismatch when
// testing on localhost while this points at the production domain). Derive it
// from the live origin, falling back to production for SSR.
const origin = typeof window !== "undefined" ? window.location.origin : "https://nomadia-app.vercel.app";

const metadata = {
  name: "Nomadia",
  description: "P2P fiat <-> crypto exchange, matched by location, settled in person.",
  url: origin,
  icons: [`${origin}/favicon.ico`],
};

export const appKitModal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: walletConnectProjectId || "nomadia-dev-placeholder",
  metadata,
  themeVariables: { "--w3m-accent": "#3ce089" },
  features: {
    email: true,
    // Google/Apple are hidden until Social Login is enabled for this project in
    // the Reown dashboard (cloud.reown.com) — with it off, the buttons render
    // but loop on an OAuth error. Restore `socials: ["google", "apple"]` once
    // the dashboard side is configured; email + wallets work regardless.
    socials: false,
    emailShowWallets: true,
  },
});
