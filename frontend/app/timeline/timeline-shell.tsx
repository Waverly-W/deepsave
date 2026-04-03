"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import BottomTabBar from "../../components/bottom-tab-bar";
import ItemStream from "../../components/item-stream";
import Sidebar from "../../components/sidebar";
import { useI18n } from "../../lib/i18n-provider";

function resolveTimelineQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/tag ")) {
    return trimmed.slice(5).trim();
  }
  return trimmed;
}

export default function TimelineShell() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const query = useMemo(
    () => resolveTimelineQuery(searchParams.get("q") ?? ""),
    [searchParams]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_85%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_85%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <Sidebar />
      <BottomTabBar />
      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-6 pt-10 pb-[calc(2.5rem+var(--bottom-tab-height)+env(safe-area-inset-bottom))] md:py-10 md:pl-20">
        <section className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
              {t("common.timeline")}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {t("timeline.heading")}
            </h1>
          </header>
          <ItemStream query={query} view="chat" />
        </section>
      </div>
    </main>
  );
}
