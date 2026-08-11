import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Nomadia",
  description: "P2P fiat <-> crypto exchange, matched by location, settled in person.",
  applicationName: "Nomadia",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nomadia",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0e",
  // viewport-fit=cover lets the standalone PWA paint under the iPhone notch;
  // Telegram's WebApp script already manages its own viewport vars.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* afterInteractive, not beforeInteractive: the WebApp script mutates
            `document.documentElement.style` (viewport CSS vars) as soon as it
            runs, and doing that before hydration causes a hydration mismatch
            on <html>. Nothing here needs Telegram's API ready pre-hydration —
            lib/use-my-telegram-id.ts reads it client-side after mount anyway. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <NavBar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
