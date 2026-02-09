"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TranslationKey } from "../lib/i18n";
import {
  fetchItems,
  fetchSearch,
  reprocessItemContent,
  requeueItem,
  updateItem
} from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";
import type { ItemRecord } from "../lib/types";
import ItemCard from "./item-card";
import ItemStreamSkeleton from "./item-stream-skeleton";

const PAGE_SIZE = 20;
const STALE_TIME = 10000;
const GC_TIME = 120000;
const POLL_INTERVAL = 2000;

function dedupe(items: ItemRecord[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export default function ItemStream({
  query,
  view
}: {
  query: string;
  view: "chat" | "gallery";
}) {
  const normalizedQuery = query.trim();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const isAuthed = Boolean(token);
  const { t } = useI18n();
  const isGallery = view === "gallery";
  const sourceType = isGallery ? "image" : null;
  const [actionErrorKey, setActionErrorKey] = useState<TranslationKey | null>(
    null
  );
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  const refetchInterval = useCallback(
    (queryState: { state: { data?: { pages?: { items: ItemRecord[] }[] } } }) => {
      const data = queryState.state.data;
      const pages = data?.pages ?? [];
      const hasPending = pages.some((page) =>
        page.items?.some((item) =>
          ["pending", "processing"].includes(item.processing_status)
        )
      );
      return hasPending ? POLL_INTERVAL : false;
    },
    []
  );

  const listQuery = useInfiniteQuery({
    queryKey: ["items", sourceType],
    enabled: isAuthed && !normalizedQuery,
    initialPageParam: null as string | null,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previous) => previous,
    refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: ({ pageParam }) =>
      fetchItems(
        {
          cursor: pageParam,
          limit: PAGE_SIZE,
          sourceType
        },
        { token }
      ),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined
  });

  const searchQuery = useInfiniteQuery({
    queryKey: ["search", normalizedQuery, sourceType],
    enabled: isAuthed && Boolean(normalizedQuery),
    initialPageParam: 1,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previous) => previous,
    refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: ({ pageParam }) =>
      fetchSearch(
        {
          query: normalizedQuery,
          limit: pageParam * PAGE_SIZE,
          sourceType
        },
        { token }
      ),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < allPages.length * PAGE_SIZE) {
        return undefined;
      }
      return allPages.length + 1;
    }
  });

  const activeQuery = normalizedQuery ? searchQuery : listQuery;
  const { refetch: refetchActive } = activeQuery;
  const items = useMemo(() => {
    const pages = activeQuery.data?.pages ?? [];
    const merged = pages.flatMap((page) => page.items);
    return dedupe(merged);
  }, [activeQuery.data]);

  const refreshActive = useCallback(async () => {
    await refetchActive();
  }, [refetchActive]);

  const handleArchive = useCallback(async (item: ItemRecord) => {
    if (!token) {
      return;
    }
    setActionErrorKey(null);
    setActionItemId(item.id);
    try {
      await updateItem(item.id, { is_archived: true }, { token });
      await refreshActive();
    } catch (error) {
      setActionErrorKey("stream.archiveError");
    } finally {
      setActionItemId(null);
    }
  }, [refreshActive, token]);

  const handleDelete = useCallback(async (item: ItemRecord) => {
    if (!token) {
      return;
    }
    setActionErrorKey(null);
    setActionItemId(item.id);
    try {
      await updateItem(item.id, { is_deleted: true }, { token });
      await refreshActive();
    } catch (error) {
      setActionErrorKey("stream.deleteError");
    } finally {
      setActionItemId(null);
    }
  }, [refreshActive, token]);

  const handleRetry = useCallback(async (item: ItemRecord) => {
    if (!token) {
      return;
    }
    setActionErrorKey(null);
    setActionItemId(item.id);
    try {
      await requeueItem(item.id, { token });
      await refreshActive();
    } catch (error) {
      setActionErrorKey("stream.retryError");
    } finally {
      setActionItemId(null);
    }
  }, [refreshActive, token]);

  const handleReprocess = useCallback(async (item: ItemRecord) => {
    if (!token) {
      return;
    }
    setActionErrorKey(null);
    setActionItemId(item.id);
    try {
      await reprocessItemContent(item.id, { token });
      await refreshActive();
    } catch (error) {
      setActionErrorKey("stream.reprocessError");
    } finally {
      setActionItemId(null);
    }
  }, [refreshActive, token]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }

    const fetchNext = activeQuery.fetchNextPage;
    const hasNext = activeQuery.hasNextPage;
    const isFetchingNext = activeQuery.isFetchingNextPage;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) {
          return;
        }
        if (hasNext && !isFetchingNext) {
          fetchNext();
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeQuery.fetchNextPage, activeQuery.hasNextPage, activeQuery.isFetchingNextPage]);

  if (activeQuery.isLoading) {
    return <ItemStreamSkeleton view={view} />;
  }

  if (activeQuery.isError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
        {t("stream.loadError")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-6 text-sm text-neutral-600 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70 dark:text-neutral-300">
        {query
          ? t("stream.noMatches")
          : t("stream.noItems")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionErrorKey ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {t(actionErrorKey)}
        </div>
      ) : null}
      <div className={isGallery ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            busy={actionItemId === item.id}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onReprocess={handleReprocess}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-10" />
      {activeQuery.isFetchingNextPage ? (
        <div className="space-y-3">
          <ItemStreamSkeleton
            view={view}
            count={isGallery ? 2 : 3}
          />
          <p className="sr-only">{t("common.loadingMore")}</p>
        </div>
      ) : null}
    </div>
  );
}
