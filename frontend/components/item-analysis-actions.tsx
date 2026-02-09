"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { reprocessItemContent } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";

type ItemAnalysisActionsProps = {
  itemId: string;
  contentRevision: number;
  analysisRevision: number;
  processingStatus: string;
  token?: string;
};

export default function ItemAnalysisActions({
  itemId,
  contentRevision,
  analysisRevision,
  processingStatus,
  token: tokenProp
}: ItemAnalysisActionsProps) {
  const { data: session } = useSession();
  const token = tokenProp ?? session?.accessToken;
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [localContentRevision, setLocalContentRevision] =
    useState(contentRevision);
  const [localAnalysisRevision, setLocalAnalysisRevision] =
    useState(analysisRevision);

  const isFailed = ["failed", "partial_fail"].includes(processingStatus);
  const isWorking = ["pending", "processing"].includes(processingStatus);
  const isStale =
    localContentRevision > localAnalysisRevision && !isWorking;

  useEffect(() => {
    setLocalContentRevision(contentRevision);
    setLocalAnalysisRevision(analysisRevision);
  }, [analysisRevision, contentRevision]);

  useEffect(() => {
    const handleSaved = (event: Event) => {
      const detail = (event as CustomEvent).detail as { itemId?: string };
      if (detail?.itemId !== itemId) {
        return;
      }
      setLocalContentRevision((prev) => prev + 1);
    };
    window.addEventListener("deepsave:item-content-saved", handleSaved);
    return () => {
      window.removeEventListener("deepsave:item-content-saved", handleSaved);
    };
  }, [itemId]);

  if (!isStale && !isFailed) {
    return null;
  }

  const handleReprocess = async () => {
    if (!token || busy || isWorking) {
      return;
    }
    setError(false);
    setBusy(true);
    try {
      await reprocessItemContent(itemId, { token });
      setLocalAnalysisRevision((prev) => Math.max(prev, localContentRevision));
    } catch (err) {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      {isStale ? (
        <span className="rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {t("detail.analysisOutdated")}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleReprocess}
        disabled={busy || isWorking}
        className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
      >
        {busy || isWorking ? t("detail.reprocessing") : t("detail.reprocess")}
      </button>
      {error ? (
        <span className="text-rose-500">{t("detail.editorReprocessError")}</span>
      ) : null}
    </div>
  );
}
