"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef } from "react";

import { fetchSearch } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";
import type { ItemRecord } from "../lib/types";
import SearchResultCard from "./search-result-card";

type SearchDropdownProps = {
  query: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: ItemRecord) => void;
  onResultsChange?: (items: ItemRecord[]) => void;
};

const MAX_RESULTS = 12;
const STALE_TIME = 10000;
const GC_TIME = 120000;
const LISTBOX_ID = "search-results-listbox";

export default function SearchDropdown({
  query,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onResultsChange
}: SearchDropdownProps) {
  const trimmedQuery = query.trim();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t } = useI18n();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const searchQuery = useQuery({
    queryKey: ["search-dropdown", trimmedQuery],
    enabled: Boolean(token) && trimmedQuery.length > 0,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    queryFn: () =>
      fetchSearch(
        {
          query: trimmedQuery,
          limit: MAX_RESULTS
        },
        { token }
      )
  });

  const results = useMemo(
    () => searchQuery.data?.items ?? [],
    [searchQuery.data]
  );

  useEffect(() => {
    if (!onResultsChange) {
      return;
    }
    if (!trimmedQuery) {
      onResultsChange([]);
      return;
    }
    onResultsChange(results);
  }, [onResultsChange, results, trimmedQuery]);

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    const node = itemRefs.current[activeIndex];
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results.length]);

  if (!trimmedQuery) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-full z-20 mt-3 w-[min(92vw,56rem)] -translate-x-1/2 rounded-3xl border border-neutral-200/70 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/95">
      {searchQuery.isLoading ? (
        <div className="rounded-2xl px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
          {t("home.searchLoading")}
        </div>
      ) : null}
      {searchQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {t("home.searchError")}
        </div>
      ) : null}
      {!searchQuery.isLoading && !searchQuery.isError && results.length === 0 ? (
        <div className="rounded-2xl px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
          {t("home.searchEmpty")}
        </div>
      ) : null}
      {results.length > 0 ? (
        <div
          role="listbox"
          id={LISTBOX_ID}
          className="max-h-80 space-y-2 overflow-auto"
        >
          {results.map((item, index) => {
            const optionId = `search-option-${item.id}`;
            return (
            <div
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
            >
              <SearchResultCard
                item={item}
                active={index === activeIndex}
                selected={index === activeIndex}
                optionId={optionId}
                onSelect={onSelect}
                onHover={() => onActiveIndexChange(index)}
              />
            </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
