"use client";

import type { Content } from "@tiptap/react";
import { useMinimalTiptapEditor } from "@/components/ui/minimal-tiptap/hooks/use-minimal-tiptap";
import { MainMinimalTiptapEditor } from "@/components/ui/minimal-tiptap";
import { ToolbarButton } from "@/components/ui/minimal-tiptap/components/toolbar-button";
import { fileToBase64 } from "@/components/ui/minimal-tiptap/utils";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { toast } from "sonner";

import {
  createNote,
  polishDraftStream
} from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";

type DraftNoteEditorProps = {
  token?: string;
  onSaved: (itemId: string) => void;
};

type PolishedAnalysis = {
  summary: string;
  tags: string[];
  contentHtml: string;
};

function toHtml(value: Content | null | undefined): string {
  return typeof value === "string" ? value : "";
}

export default function DraftNoteEditor({
  token: tokenProp,
  onSaved
}: DraftNoteEditorProps) {
  const { data: session } = useSession();
  const token = tokenProp ?? session?.accessToken;
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [typedMarkdown, setTypedMarkdown] = useState("");
  const [polishedAnalysis, setPolishedAnalysis] = useState<PolishedAnalysis | null>(
    null
  );
  const streamBufferRef = useRef("");
  const typingTimerRef = useRef<number | null>(null);
  const streamDoneRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const polishAbortRef = useRef<AbortController | null>(null);
  const prePolishContentRef = useRef<string | null>(null);
  const lastPolishedHtmlRef = useRef<string | null>(null);
  const isPolishingRef = useRef(false);

  const editor = useMinimalTiptapEditor({
    value: "",
    output: "html",
    editorClassName:
      "min-h-[240px] px-4 py-3 font-serif text-[length:var(--editor-font-size)] leading-[var(--editor-line-height)] text-neutral-700 dark:text-neutral-200",
    onUpdate: (value) => {
      const html = toHtml(value);
      if (isPolishingRef.current) {
        return;
      }
      if (polishedAnalysis && html !== lastPolishedHtmlRef.current) {
        setPolishedAnalysis(null);
        lastPolishedHtmlRef.current = null;
      }
    },
    uploader: fileToBase64
  });

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
    if (!editor || previous === null) {
      return;
    }
    editor.commands.setContent(previous, { emitUpdate: false });
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

  const handleSave = useCallback(async () => {
    if (!token || !editor || isSaving) {
      return;
    }
    const html = editor.getHTML().trim();
    if (!html) {
      toast.error(t("detail.polishSaveError"));
      return;
    }
    const skipQueue = Boolean(
      polishedAnalysis &&
        html === lastPolishedHtmlRef.current &&
        polishedAnalysis.tags.length > 0
    );
    setIsSaving(true);
    try {
      const response = await createNote(
        {
          title: title.trim() || null,
          content_html: html,
          summary: skipQueue ? polishedAnalysis?.summary ?? null : null,
          tags: skipQueue ? polishedAnalysis?.tags ?? null : null,
          skip_queue: skipQueue
        },
        { token }
      );
      onSaved(response.item_id);
    } catch (error) {
      toast.error(t("detail.editorSaveError"));
    } finally {
      setIsSaving(false);
    }
  }, [editor, isSaving, onSaved, polishedAnalysis, t, title, token]);

  const handlePolish = useCallback(async () => {
    if (!token || !editor || isPolishing) {
      return;
    }
    const html = editor.getHTML();
    if (!html.trim()) {
      toast.error(t("detail.polishError"));
      return;
    }
    if (polishAbortRef.current) {
      polishAbortRef.current.abort();
    }
    const controller = new AbortController();
    polishAbortRef.current = controller;
    prePolishContentRef.current = html;
    isPolishingRef.current = true;
    setIsPolishing(true);
    streamDoneRef.current = false;
    streamBufferRef.current = "";
    setTypedMarkdown("");
    editor.commands.setContent("", { emitUpdate: false });
    startTyping();
    try {
      const response = await polishDraftStream(
        {
          title: title.trim() || null,
          content_html: html
        },
        { token, signal: controller.signal }
      );
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
            const nextHtml = payload?.content_html ?? "";
            const nextTitle = payload?.title ?? "";
            const summary = payload?.summary ?? "";
            const tags = Array.isArray(payload?.tags) ? payload.tags : [];
            editor.commands.setContent(nextHtml, { emitUpdate: false });
            setTitle(nextTitle);
            setPolishedAnalysis({
              summary,
              tags,
              contentHtml: nextHtml
            });
            lastPolishedHtmlRef.current = nextHtml;
            stopTyping();
            stopPolishing();
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
      stopTyping();
      stopPolishing();
      restorePrePolishContent();
    }
  }, [editor, isPolishing, startTyping, stopPolishing, stopTyping, t, title, token, restorePrePolishContent]);

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
    return () => {
      if (polishAbortRef.current) {
        polishAbortRef.current.abort();
      }
      stopTyping();
    };
  }, [stopTyping]);

  const toolbarRight = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <ToolbarButton
          tooltip={isPolishing ? t("detail.polishing") : t("detail.polish")}
          aria-label={isPolishing ? t("detail.polishing") : t("detail.polish")}
          onClick={handlePolish}
          disabled={isPolishing}
        >
          {isPolishing ? <Loader2 className="animate-spin" /> : <Sparkles />}
        </ToolbarButton>
        <ToolbarButton
          tooltip={isSaving ? t("detail.saving") : t("detail.save")}
          aria-label={isSaving ? t("detail.saving") : t("detail.save")}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
        </ToolbarButton>
      </div>
    );
  }, [handlePolish, handleSave, isPolishing, isSaving, t]);

  return (
    <div className="space-y-4">
      <textarea
        value={title}
        rows={1}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("common.untitled")}
        aria-label={t("detail.titleLabel")}
        className="w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-50 dark:placeholder:text-neutral-500 sm:text-4xl"
      />
      {editor ? (
        <div className="relative">
          <MainMinimalTiptapEditor
            editor={editor}
            className="bg-white/85 dark:bg-neutral-950/60"
            toolbarRight={toolbarRight}
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
