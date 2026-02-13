"use client";

import type { Content } from "@tiptap/react";
import { useQueryClient } from "@tanstack/react-query";
import { MainMinimalTiptapEditor } from "@/components/ui/minimal-tiptap";
import { ToolbarButton } from "@/components/ui/minimal-tiptap/components/toolbar-button";
import { useMinimalTiptapEditor } from "@/components/ui/minimal-tiptap/hooks/use-minimal-tiptap";
import { fileToBase64 } from "@/components/ui/minimal-tiptap/utils";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { toast } from "sonner";

import { polishItemContentStream, updateItem } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";

type SaveState = "idle" | "saving" | "saved" | "error";
type ItemMarkdownEditorProps = {
  itemId: string;
  initialContent: string | null;
  sourceType?: string | null;
  processingStatus?: string | null;
  token?: string;
  analysisActions?: ReactNode;
};

function toHtml(value: Content | null | undefined): string {
  return typeof value === "string" ? value : "";
}

export default function ItemMarkdownEditor({
  itemId,
  initialContent,
  sourceType,
  processingStatus,
  token: tokenProp,
  analysisActions
}: ItemMarkdownEditorProps) {
  const { data: session } = useSession();
  const token = tokenProp ?? session?.accessToken;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [typedMarkdown, setTypedMarkdown] = useState("");
  const isPolishingRef = useRef(false);
  const prePolishContentRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const lastSavedRef = useRef(initialContent ?? "");
  const lastAppliedContentRef = useRef(initialContent ?? "");
  const currentContentRef = useRef(initialContent ?? "");
  const streamBufferRef = useRef("");
  const typingTimerRef = useRef<number | null>(null);
  const streamDoneRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const polishAbortRef = useRef<AbortController | null>(null);

  const handleChange = useCallback((value: Content) => {
    const html = toHtml(value);
    currentContentRef.current = html;
    if (isPolishingRef.current) {
      return;
    }
    setIsDirty(html !== lastSavedRef.current);
  }, []);

  const editor = useMinimalTiptapEditor({
    value: initialContent ?? "",
    output: "html",
    editorClassName:
      "min-h-[240px] px-4 py-3 font-serif text-[length:var(--editor-font-size)] leading-[var(--editor-line-height)] text-neutral-700 dark:text-neutral-200",
    onUpdate: handleChange,
    uploader: fileToBase64
  });

  const saveNow = useCallback(async () => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }
    const savePromise = (async () => {
      try {
        const html = editor?.getHTML?.() ?? currentContentRef.current;
        if (html === lastSavedRef.current) {
          setIsDirty(false);
          return true;
        }

        if (!token) {
          setSaveState("error");
          return false;
        }

        setSaveState("saving");
        await updateItem(
          itemId,
          { content_text: html, content_format: "html" },
          { token }
        );
        lastSavedRef.current = html;
        setSaveState("idle");
        setIsDirty(false);
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ["items"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("deepsave:item-content-saved", {
              detail: { itemId }
            })
          );
        }
        return true;
      } catch (error) {
        setSaveState("error");
        return false;
      } finally {
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = savePromise;
    return savePromise;
  }, [editor, itemId, queryClient, token]);

  const isProcessing = ["pending", "processing"].includes(
    (processingStatus ?? "").toLowerCase()
  );
  const canPolish = Boolean(sourceType && sourceType !== "image");
  const polishBusy = isPolishing || isProcessing;

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const stopPolishing = useCallback(() => {
    isPolishingRef.current = false;
    setIsPolishing(false);
  }, []);

  const restorePrePolishContent = useCallback(() => {
    const previous = prePolishContentRef.current;
    if (previous === null || !editor) {
      return;
    }
    editor.commands.setContent(previous, { emitUpdate: false });
    lastAppliedContentRef.current = previous;
    currentContentRef.current = previous;
    setIsDirty(false);
  }, [editor]);

  const startTyping = useCallback(() => {
    if (typingTimerRef.current) {
      return;
    }
    typingTimerRef.current = window.setInterval(() => {
      const pending = streamBufferRef.current;
      if (!pending) {
        if (streamDoneRef.current) {
          stopTyping();
          stopPolishing();
        }
        return;
      }
      const take = Math.min(pending.length, 4);
      const chunk = pending.slice(0, take);
      streamBufferRef.current = pending.slice(take);
      setTypedMarkdown((prev) => prev + chunk);
    }, 20);
  }, [stopPolishing, stopTyping]);

  const applyPolishResult = useCallback(
    (payload: {
      title?: string | null;
      content_html?: string | null;
      content_revision?: number;
      analysis_revision?: number;
    }) => {
      const nextHtml = payload.content_html ?? "";
      const nextTitle = payload.title ?? "";
      if (editor) {
        editor.commands.setContent(nextHtml, { emitUpdate: false });
      }
      lastSavedRef.current = nextHtml;
      lastAppliedContentRef.current = nextHtml;
      currentContentRef.current = nextHtml;
      setIsDirty(false);
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["items"] });
        queryClient.invalidateQueries({ queryKey: ["search"] });
        queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("deepsave:item-polished", {
            detail: {
              itemId,
              title: nextTitle,
              contentRevision: payload.content_revision,
              analysisRevision: payload.analysis_revision
            }
          })
        );
      }
      prePolishContentRef.current = null;
    },
    [editor, itemId, queryClient]
  );

  const handlePolish = useCallback(async () => {
    if (!token || !canPolish || polishBusy) {
      return;
    }
    if (isDirty) {
      const saved = await saveNow();
      if (!saved) {
        toast.error(t("detail.polishSaveError"));
        return;
      }
    }
    if (polishAbortRef.current) {
      polishAbortRef.current.abort();
    }
    const controller = new AbortController();
    polishAbortRef.current = controller;
    prePolishContentRef.current = editor?.getHTML?.() ?? currentContentRef.current;
    isPolishingRef.current = true;
    setIsPolishing(true);
    streamDoneRef.current = false;
    streamBufferRef.current = "";
    setTypedMarkdown("");
    if (editor) {
      editor.commands.setContent("", { emitUpdate: false });
      lastAppliedContentRef.current = "";
      currentContentRef.current = "";
      setIsDirty(false);
    }
    startTyping();
    try {
      const response = await polishItemContentStream(itemId, {
        token,
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error("Stream unavailable");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";
      let dataLines: string[] = [];

      const flushEvent = () => {
        if (dataLines.length === 0) {
          return;
        }
        const data = dataLines.join("\n");
        dataLines = [];
        const name = eventName;
        eventName = "message";
        try {
          const payload = JSON.parse(data);
          if (name === "chunk") {
            const delta = payload?.delta;
            if (typeof delta === "string" && delta) {
              streamBufferRef.current += delta;
              startTyping();
            }
          } else if (name === "done") {
            streamDoneRef.current = true;
            applyPolishResult(payload);
          } else if (name === "error") {
            streamDoneRef.current = true;
            toast.error(payload?.message || t("detail.polishError"));
            streamBufferRef.current = "";
            setTypedMarkdown("");
            stopTyping();
            stopPolishing();
            restorePrePolishContent();
          }
        } catch (error) {
          // ignore malformed payloads
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "") {
            flushEvent();
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
      }
      flushEvent();
      if (!streamDoneRef.current) {
        streamDoneRef.current = true;
        toast.error(t("detail.polishError"));
        streamBufferRef.current = "";
        setTypedMarkdown("");
        stopTyping();
        stopPolishing();
        restorePrePolishContent();
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        toast.error(t("detail.polishError"));
      }
      streamDoneRef.current = true;
      streamBufferRef.current = "";
      setTypedMarkdown("");
      restorePrePolishContent();
      stopTyping();
      stopPolishing();
    }
  }, [
    editor,
    canPolish,
    applyPolishResult,
    isDirty,
    itemId,
    polishBusy,
    restorePrePolishContent,
    saveNow,
    startTyping,
    stopPolishing,
    stopTyping,
    t,
    token
  ]);

  useEffect(() => {
    return () => {
      if (polishAbortRef.current) {
        polishAbortRef.current.abort();
      }
      stopTyping();
    };
  }, [itemId, stopTyping]);

  useEffect(() => {
    setIsPolishing(false);
    isPolishingRef.current = false;
    prePolishContentRef.current = null;
    streamDoneRef.current = false;
    streamBufferRef.current = "";
    setTypedMarkdown("");
  }, [itemId]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!isPolishing);
  }, [editor, isPolishing]);

  useEffect(() => {
    if (!overlayRef.current) {
      return;
    }
    overlayRef.current.scrollTop = overlayRef.current.scrollHeight;
  }, [typedMarkdown]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const nextContent = initialContent ?? "";
    if (nextContent === lastAppliedContentRef.current) {
      return;
    }
    lastAppliedContentRef.current = nextContent;
    editor.commands.setContent(nextContent, { emitUpdate: false });
    lastSavedRef.current = nextContent;
    currentContentRef.current = nextContent;
    setIsDirty(false);
  }, [editor, initialContent]);

  const statusText = useMemo(() => {
    if (saveState === "error") {
      return t("detail.editorSaveError");
    }
    return "";
  }, [saveState, t]);

  const toolbarRight = useMemo(() => {
    if (!analysisActions && !isDirty && !canPolish) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        {analysisActions}
        {canPolish ? (
          <ToolbarButton
            tooltip={
              polishBusy
                ? t("detail.polishing")
                : t("detail.polish")
            }
            aria-label={
              polishBusy
                ? t("detail.polishing")
                : t("detail.polish")
            }
            onClick={handlePolish}
            disabled={polishBusy}
          >
            {polishBusy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
          </ToolbarButton>
        ) : null}
        {isDirty ? (
          <ToolbarButton
            tooltip={saveState === "saving" ? t("detail.saving") : t("detail.save")}
            aria-label={saveState === "saving" ? t("detail.saving") : t("detail.save")}
            onClick={() => saveNow()}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? <Loader2 className="animate-spin" /> : <Save />}
          </ToolbarButton>
        ) : null}
      </div>
    );
  }, [
    analysisActions,
    canPolish,
    handlePolish,
    isDirty,
    polishBusy,
    saveNow,
    saveState,
    t
  ]);

  return (
    <div className="space-y-3">
      {statusText ? (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {statusText}
        </div>
      ) : null}
      {editor ? (
        <div className="relative">
          <MainMinimalTiptapEditor
            editor={editor}
            className="bg-white/85 dark:bg-neutral-950/60"
            toolbarRight={toolbarRight ?? undefined}
          />
          {isPolishing ? (
            <div
              ref={overlayRef}
              className="pointer-events-none absolute inset-x-0 bottom-0 top-12 overflow-y-auto bg-white px-4 py-3 text-[length:var(--editor-font-size)] leading-[var(--editor-line-height)] text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
            >
              <div className="whitespace-pre-wrap font-serif">
                {typedMarkdown}
                <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-emerald-400 align-middle" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
