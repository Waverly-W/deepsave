"use client";

import dynamicImport from "next/dynamic";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Menu,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import BottomTabBar from "../../components/bottom-tab-bar";
import ItemAnalysisActions from "../../components/item-analysis-actions";
import ItemEditorFallback from "../../components/item-editor-fallback";
import ItemTitleEditor from "../../components/item-title-editor";
import Sidebar from "../../components/sidebar";
import DraftNoteEditor from "../../components/draft-note-editor";
import {
  fetchItemDetail,
  fetchTagTree,
  reprocessItemContent,
  updateItem
} from "../../lib/fetchers";
import {
  type TranslationKey,
  getStatusLabel,
  getTypeLabel
} from "../../lib/i18n";
import { useI18n } from "../../lib/i18n-provider";
import type { ItemDetail, TagTreeItem, TagTreeNode } from "../../lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../../components/ui/dialog";

const ItemMarkdownEditor = dynamicImport(
  () => import("../../components/item-markdown-editor"),
  {
    ssr: false,
    loading: () => <ItemEditorFallback />
  }
);

const POLL_INTERVAL = 2000;

function summaryLines(summary: string | null) {
  if (!summary) {
    return [] as string[];
  }
  return summary
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export default function TagsShell() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramItemId = searchParams.get("itemId");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    paramItemId
  );
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tagTreePolling, setTagTreePolling] = useState(false);
  const [pollingItemId, setPollingItemId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: TagTreeItem;
  } | null>(null);

  const tagTreeQuery = useQuery({
    queryKey: ["tag-tree", { includeArchived: false }],
    enabled: Boolean(token),
    staleTime: 30000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchTagTree({ token }, false)
  });

  const detailRefetchInterval = (queryState: {
    state: { data?: ItemDetail };
  }) => {
    const data = queryState.state.data;
    if (!data) {
      return false;
    }
    const isWorking = ["pending", "processing"].includes(data.processing_status);
    return isWorking ? POLL_INTERVAL : false;
  };

  const detailQuery = useQuery({
    queryKey: ["item-detail", selectedItemId],
    enabled: Boolean(selectedItemId && token),
    refetchInterval: detailRefetchInterval,
    refetchIntervalInBackground: false,
    queryFn: () => fetchItemDetail(selectedItemId as string, { token })
  });

  useEffect(() => {
    const item = detailQuery.data;
    if (!item || item.is_read || !token) {
      return;
    }
    updateItem(item.id, { is_read: true }, { token }).catch(() => {
      // Ignore read state failures to keep UI responsive.
    });
  }, [detailQuery.data, token]);

  useEffect(() => {
    if (!paramItemId) {
      return;
    }
    setSelectedItemId((current) =>
      current === paramItemId ? current : paramItemId
    );
    setIsCreatingNote(false);
  }, [paramItemId]);

  const item = detailQuery.data;
  const isLoadingDetail = Boolean(selectedItemId && detailQuery.isLoading);
  const lines = summaryLines(item?.summary ?? null);
  const tags = item?.cached_tags ? item.cached_tags.split(" ").filter(Boolean) : [];
  const palette = Array.isArray(item?.meta_json?.palette)
    ? (item?.meta_json.palette as string[]).slice(0, 6)
    : [];
  const typeLabel = item ? getTypeLabel(locale, item.source_type) : "";
  const statusLabel = item ? getStatusLabel(locale, item.processing_status) : "";
  const createdAtLabel = item
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(item.created_at))
    : "";
  const toggleNode = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const syncItemParam = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("itemId", id);
    } else {
      params.delete("itemId");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const handleSelectItem = (id: string) => {
    setIsCreatingNote(false);
    setSelectedItemId(id);
    syncItemParam(id);
  };

  const handleStartCreate = () => {
    setIsCreatingNote(true);
    setSelectedItemId(null);
    syncItemParam(null);
  };

  const handleNoteSaved = async (itemId: string) => {
    setIsCreatingNote(false);
    setSelectedItemId(itemId);
    syncItemParam(itemId);
    await refreshTagTree();
  };

  const handleContextMenu = (
    item: TagTreeItem,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    setIsCreatingNote(false);
    const { clientX, clientY } = event;
    setSelectedItemId(item.id);
    syncItemParam(item.id);
    const menuWidth = 180;
    const menuHeight = 132;
    const nextX = Math.min(clientX, window.innerWidth - menuWidth - 8);
    const nextY = Math.min(clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x: nextX, y: nextY, item });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const refreshTagTree = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tag-tree"] });
  };

  const handleArchiveItem = async (item: TagTreeItem) => {
    if (!token) {
      return;
    }
    try {
      await updateItem(item.id, { is_archived: true }, { token });
      if (selectedItemId === item.id) {
        setSelectedItemId(null);
        syncItemParam(null);
      }
      await refreshTagTree();
    } catch (error) {
      toast.error(t("stream.archiveError"));
    }
  };

  const handleDeleteItem = async (item: TagTreeItem) => {
    if (!token) {
      return;
    }
    try {
      await updateItem(item.id, { is_deleted: true }, { token });
      if (selectedItemId === item.id) {
        setSelectedItemId(null);
        syncItemParam(null);
      }
      await refreshTagTree();
    } catch (error) {
      toast.error(t("stream.deleteError"));
    }
  };

  const handleReprocessItem = async (item: TagTreeItem) => {
    if (!token) {
      return;
    }
    try {
      await reprocessItemContent(item.id, { token });
      setTagTreePolling(true);
      setPollingItemId(item.id);
      await queryClient.invalidateQueries({
        queryKey: ["item-detail", item.id]
      });
    } catch (error) {
      toast.error(t("stream.reprocessError"));
    }
  };

  useEffect(() => {
    const handleReprocess = (event: Event) => {
      const detail = (event as CustomEvent).detail as { itemId?: string };
      if (!detail?.itemId) {
        return;
      }
      setTagTreePolling(true);
      setPollingItemId(detail.itemId);
      if (detail.itemId === selectedItemId) {
        queryClient.invalidateQueries({
          queryKey: ["item-detail", detail.itemId]
        }).catch(() => {});
      }
    };
    window.addEventListener("deepsave:item-reprocess", handleReprocess);
    return () => {
      window.removeEventListener("deepsave:item-reprocess", handleReprocess);
    };
  }, [queryClient, selectedItemId]);

  useEffect(() => {
    if (!tagTreePolling || !pollingItemId) {
      return;
    }
    const detail = detailQuery.data;
    if (!detail || detail.id !== pollingItemId) {
      return;
    }
    const isWorking = ["pending", "processing"].includes(detail.processing_status);
    if (isWorking) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["tag-tree"] }).catch(() => {});
    setTagTreePolling(false);
    setPollingItemId(null);
  }, [detailQuery.data, pollingItemId, queryClient, tagTreePolling]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu]);

  return (
    <main className="relative h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <Sidebar />
      <BottomTabBar />
      <div className="relative flex h-screen flex-col md:pl-14">
        <Dialog>
          <DialogTrigger
            aria-label={t("tags.treeTitle")}
            className="absolute left-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm transition hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:text-neutral-100 lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </DialogTrigger>
          <DialogContent className="left-0 top-0 h-full w-[85vw] max-w-xs translate-x-0 translate-y-0 rounded-none border-none bg-white/95 p-0 shadow-2xl dark:bg-neutral-950/95 sm:rounded-none">
            <div className="flex h-full flex-col">
              <DialogHeader className="border-b border-neutral-200/70 px-5 py-4 text-left dark:border-neutral-800/60">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-base">
                    {t("tags.treeTitle")}
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    aria-label={t("tags.newNote")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm transition hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:text-neutral-100"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4">
                <TagTreePanel
                  nodes={tagTreeQuery.data?.tree ?? []}
                  expanded={expanded}
                  onToggle={toggleNode}
                  onSelectItem={handleSelectItem}
                  onContextMenu={handleContextMenu}
                  selectedItemId={selectedItemId}
                  loading={tagTreeQuery.isLoading}
                  error={tagTreeQuery.isError}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(2.5rem+var(--bottom-tab-height)+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="hidden min-h-0 w-72 flex-col overflow-hidden border-r border-neutral-200/70 bg-white/80 dark:border-neutral-800/60 dark:bg-neutral-950 lg:flex">
              <div className="flex h-12 items-center justify-between px-4">
                <span className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                  {t("tags.treeTitle")}
                </span>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  aria-label={t("tags.newNote")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                <TagTreePanel
                  nodes={tagTreeQuery.data?.tree ?? []}
                  expanded={expanded}
                  onToggle={toggleNode}
                  onSelectItem={handleSelectItem}
                  onContextMenu={handleContextMenu}
                  selectedItemId={selectedItemId}
                  loading={tagTreeQuery.isLoading}
                  error={tagTreeQuery.isError}
                />
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-neutral-200/70 bg-white/70 dark:border-neutral-800/60 dark:bg-neutral-900/60">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {isCreatingNote ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-sm leading-7 text-neutral-700 dark:text-neutral-200">
                    <DraftNoteEditor token={token} onSaved={handleNoteSaved} />
                  </div>
                ) : item ? (
                  <>
                    <div className="border-b border-neutral-200/70 px-6 py-4 dark:border-neutral-800/60">
                      <ItemTitleEditor
                        itemId={item.id}
                        initialTitle={item.title}
                        token={token}
                      />
                      {item.processing_status !== "completed" ? (
                        <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                          {t("detail.processingNotice")}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-sm leading-7 text-neutral-700 dark:text-neutral-200">
                      <ItemMarkdownEditor
                        itemId={item.id}
                        initialContent={item.content_text}
                        sourceType={item.source_type}
                        processingStatus={item.processing_status}
                        token={token}
                        analysisActions={
                          <ItemAnalysisActions
                            itemId={item.id}
                            contentRevision={item.content_revision}
                            analysisRevision={item.analysis_revision}
                            processingStatus={item.processing_status}
                            token={token}
                          />
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-neutral-500 dark:text-neutral-400">
                    {isLoadingDetail ? t("tags.loadingDetail") : t("tags.selectHint")}
                  </div>
                )}
              </div>

              {item ? (
                <div className="border-t border-neutral-200/70 px-6 py-4 lg:hidden dark:border-neutral-800/60">
                  <div className="space-y-3">
                    <details className="details-reset group rounded-3xl border border-neutral-200/70 bg-white/80 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                        {t("detail.metadata")}
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition group-open:rotate-180 dark:border-neutral-800">
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </summary>
                      <div className="space-y-3 px-5 pb-5 text-xs text-neutral-500 dark:text-neutral-400">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                            {t("detail.metaType")}
                          </span>
                          <span className="rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800">
                            {typeLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                            {t("detail.metaStatus")}
                          </span>
                          <span className="rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800">
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                            {t("detail.metaRead")}
                          </span>
                          {item.is_read ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                              {t("common.read")}
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                              {t("common.unread")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                            {t("detail.metaTime")}
                          </span>
                          <span className="text-right text-neutral-600 dark:text-neutral-300">
                            {createdAtLabel}
                          </span>
                        </div>
                      </div>
                    </details>

                    <details className="details-reset group rounded-3xl border border-neutral-200/70 bg-white/80 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                        {t("detail.summary")}
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition group-open:rotate-180 dark:border-neutral-800">
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </summary>
                      <div className="space-y-2 px-5 pb-5 text-sm text-neutral-600 dark:text-neutral-300">
                        {lines.length > 0 ? (
                          <ul className="space-y-2">
                            {lines.map((line) => (
                              <li key={line} className="flex gap-2">
                                <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-400" />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>{t("detail.noSummary")}</p>
                        )}
                      </div>
                    </details>

                    {tags.length > 0 ? (
                      <details className="details-reset group rounded-3xl border border-neutral-200/70 bg-white/80 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                          {t("detail.tags")}
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition group-open:rotate-180 dark:border-neutral-800">
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="flex flex-wrap gap-2 px-5 pb-5 text-xs text-neutral-500 dark:text-neutral-400">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    {palette.length > 0 ? (
                      <details className="details-reset group rounded-3xl border border-neutral-200/70 bg-white/80 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                          {t("detail.palette")}
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-400 transition group-open:rotate-180 dark:border-neutral-800">
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="flex flex-wrap gap-2 px-5 pb-5">
                          {palette.map((color) => (
                            <span
                              key={color}
                              className="h-8 w-8 rounded-full border border-neutral-200/70 shadow-sm dark:border-neutral-800/60"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="hidden min-h-0 w-80 flex-col overflow-hidden border-l border-neutral-200/70 bg-neutral-50/80 dark:border-neutral-800/60 dark:bg-neutral-950 lg:flex">
              {item ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="border-b border-neutral-200/70 px-5 py-4 dark:border-neutral-800/60">
                    <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                      {t("detail.metadata")}
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                          {t("detail.metaType")}
                        </span>
                        <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs dark:border-neutral-800">
                          {typeLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                          {t("detail.metaStatus")}
                        </span>
                        <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs dark:border-neutral-800">
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                          {t("detail.metaRead")}
                        </span>
                        {item.is_read ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                            {t("common.read")}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                            {t("common.unread")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                          {t("detail.metaTime")}
                        </span>
                        <span className="text-right text-xs text-neutral-600 dark:text-neutral-300">
                          {createdAtLabel}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 transition hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                      >
                        {t("detail.openOriginal")}
                      </a>
                    </div>
                  </div>

                  <div className="border-b border-neutral-200/70 px-5 py-4 dark:border-neutral-800/60">
                    <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                      {t("detail.summary")}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {lines.length > 0 ? (
                        <ul className="space-y-2">
                          {lines.map((line) => (
                            <li key={line} className="flex gap-2">
                              <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-400" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>{t("detail.noSummary")}</p>
                      )}
                    </div>
                  </div>

                  {tags.length > 0 ? (
                    <div className="border-b border-neutral-200/70 px-5 py-4 dark:border-neutral-800/60">
                      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                        {t("detail.tags")}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {palette.length > 0 ? (
                    <div className="px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                        {t("detail.palette")}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {palette.map((color) => (
                          <span
                            key={color}
                            className="h-8 w-8 rounded-full border border-neutral-200/70 shadow-sm dark:border-neutral-800/60"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="px-5 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                  {isLoadingDetail ? t("tags.loadingDetail") : t("tags.selectHint")}
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
      {contextMenu ? (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
          onContextMenu={(event) => {
            event.preventDefault();
            closeContextMenu();
          }}
        >
          <div
            className="absolute min-w-[180px] rounded-xl border border-neutral-200 bg-white p-1 text-sm text-neutral-700 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
              onClick={() => {
                void handleReprocessItem(contextMenu.item);
                closeContextMenu();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t("itemCard.reprocess")}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
              onClick={() => {
                void handleArchiveItem(contextMenu.item);
                closeContextMenu();
              }}
            >
              <Archive className="h-4 w-4" />
              {t("itemCard.archive")}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
              onClick={() => {
                void handleDeleteItem(contextMenu.item);
                closeContextMenu();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t("itemCard.delete")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type TagDisplayNode = Omit<TagTreeNode, "children"> & {
  displayName: string;
  children: TagDisplayNode[];
};

function TagTreePanel({
  nodes,
  expanded,
  onToggle,
  onSelectItem,
  onContextMenu,
  selectedItemId,
  loading,
  error
}: {
  nodes: TagTreeNode[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelectItem: (id: string) => void;
  onContextMenu: (item: TagTreeItem, event: React.MouseEvent<HTMLButtonElement>) => void;
  selectedItemId: string | null;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useI18n();
  const displayNodes = compactNodes(nodes);

  if (loading) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("tags.loading")}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("tags.error")}
      </p>
    );
  }

  if (!displayNodes.length) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("tags.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayNodes.map((node) => (
        <TagNode
          key={node.path}
          node={node}
          depth={1}
          expanded={expanded}
          onToggle={onToggle}
          onSelectItem={onSelectItem}
          onContextMenu={onContextMenu}
          selectedItemId={selectedItemId}
        />
      ))}
    </div>
  );
}

function TagNode({
  node,
  depth,
  expanded,
  onToggle,
  onSelectItem,
  onContextMenu,
  selectedItemId
}: {
  node: TagDisplayNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelectItem: (id: string) => void;
  onContextMenu: (item: TagTreeItem, event: React.MouseEvent<HTMLButtonElement>) => void;
  selectedItemId: string | null;
}) {
  const { t } = useI18n();
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  const hasItems = node.items.length > 0;
  const canToggle = hasChildren || hasItems;
  const count = getNodeCount(node);
  const paddingLeft = `${(depth - 1) * 14}px`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (canToggle) {
            onToggle(node.path);
          }
        }}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
        style={{ paddingLeft }}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
            isExpanded
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
          }`}
        >
          <ChevronRight
            className={`h-3 w-3 transition ${isExpanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <Folder className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 truncate">{node.displayName}</span>
        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
          {count}
        </span>
      </button>

      {isExpanded ? (
        <div className="mt-1 space-y-1">
          {hasChildren
            ? node.children.map((child) => (
                <TagNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelectItem={onSelectItem}
                  onContextMenu={onContextMenu}
                  selectedItemId={selectedItemId}
                />
              ))
            : null}
          {hasItems
            ? node.items.map((item) => (
                <TagItemRow
                  key={item.id}
                  item={item}
                  depth={depth + 1}
                  onSelectItem={onSelectItem}
                  onContextMenu={onContextMenu}
                  selectedItemId={selectedItemId}
                  t={t}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function getNodeCount(node: TagDisplayNode): number {
  let total = node.items.length;
  for (const child of node.children) {
    total += getNodeCount(child);
  }
  return total;
}

function compactNodes(nodes: TagTreeNode[]): TagDisplayNode[] {
  return nodes.map((node) => compactNode(node));
}

function compactNode(node: TagTreeNode): TagDisplayNode {
  let current = node;
  const names = [node.name];

  while (current.items.length === 0 && current.children.length === 1) {
    current = current.children[0];
    names.push(current.name);
  }

  const children = current.children.map((child) => compactNode(child));

  return {
    ...current,
    displayName: names.join("/"),
    children
  };
}

function TagItemRow({
  item,
  depth,
  onSelectItem,
  onContextMenu,
  selectedItemId,
  t
}: {
  item: TagTreeItem;
  depth: number;
  onSelectItem: (id: string) => void;
  onContextMenu: (item: TagTreeItem, event: React.MouseEvent<HTMLButtonElement>) => void;
  selectedItemId: string | null;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const isActive = selectedItemId === item.id;
  const paddingLeft = `${depth * 14 + 8}px`;
  const title = item.title?.trim() || t("common.untitled");

  return (
    <button
      type="button"
      onClick={() => onSelectItem(item.id)}
      onContextMenu={(event) => onContextMenu(item, event)}
      className={`flex w-full flex-col gap-1 rounded-xl px-2 py-1 text-left text-sm transition ${
        isActive
          ? "bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-500/10 dark:text-emerald-100"
        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
      }`}
      style={{ paddingLeft }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 truncate">{title}</span>
        {!item.is_read ? (
          <span className="h-2 w-2 rounded-full bg-amber-400" />
        ) : null}
      </div>
    </button>
  );
}
