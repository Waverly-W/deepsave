"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getStatusLabel, getTypeLabel } from "../lib/i18n";
import { useI18n } from "../lib/i18n-provider";
import type { ItemRecord } from "../lib/types";

const STATUS_CARD_BACKGROUNDS: Record<string, string> = {
  pending: "bg-amber-50/80 dark:bg-amber-500/10",
  processing: "bg-sky-50/80 dark:bg-sky-500/10",
  completed: "bg-emerald-50/70 dark:bg-emerald-500/10",
  failed: "bg-rose-50/70 dark:bg-rose-500/10",
  partial_fail: "bg-rose-50/70 dark:bg-rose-500/10"
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  article:
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200",
  image: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  code: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  note: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
};

const TYPE_DOT_STYLES: Record<string, string> = {
  article: "bg-neutral-500/70",
  image: "bg-sky-500",
  code: "bg-emerald-500",
  note: "bg-amber-500"
};

const ACTION_STYLES = {
  archive:
    "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25",
  delete:
    "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25",
  retry:
    "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25"
};

type ItemCardProps = {
  item: ItemRecord;
  busy?: boolean;
  onArchive?: (item: ItemRecord) => void;
  onDelete?: (item: ItemRecord) => void;
  onRetry?: (item: ItemRecord) => void;
  onReprocess?: (item: ItemRecord) => void;
};

export default function ItemCard({
  item,
  busy = false,
  onArchive,
  onDelete,
  onRetry,
  onReprocess
}: ItemCardProps) {
  const { locale, t } = useI18n();
  const [showActions, setShowActions] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const typeStyle =
    TYPE_BADGE_STYLES[item.source_type] ||
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200";
  const typeDotStyle =
    TYPE_DOT_STYLES[item.source_type] || "bg-neutral-500/70";
  const cardBg =
    STATUS_CARD_BACKGROUNDS[item.processing_status] ||
    "bg-white/80 dark:bg-neutral-900/70";
  const label = getTypeLabel(locale, item.source_type);
  const statusLabel = getStatusLabel(locale, item.processing_status);
  const tags = item.cached_tags ? item.cached_tags.split(" ").filter(Boolean).slice(0, 3) : [];
  const palette = Array.isArray(item.meta_json?.palette)
    ? (item.meta_json.palette as string[]).slice(0, 5)
    : [];
  const isFailed = ["failed", "partial_fail"].includes(item.processing_status);
  const isWorking = ["pending", "processing"].includes(item.processing_status);
  const isStale = item.content_revision > item.analysis_revision && !isWorking;
  const showReprocess = isStale && !isWorking;
  const showRetry = !showReprocess && (isFailed || isWorking);
  const retryLabel = isWorking ? t("itemCard.requeue") : t("itemCard.retry");
  const actionDisabled = busy || isWorking;
  const showActionsClass = showActions
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none";
  const summaryText =
    item.summary ||
    (isFailed ? t("itemCard.summaryFailed") : t("itemCard.summaryPending"));
  const updatedLabel = useMemo(() => {
    if (!item.updated_at) {
      return "";
    }
    const date = new Date(item.updated_at);
    const formatted = Number.isNaN(date.getTime())
      ? item.updated_at
      : new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }).format(date);
    return t("itemCard.updatedAt", { date: formatted });
  }, [item.updated_at, locale, t]);
  const countLabel = useMemo(() => {
    const wordCount = item.word_count ?? 0;
    const charCount = item.char_count ?? 0;
    const hasWords = wordCount > 0;
    const hasChars = charCount > 0;
    const preferChars = locale.startsWith("zh");
    let count = 0;
    let labelKey: "itemCard.wordCount" | "itemCard.charCount" = preferChars
      ? "itemCard.charCount"
      : "itemCard.wordCount";

    if (preferChars) {
      if (hasChars) {
        count = charCount;
        labelKey = "itemCard.charCount";
      } else {
        count = wordCount;
        labelKey = "itemCard.wordCount";
      }
    } else if (hasWords) {
      count = wordCount;
      labelKey = "itemCard.wordCount";
    } else {
      count = charCount;
      labelKey = "itemCard.charCount";
    }

    const formatted = new Intl.NumberFormat(locale).format(count);
    return t(labelKey, { count: formatted });
  }, [item.word_count, item.char_count, locale, t]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      setShowActions(true);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        setShowActions(false);
      }, 4000);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
  };

  return (
    <article
      className={`group cv-auto fade-up rounded-3xl border border-neutral-200/70 p-5 shadow-lg shadow-neutral-200/30 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-neutral-800/60 dark:shadow-black/30 ${cardBg}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${typeStyle}`}
          >
            <span className={`h-2 w-2 rounded-full ${typeDotStyle}`} />
            {label}
          </span>
          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-neutral-200/70 px-2 py-0.5 dark:border-neutral-800/70"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {isStale ? (
            <span className="rounded-full border border-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-500/40 dark:text-amber-200">
              {t("itemCard.outdated")}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="sr-only">{statusLabel}</span>
          {onArchive || onDelete || onReprocess || (onRetry && showRetry) ? (
            <div
              className={`flex items-center gap-2 transition duration-150 ${showActionsClass} group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100`}
            >
              {onArchive ? (
                <button
                  type="button"
                  aria-label={t("itemCard.archive")}
                  title={t("itemCard.archive")}
                  disabled={actionDisabled}
                  onClick={() => onArchive(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-xs shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_STYLES.archive}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 7h-16" />
                    <path d="M7 7v-3h10v3" />
                    <rect x="4" y="7" width="16" height="13" rx="2" />
                  </svg>
                  <span className="sr-only">{t("itemCard.archive")}</span>
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  aria-label={t("itemCard.delete")}
                  title={t("itemCard.delete")}
                  disabled={actionDisabled}
                  onClick={() => onDelete(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-xs shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_STYLES.delete}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6v-2h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  <span className="sr-only">{t("itemCard.delete")}</span>
                </button>
              ) : null}
              {onReprocess && showReprocess ? (
                <button
                  type="button"
                  aria-label={t("itemCard.reprocess")}
                  title={t("itemCard.reprocess")}
                  disabled={actionDisabled}
                  onClick={() => onReprocess(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-xs shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_STYLES.retry}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                    <path d="M21 3v6h-6" />
                  </svg>
                  <span className="sr-only">{t("itemCard.reprocess")}</span>
                </button>
              ) : null}
              {onRetry && showRetry ? (
                <button
                  type="button"
                  aria-label={retryLabel}
                  title={retryLabel}
                  disabled={actionDisabled}
                  onClick={() => onRetry(item)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-xs shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_STYLES.retry}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                    <path d="M21 3v6h-6" />
                  </svg>
                  <span className="sr-only">{retryLabel}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        <Link
          href={`/items/${item.id}`}
          className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          {item.title || t("common.untitled")}
        </Link>
      </h3>
      <p className="mt-3 max-h-20 overflow-hidden text-sm text-neutral-600 dark:text-neutral-300">
        {summaryText}
      </p>

      <div
        className={`mt-4 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 ${
          palette.length > 0 ? "justify-between" : "justify-end"
        }`}
      >
        {palette.length > 0 ? (
          <div className="flex items-center gap-2">
            {palette.map((color) => (
              <span
                key={color}
                title={color}
                className="h-4 w-4 rounded-full border border-white/70 shadow"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-[11px] font-medium">
          <span>{updatedLabel}</span>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <span>{countLabel}</span>
        </div>
      </div>

    </article>
  );
}
