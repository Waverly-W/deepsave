"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import type { Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n-provider";
import { PreferencesProvider } from "../lib/preferences";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import AuthRedirectListener from "../components/auth-redirect-listener";

export default function Providers({
  children,
  initialLocale
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <I18nProvider initialLocale={initialLocale}>
      <SessionProvider>
        <AuthRedirectListener />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={150}>
            <QueryClientProvider client={queryClient}>
              <PreferencesProvider>
                {children}
                <Toaster />
              </PreferencesProvider>
            </QueryClientProvider>
          </TooltipProvider>
        </ThemeProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
