"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { appKitModal } from "@/lib/appkit";
import { useLocale } from "@/lib/use-locale";
import { useColorScheme } from "@/lib/use-color-scheme";
import { TelegramThemeSync } from "@/components/TelegramThemeSync";
import { TelegramLinkBridge } from "@/components/TelegramLinkBridge";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import tr from "@/messages/tr.json";

const MESSAGES = { en, ru, tr };

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [locale] = useLocale();
  const colorScheme = useColorScheme();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Keep the AppKit connect modal's theme in sync with the app/Telegram theme.
  useEffect(() => {
    appKitModal.setThemeMode(colorScheme);
  }, [colorScheme]);

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      <TelegramThemeSync />
      <TelegramLinkBridge />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </NextIntlClientProvider>
  );
}
