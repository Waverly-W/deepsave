import type { Metadata } from "next";

import "./globals.css";
import Providers from "./providers";
import { getServerLocale } from "../lib/i18n-server";

export const metadata: Metadata = {
  title: "DeepSave Pro",
  description: "Local-first knowledge hub",
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" }
    ],
    shortcut: "/brand/favicon-32.png",
    apple: [{ url: "/brand/pwa-192.png", sizes: "192x192", type: "image/png" }]
  }
};

const themeScript = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (stored === "dark" || (!stored && prefersDark)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const locale = getServerLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
