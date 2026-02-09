"use client";

import type { ItemRecord } from "../lib/types";
import { useI18n } from "../lib/i18n-provider";

type SearchResultCardProps = {
  item: ItemRecord;
  active: boolean;
  onSelect: (item: ItemRecord) => void;
  onHover?: () => void;
  optionId?: string;
  selected?: boolean;
  variant?: "default" | "compact";
};

export default function SearchResultCard({
  item,
  active,
  onSelect,
  onHover,
  optionId,
  selected,
  variant = "default"
}: SearchResultCardProps) {
  const { locale, t } = useI18n();
  const isOption = Boolean(optionId);
  const isCompact = variant === "compact";
  const tags = item.cached_tags
    ? item.cached_tags.split(" ").filter(Boolean).slice(0, 3)
    : [];
  const summary =
    item.summary?.trim() || t("itemCard.summaryPending");

  const updatedAt = item.updated_at
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(new Date(item.updated_at))
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      onMouseEnter={onHover}
      id={optionId}
      role={isOption ? "option" : undefined}
      aria-selected={isOption ? selected : undefined}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
          : "border-transparent bg-transparent text-neutral-700 hover:border-neutral-200 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:border-neutral-800 dark:hover:bg-neutral-800/60"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">
          {item.title || t("common.untitled")}
        </span>
        {!isCompact && updatedAt ? (
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {updatedAt}
          </span>
        ) : null}
      </span>
      {!isCompact ? (
        <>
          <span className="mt-1 block max-h-10 overflow-hidden text-xs text-neutral-500 dark:text-neutral-400">
            {summary}
          </span>
          {tags.length > 0 ? (
            <span className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-neutral-200/70 px-2 py-0.5 dark:border-neutral-800/70"
                >
                  #{tag}
                </span>
              ))}
            </span>
          ) : null}
        </>
      ) : null}
    </button>
  );
}
