import dynamicImport from "next/dynamic";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { authOptions } from "../../../lib/auth";
import { fetchItemDetail, updateItem } from "../../../lib/fetchers";
import { getStatusLabel, getTypeLabel } from "../../../lib/i18n";
import { getServerTranslator } from "../../../lib/i18n-server";
import BottomTabBar from "../../../components/bottom-tab-bar";
import ItemAnalysisActions from "../../../components/item-analysis-actions";
import ItemEditorFallback from "../../../components/item-editor-fallback";
import ItemTitleEditor from "../../../components/item-title-editor";
import Sidebar from "../../../components/sidebar";

export const dynamic = "force-dynamic";

const ItemMarkdownEditor = dynamicImport(
  () => import("../../../components/item-markdown-editor"),
  {
    ssr: false,
    loading: () => <ItemEditorFallback />
  }
);

function summaryLines(summary: string | null) {
  if (!summary) {
    return [] as string[];
  }
  return summary
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export default async function ItemDetailPage({
  params
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/login");
  }
  const { locale, t } = getServerTranslator();

  const item = await fetchItemDetail(params.id, {
    token: session.accessToken
  }).catch(() => null);
  if (!item) {
    notFound();
  }

  if (!item.is_read) {
    try {
      await updateItem(item.id, { is_read: true }, { token: session.accessToken });
    } catch (error) {
      // Ignore read state failures to keep the page usable.
    }
  }

  const lines = summaryLines(item.summary);
  const tags = item.cached_tags ? item.cached_tags.split(" ").filter(Boolean) : [];
  const palette = Array.isArray(item.meta_json?.palette)
    ? (item.meta_json.palette as string[]).slice(0, 6)
    : [];
  const typeLabel = getTypeLabel(locale, item.source_type);
  const statusLabel = getStatusLabel(locale, item.processing_status);
  const createdAtLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(item.created_at));

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
      <div className="relative mx-auto min-h-screen w-full max-w-[var(--note-max-width)] px-6 pt-10 pb-[calc(2.5rem+var(--bottom-tab-height)+env(safe-area-inset-bottom))] md:py-10 md:pl-20">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="min-w-0 rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <div className="mt-4">
                <ItemTitleEditor
                  itemId={item.id}
                  initialTitle={item.title}
                  token={session.accessToken}
                />
              </div>
              {item.processing_status !== "completed" ? (
                <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  {t("detail.processingNotice")}
                </div>
              ) : null}

              <div className="mt-8 min-w-0 text-sm leading-7 text-neutral-700 dark:text-neutral-200">
                <ItemMarkdownEditor
                  itemId={item.id}
                  initialContent={item.content_text}
                  sourceType={item.source_type}
                  processingStatus={item.processing_status}
                  token={session.accessToken}
                  analysisActions={
                    <ItemAnalysisActions
                      itemId={item.id}
                      contentRevision={item.content_revision}
                      analysisRevision={item.analysis_revision}
                      processingStatus={item.processing_status}
                      token={session.accessToken}
                    />
                  }
                />
              </div>

              <div className="mt-6 space-y-3 md:hidden">
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
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 transition hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      {t("detail.openOriginal")}
                    </a>
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
                          title={color}
                          className="h-6 w-6 rounded-full border border-white/70 shadow"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>

            <aside className="hidden flex-col gap-4 md:flex">
              <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                  {t("detail.metadata")}
                </p>
                <div className="mt-4 space-y-3 text-xs text-neutral-500 dark:text-neutral-400">
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
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500 transition hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  {t("detail.openOriginal")}
                </a>
              </div>

              <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
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
                <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
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
                <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
                  <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                    {t("detail.palette")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {palette.map((color) => (
                      <span
                        key={color}
                        title={color}
                        className="h-6 w-6 rounded-full border border-white/70 shadow"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}
