"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateItem } from "../lib/fetchers";
import { useI18n } from "../lib/i18n-provider";

type ItemTitleEditorProps = {
  itemId: string;
  initialTitle: string | null;
  token?: string;
  className?: string;
};

export default function ItemTitleEditor({
  itemId,
  initialTitle,
  token: tokenProp,
  className
}: ItemTitleEditorProps) {
  const { data: session } = useSession();
  const token = tokenProp ?? session?.accessToken;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedRef = useRef(initialTitle ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isFocused) {
      return;
    }
    const nextTitle = initialTitle ?? "";
    lastSavedRef.current = nextTitle;
    setTitle(nextTitle);
  }, [initialTitle, isFocused]);

  useEffect(() => {
    const handlePolished = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        itemId?: string;
        title?: string | null;
      };
      if (detail?.itemId !== itemId) {
        return;
      }
      const nextTitle = detail.title ?? "";
      lastSavedRef.current = nextTitle;
      if (!isFocused) {
        setTitle(nextTitle);
      }
    };
    window.addEventListener("deepsave:item-polished", handlePolished);
    return () => {
      window.removeEventListener("deepsave:item-polished", handlePolished);
    };
  }, [isFocused, itemId]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, title]);

  const commitTitle = useCallback(async () => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }
    const savePromise = (async () => {
      const normalized = title.trim();
      const nextTitle = normalized;
      if (nextTitle === lastSavedRef.current) {
        if (title !== nextTitle) {
          setTitle(nextTitle);
        }
        return;
      }
      if (!token) {
        toast.error(t("detail.editorSaveError"));
        return;
      }
      try {
        const result = await updateItem(
          itemId,
          { title: nextTitle === "" ? null : nextTitle },
          { token }
        );
        const updatedTitle = result.title ?? "";
        lastSavedRef.current = updatedTitle;
        setTitle(updatedTitle);
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ["items"] });
          queryClient.invalidateQueries({ queryKey: ["search"] });
        });
      } catch (error) {
        toast.error(t("detail.editorSaveError"));
      }
    })();
    savePromiseRef.current = savePromise;
    await savePromise;
    savePromiseRef.current = null;
  }, [itemId, queryClient, t, title, token]);

  return (
    <textarea
      ref={textareaRef}
      value={title}
      rows={1}
      onChange={(event) => setTitle(event.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        void commitTitle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLTextAreaElement).blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setTitle(lastSavedRef.current);
          (event.target as HTMLTextAreaElement).blur();
        }
      }}
      placeholder={t("common.untitled")}
      aria-label={t("detail.titleLabel")}
      className={`w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-50 dark:placeholder:text-neutral-500 sm:text-4xl ${className ?? ""}`}
    />
  );
}
