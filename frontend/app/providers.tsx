"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

import type { Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n-provider";

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
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
