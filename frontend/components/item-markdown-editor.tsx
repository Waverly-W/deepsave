"use client";

import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "tiptap-markdown";

import { updateItem } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";

type SaveState = "idle" | "saving" | "saved" | "error";
type ItemMarkdownEditorProps = {
  itemId: string;
  initialContent: string | null;
  token?: string;
};

function getMarkdown(editor: ReturnType<typeof useEditor>): string {
  const markdown = editor?.storage?.markdown?.getMarkdown?.();
  if (typeof markdown === "string") {
    return markdown;
  }
  return editor?.getText() ?? "";
}

export default function ItemMarkdownEditor({
  itemId,
  initialContent,
  token: tokenProp
}: ItemMarkdownEditorProps) {
  const { data: session } = useSession();
  const token = tokenProp ?? session?.accessToken;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const draftRef = useRef(initialContent ?? "");
  const lastSavedRef = useRef(initialContent ?? "");

  const extensions = useMemo(
    () => [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({
        html: true,
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true
      })
    ],
    []
  );
  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          "tiptap-editor font-serif text-sm leading-7 text-neutral-700 dark:text-neutral-200"
      }
    }),
    []
  );

  const editor = useEditor({
    extensions,
    content: initialContent ?? "",
    onCreate: ({ editor }) => {
      const markdown = getMarkdown(editor);
      draftRef.current = markdown;
      lastSavedRef.current = markdown;
      setIsDirty(false);
    },
    editorProps
  });

  const saveNow = useCallback(async () => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }
    const savePromise = (async () => {
      try {
        const markdown = editor ? getMarkdown(editor) : draftRef.current;
        draftRef.current = markdown;
        if (markdown === lastSavedRef.current) {
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
          { content_text: markdown },
          { token }
        );
        lastSavedRef.current = markdown;
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

  useEffect(() => {
    if (!editor) {
      return undefined;
    }
    const handleUpdate = () => {
      const markdown = getMarkdown(editor);
      draftRef.current = markdown;
      setIsDirty(markdown !== lastSavedRef.current);
    };
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  const statusText = useMemo(() => {
    if (saveState === "error") {
      return t("detail.editorSaveError");
    }
    return "";
  }, [saveState, t]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {isDirty ? (
          <button
            type="button"
            onClick={() => saveNow()}
            disabled={saveState === "saving"}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            {saveState === "saving" ? t("detail.saving") : t("detail.save")}
          </button>
        ) : null}
      </div>
      {statusText ? (
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {statusText}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
