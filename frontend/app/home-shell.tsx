"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { fetchItems, fetchItemsOverview } from "../lib/fetchers";
import type { ItemRecord } from "../lib/types";
import SearchDropdown from "../components/search-dropdown";
import SearchResultCard from "../components/search-result-card";
import Sidebar from "../components/sidebar";
import { useI18n } from "../lib/i18n-provider";
import { useDebounce } from "../lib/use-debounce";

const RECENT_SEARCHES_KEY = "ds_recent_searches";

export default function HomeShell() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedQuery = useDebounce(input, 500);
  const [results, setResults] = useState<ItemRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = debouncedQuery.trim();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const suggestions = [
    t("home.suggested.0"),
    t("home.suggested.1"),
    t("home.suggested.2"),
    t("home.suggested.3")
  ];
  const shortcuts = [
    t("home.shortcut.upDown"),
    t("home.shortcut.enter"),
    t("home.shortcut.tag")
  ];
  const overviewQuery = useQuery({
    queryKey: ["items-overview"],
    enabled: Boolean(token) && !trimmedQuery,
    staleTime: 30000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchItemsOverview({ token })
  });
  const recentQuery = useQuery({
    queryKey: ["items-recent"],
    enabled: Boolean(token) && !trimmedQuery,
    staleTime: 30000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchItems({ limit: 5 }, { token })
  });
  const recentItems = recentQuery.data?.items ?? [];
  const topTags = overviewQuery.data?.top_tags ?? [];
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const latestSavedLabel = useMemo(() => {
    const latest = overviewQuery.data?.latest_created_at;
    if (!latest) {
      return t("home.stats.latestEmpty");
    }
    const date = new Date(latest);
    if (Number.isNaN(date.getTime())) {
      return latest;
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }, [locale, overviewQuery.data?.latest_created_at, t]);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setActiveIndex(-1);
    }
  }, [trimmedQuery]);

  useEffect(() => {
    recentSearchesRef.current = recentSearches;
  }, [recentSearches]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentSearches(
          parsed.filter((value) => typeof value === "string").slice(0, 8)
        );
      }
    } catch {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  }, []);

  useEffect(() => {
    if (!trimmedQuery || typeof window === "undefined") {
      return;
    }
    const current = recentSearchesRef.current;
    if (current[0] === trimmedQuery) {
      return;
    }
    const next = [trimmedQuery, ...current.filter((value) => value !== trimmedQuery)].slice(
      0,
      8
    );
    recentSearchesRef.current = next;
    setRecentSearches(next);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }, [trimmedQuery]);

  useEffect(() => {
    if (results.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) =>
      current < 0 ? 0 : Math.min(current, results.length - 1)
    );
  }, [results]);

  const activeDescendantId = useMemo(() => {
    if (activeIndex < 0) {
      return undefined;
    }
    const item = results[activeIndex];
    return item ? `search-option-${item.id}` : undefined;
  }, [activeIndex, results]);

  const selectItem = (item: ItemRecord) => {
    router.push(`/items/${item.id}`);
  };

  const applySuggestion = (value: string) => {
    setInput(value);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => {
        if (current < 0) {
          return 0;
        }
        return (current + 1) % results.length;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => {
        if (current < 0) {
          return results.length - 1;
        }
        return (current - 1 + results.length) % results.length;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const index = activeIndex >= 0 ? activeIndex : 0;
      const item = results[index];
      if (item) {
        selectItem(item);
      }
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_85%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_85%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <Sidebar />
      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-10 pl-20">
        <section className="flex min-h-[70vh] flex-col">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-5xl">
              <div className="mx-auto w-full max-w-2xl text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                  {t("common.appName")}
                </p>
                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                  {t("home.heroTitle")}
                </h1>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  {t("home.heroSubtitle")}
                </p>
              </div>
              <div className="relative mx-auto mt-6 w-full max-w-2xl">
                <div className="flex flex-col gap-3 rounded-3xl border border-neutral-200/70 bg-white/90 px-5 py-4 shadow-lg backdrop-blur focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-200 dark:border-neutral-800/60 dark:bg-neutral-900/70 dark:focus-within:border-emerald-400 dark:focus-within:ring-emerald-400/30">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("home.searchPlaceholder")}
                    aria-controls="search-results-listbox"
                    aria-activedescendant={activeDescendantId}
                    className="w-full bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  />
                </div>
                <SearchDropdown
                  query={trimmedQuery}
                  activeIndex={activeIndex}
                  onActiveIndexChange={setActiveIndex}
                  onSelect={selectItem}
                  onResultsChange={setResults}
                />
              </div>
              {!trimmedQuery ? (
                <div className="mt-6 space-y-6">
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {shortcuts.map((shortcut) => (
                      <span
                        key={shortcut}
                        className="rounded-full border border-neutral-200/70 bg-white/80 px-3 py-1 dark:border-neutral-800/60 dark:bg-neutral-900/60"
                      >
                        {shortcut}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                    <div className="space-y-6">
                      <section className="rounded-3xl border border-neutral-200/70 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                            {t("home.statsTitle")}
                          </p>
                          {overviewQuery.isLoading ? (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.overviewLoading")}
                            </span>
                          ) : null}
                          {overviewQuery.isError ? (
                            <span className="text-xs text-rose-500 dark:text-rose-300">
                              {t("home.overviewError")}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            {
                              key: "total",
                              label: t("home.stats.total"),
                              value: overviewQuery.data?.total_count ?? 0
                            },
                            {
                              key: "unread",
                              label: t("home.stats.unread"),
                              value: overviewQuery.data?.unread_count ?? 0
                            },
                            {
                              key: "processing",
                              label: t("home.stats.processing"),
                              value: overviewQuery.data?.processing_count ?? 0
                            },
                            {
                              key: "stale",
                              label: t("home.stats.stale"),
                              value: overviewQuery.data?.stale_count ?? 0
                            },
                            {
                              key: "today",
                              label: t("home.stats.today"),
                              value: overviewQuery.data?.today_count ?? 0
                            }
                          ].map((stat) => (
                            <div
                              key={stat.key}
                              className="rounded-2xl border border-neutral-200/70 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-neutral-800/60 dark:bg-neutral-950"
                            >
                              <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                                {stat.label}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                                {numberFormatter.format(stat.value)}
                              </p>
                            </div>
                          ))}
                          <div className="rounded-2xl border border-neutral-200/70 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-neutral-800/60 dark:bg-neutral-950">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                              {t("home.stats.latest")}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                              {latestSavedLabel}
                            </p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-neutral-200/70 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                            {t("home.recentTitle")}
                          </p>
                          <Link
                            href="/timeline"
                            className="text-xs text-neutral-500 transition hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-300"
                          >
                            {t("home.viewTimeline")}
                          </Link>
                        </div>
                        <div className="mt-3 space-y-2">
                          {recentQuery.isLoading ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.recentLoading")}
                            </p>
                          ) : null}
                          {recentQuery.isError ? (
                            <p className="text-xs text-rose-500 dark:text-rose-300">
                              {t("home.recentError")}
                            </p>
                          ) : null}
                          {!recentQuery.isLoading && !recentQuery.isError && recentItems.length === 0 ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.recentEmpty")}
                            </p>
                          ) : null}
                          {recentItems.map((item) => (
                            <SearchResultCard
                              key={item.id}
                              item={item}
                              active={false}
                              selected={false}
                              onSelect={selectItem}
                              variant="compact"
                            />
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-2xl border border-neutral-200/70 bg-white/85 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                          {t("home.suggestedTitle")}
                        </p>
                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                          {t("home.searchHint")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestions.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => applySuggestion(item)}
                              className="rounded-full border border-neutral-200/70 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800/60 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-neutral-200/70 bg-white/85 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                          {t("home.tagsTitle")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {overviewQuery.isLoading ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.tagsLoading")}
                            </p>
                          ) : null}
                          {overviewQuery.isError ? (
                            <p className="text-xs text-rose-500 dark:text-rose-300">
                              {t("home.tagsError")}
                            </p>
                          ) : null}
                          {!overviewQuery.isLoading && !overviewQuery.isError && topTags.length === 0 ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.tagsEmpty")}
                            </p>
                          ) : null}
                          {topTags.map((tag) => (
                            <button
                              key={tag.tag}
                              type="button"
                              onClick={() => applySuggestion(`/tag ${tag.tag}`)}
                              className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800/60 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                            >
                              <span>#{tag.tag}</span>
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                                {numberFormatter.format(tag.count)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-neutral-200/70 bg-white/85 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                          {t("home.recentSearchesTitle")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {recentSearches.length === 0 ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {t("home.recentSearchesEmpty")}
                            </p>
                          ) : (
                            recentSearches.map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => applySuggestion(value)}
                                className="rounded-full border border-neutral-200/70 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800/60 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                              >
                                {value}
                              </button>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-neutral-200/70 bg-white/85 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                          {t("home.quickActionsTitle")}
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          <Link
                            href="/timeline"
                            className="rounded-xl border border-neutral-200/70 bg-white px-3 py-2 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800/60 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                          >
                            {t("common.timeline")}
                          </Link>
                          <Link
                            href="/settings"
                            className="rounded-xl border border-neutral-200/70 bg-white px-3 py-2 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800/60 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-200"
                          >
                            {t("common.settings")}
                          </Link>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
