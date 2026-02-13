"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "../lib/i18n-provider";
import { NAV_ITEMS } from "./nav-items";

export default function BottomTabBar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/80 md:hidden">
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-6">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[11px] transition ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
              aria-label={t(item.labelKey)}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl border transition">
                <Icon
                  className={`h-5 w-5 ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                />
              </span>
              <span className="font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
