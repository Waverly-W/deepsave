"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { useI18n } from "../lib/i18n-provider";
import { NAV_ITEMS } from "./nav-items";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-14 flex-col items-center gap-4 border-r border-neutral-200/70 bg-white/90 py-6 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/80 md:flex">
      <Link
        href="/"
        aria-label="DeepSave"
        title="DeepSave"
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200/70 bg-neutral-50/80 shadow-sm transition hover:scale-105 hover:border-emerald-300 dark:border-neutral-800/60 dark:bg-neutral-900/80 dark:hover:border-emerald-500/40"
      >
        <Image
          src="/brand/logo-mark.svg"
          alt="DeepSave"
          width={24}
          height={24}
          className="h-6 w-6"
          priority
        />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={t(item.labelKey)}
              title={t(item.labelKey)}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:border-neutral-800 dark:hover:bg-neutral-800/60"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
