"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ToolbarButton } from "@/components/ui/minimal-tiptap/components/toolbar-button";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

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
  const [localContentRevision, setLocalContentRevision] =
    useState(contentRevision);
  const [localAnalysisRevision, setLocalAnalysisRevision] =
    useState(analysisRevision);
  const shownStaleToastRef = useRef(false);

  const isFailed = ["failed", "partial_fail"].includes(processingStatus);
  const isWorking = ["pending", "processing"].includes(processingStatus);
  const isStale =
    localContentRevision > localAnalysisRevision && !isWorking;

  useEffect(() => {
    setLocalContentRevision(contentRevision);
    setLocalAnalysisRevision(analysisRevision);
  }, [analysisRevision, contentRevision]);

  useEffect(() => {
    if (isStale && !shownStaleToastRef.current) {
      toast.info(t("detail.analysisOutdated"), {
        id: `analysis-outdated-${itemId}`
      });
      shownStaleToastRef.current = true;
      return;
    }
    if (!isStale) {
      shownStaleToastRef.current = false;
    }
  }, [isStale, itemId, t]);

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

  useEffect(() => {
    const handlePolished = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        itemId?: string;
        contentRevision?: number;
        analysisRevision?: number;
      };
      if (detail?.itemId !== itemId) {
        return;
      }
      if (typeof detail.contentRevision === "number") {
        setLocalContentRevision(detail.contentRevision);
      }
      if (typeof detail.analysisRevision === "number") {
        setLocalAnalysisRevision(detail.analysisRevision);
      }
    };
    window.addEventListener("deepsave:item-polished", handlePolished);
    return () => {
      window.removeEventListener("deepsave:item-polished", handlePolished);
    };
  }, [itemId]);

  if (!isStale && !isFailed) {
    return null;
  }

  const handleReprocess = async () => {
    if (!token || busy || isWorking) {
      return;
    }
    setBusy(true);
    try {
      await reprocessItemContent(itemId, { token });
      setLocalAnalysisRevision((prev) => Math.max(prev, localContentRevision));
      window.dispatchEvent(
        new CustomEvent("deepsave:item-reprocess", { detail: { itemId } })
      );
    } catch (err) {
      toast.error(t("detail.editorReprocessError"), {
        id: `analysis-reprocess-error-${itemId}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      <ToolbarButton
        tooltip={busy || isWorking ? t("detail.reprocessing") : t("detail.reprocess")}
        aria-label={busy || isWorking ? t("detail.reprocessing") : t("detail.reprocess")}
        onClick={handleReprocess}
        disabled={busy || isWorking}
      >
        {busy || isWorking ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RotateCw />
        )}
      </ToolbarButton>
    </div>
  );
}
