"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "../lib/i18n-provider";

type NavItem = {
  href: string;
  labelKey: "common.home" | "common.timeline" | "common.settings";
  icon: (props: { className?: string }) => JSX.Element;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "common.home", icon: HomeIcon },
  { href: "/timeline", labelKey: "common.timeline", icon: TimelineIcon },
  { href: "/settings", labelKey: "common.settings", icon: SettingsIcon }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-14 flex-col items-center gap-4 border-r border-neutral-200/70 bg-white/90 py-6 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/80">
      <Link
        href="/"
        aria-label="DeepSave"
        title="DeepSave"
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200/70 bg-neutral-50/80 shadow-sm transition hover:scale-105 hover:border-emerald-300 dark:border-neutral-800/60 dark:bg-neutral-900/80 dark:hover:border-emerald-500/40"
      >
        <LogoMark className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
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

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function TimelineIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SettingsIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a7.8 7.8 0 0 0 .1-6l-2 1.1a6 6 0 0 0-1.6-1.6l1.1-2a7.8 7.8 0 0 0-6-.1l.1 2.2a6 6 0 0 0-1.6 1.6l-2-1.1a7.8 7.8 0 0 0-.1 6l2-1.1a6 6 0 0 0 1.6 1.6l-.1 2.2a7.8 7.8 0 0 0 6 .1l-1.1-2a6 6 0 0 0 1.6-1.6z" />
    </svg>
  );
}

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 12v24h9c7 0 12-5 12-12s-5-12-12-12h-9z" />
      <path d="M30 16c0-3 3-6 8-6 4 0 7 2 7 5 0 7-14 3-14 12 0 3 3 5 7 5 5 0 8-3 8-6" />
    </svg>
  );
}
