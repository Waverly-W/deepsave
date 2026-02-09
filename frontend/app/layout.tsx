import type { Metadata } from "next";
import { Newsreader, Space_Grotesk } from "next/font/google";

import "./globals.css";
import Providers from "./providers";
import { getServerLocale } from "../lib/i18n-server";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  adjustFontFallback: false
});

export const metadata: Metadata = {
  title: "DeepSave Pro",
  description: "Local-first knowledge hub"
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
      className={`${spaceGrotesk.variable} ${newsreader.variable}`}
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
