"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TranslationKey } from "../../lib/i18n";
import { LANGUAGE_OPTIONS } from "../../lib/i18n";
import { apiBaseUrl } from "../../lib/api";
import {
  createAccessToken,
  listAccessTokens,
  fetchAiSettings,
  revokeAccessToken,
  testAiSettings,
  updateAiSettings
} from "../../lib/fetchers";
import { useI18n } from "../../lib/i18n-provider";
import type { AccessTokenItem, AiSettingsUpdate } from "../../lib/types";
import {
  type EditorTextSize,
  type NoteWidth,
  usePreferences
} from "../../lib/preferences";
import BottomTabBar from "../../components/bottom-tab-bar";
import Sidebar from "../../components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";

type ThemeMode = "system" | "light" | "dark";
type SettingsTab = "appearance" | "editor" | "accessToken" | "ai" | "prompts";
type PromptField =
  | "summarySystemPrompt"
  | "summaryUserPromptTemplate"
  | "polishSystemPrompt"
  | "polishUserPromptTemplate"
  | "visionUserPrompt";
type PromptPayloadField =
  | "summary_system_prompt"
  | "summary_user_prompt_template"
  | "polish_system_prompt"
  | "polish_user_prompt_template"
  | "vision_user_prompt";

type SettingsShellProps = {
  userLabel?: string;
};

type PromptDefinition = {
  field: PromptField;
  payloadField: PromptPayloadField;
  taskKey: TranslationKey;
  typeKey: TranslationKey;
  placeholderKey: TranslationKey;
  variablesKey?: TranslationKey;
  rows: number;
};

type PromptTaskGroup = {
  taskKey: TranslationKey;
  fields: PromptField[];
};

const THEME_OPTIONS: {
  value: ThemeMode;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}[] = [
  {
    value: "system",
    labelKey: "settings.theme.option.system.label",
    hintKey: "settings.theme.option.system.hint"
  },
  {
    value: "light",
    labelKey: "settings.theme.option.light.label",
    hintKey: "settings.theme.option.light.hint"
  },
  {
    value: "dark",
    labelKey: "settings.theme.option.dark.label",
    hintKey: "settings.theme.option.dark.hint"
  }
];

const NOTE_WIDTH_OPTIONS: {
  value: NoteWidth;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}[] = [
  {
    value: "compact",
    labelKey: "settings.noteWidth.option.compact.label",
    hintKey: "settings.noteWidth.option.compact.hint"
  },
  {
    value: "default",
    labelKey: "settings.noteWidth.option.default.label",
    hintKey: "settings.noteWidth.option.default.hint"
  },
  {
    value: "wide",
    labelKey: "settings.noteWidth.option.wide.label",
    hintKey: "settings.noteWidth.option.wide.hint"
  }
];

const EDITOR_TEXT_SIZE_OPTIONS: {
  value: EditorTextSize;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}[] = [
  {
    value: "compact",
    labelKey: "settings.editorTextSize.option.compact.label",
    hintKey: "settings.editorTextSize.option.compact.hint"
  },
  {
    value: "default",
    labelKey: "settings.editorTextSize.option.default.label",
    hintKey: "settings.editorTextSize.option.default.hint"
  },
  {
    value: "large",
    labelKey: "settings.editorTextSize.option.large.label",
    hintKey: "settings.editorTextSize.option.large.hint"
  }
];

const SETTINGS_TABS: {
  value: SettingsTab;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}[] = [
  {
    value: "appearance",
    labelKey: "settings.tab.appearance.label",
    hintKey: "settings.tab.appearance.hint"
  },
  {
    value: "editor",
    labelKey: "settings.tab.editor.label",
    hintKey: "settings.tab.editor.hint"
  },
  {
    value: "accessToken",
    labelKey: "settings.tab.accessToken.label",
    hintKey: "settings.tab.accessToken.hint"
  },
  {
    value: "ai",
    labelKey: "settings.tab.ai.label",
    hintKey: "settings.tab.ai.hint"
  },
  {
    value: "prompts",
    labelKey: "settings.tab.prompts.label",
    hintKey: "settings.tab.prompts.hint"
  }
];

const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    field: "summarySystemPrompt",
    payloadField: "summary_system_prompt",
    taskKey: "settings.ai.prompts.summary.title",
    typeKey: "settings.ai.prompts.systemPrompt",
    placeholderKey: "settings.ai.prompts.summary.system.placeholder",
    rows: 5
  },
  {
    field: "summaryUserPromptTemplate",
    payloadField: "summary_user_prompt_template",
    taskKey: "settings.ai.prompts.summary.title",
    typeKey: "settings.ai.prompts.userTemplate",
    placeholderKey: "settings.ai.prompts.summary.user.placeholder",
    variablesKey: "settings.ai.prompts.summary.variables",
    rows: 10
  },
  {
    field: "polishSystemPrompt",
    payloadField: "polish_system_prompt",
    taskKey: "settings.ai.prompts.polish.title",
    typeKey: "settings.ai.prompts.systemPrompt",
    placeholderKey: "settings.ai.prompts.polish.system.placeholder",
    rows: 5
  },
  {
    field: "polishUserPromptTemplate",
    payloadField: "polish_user_prompt_template",
    taskKey: "settings.ai.prompts.polish.title",
    typeKey: "settings.ai.prompts.userTemplate",
    placeholderKey: "settings.ai.prompts.polish.user.placeholder",
    variablesKey: "settings.ai.prompts.polish.variables",
    rows: 10
  },
  {
    field: "visionUserPrompt",
    payloadField: "vision_user_prompt",
    taskKey: "settings.ai.prompts.vision.title",
    typeKey: "settings.ai.prompts.vision.prompt",
    placeholderKey: "settings.ai.prompts.vision.user.placeholder",
    variablesKey: "settings.ai.prompts.vision.variables",
    rows: 6
  }
];

const PROMPT_TASK_GROUPS: PromptTaskGroup[] = [
  {
    taskKey: "settings.ai.prompts.summary.title",
    fields: ["summarySystemPrompt", "summaryUserPromptTemplate"]
  },
  {
    taskKey: "settings.ai.prompts.polish.title",
    fields: ["polishSystemPrompt", "polishUserPromptTemplate"]
  },
  {
    taskKey: "settings.ai.prompts.vision.title",
    fields: ["visionUserPrompt"]
  }
];

function buildCurlExample(token: string): string {
  const base = apiBaseUrl();
  const payload = JSON.stringify({
    url: "https://example.com",
    source_type: "note",
    title: "Sample title",
    content_text: "Sample content"
  });
  return (
    `curl -X POST "${base}/items/ingest" \\\n` +
    `  -H "Authorization: Bearer ${token}" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '${payload}'`
  );
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
}

function normalizePromptInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

export default function SettingsShell({ userLabel }: SettingsShellProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t, locale, setLocale } = useI18n();
  const {
    noteWidth,
    setNoteWidth,
    editorTextSize,
    setEditorTextSize
  } = usePreferences();
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [label, setLabel] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenItems, setTokenItems] = useState<AccessTokenItem[]>([]);
  const [isTokenListLoading, setIsTokenListLoading] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [tokenNoticeKey, setTokenNoticeKey] = useState<TranslationKey | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copyNoticeKey, setCopyNoticeKey] = useState<TranslationKey | null>(
    null
  );
  const [aiForm, setAiForm] = useState({
    llmBaseUrl: "",
    llmModel: "",
    summarySystemPrompt: "",
    summaryUserPromptTemplate: "",
    polishSystemPrompt: "",
    polishUserPromptTemplate: "",
    visionUserPrompt: "",
    llmApiKey: "",
    embeddingBaseUrl: "",
    embeddingModel: "",
    embeddingApiKey: "",
    embeddingDimensions: ""
  });
  const [aiHasLlmKey, setAiHasLlmKey] = useState(false);
  const [aiHasEmbeddingKey, setAiHasEmbeddingKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiNoticeKey, setAiNoticeKey] = useState<TranslationKey | null>(null);
  const [aiNoticeTone, setAiNoticeTone] = useState<
    "success" | "error" | null
  >(null);
  const [aiTesting, setAiTesting] = useState<{ llm: boolean; embedding: boolean }>(
    { llm: false, embedding: false }
  );
  const [aiTestResult, setAiTestResult] = useState<{
    llm?: { ok: boolean; message: string };
    embedding?: { ok: boolean; message: string };
  }>({});
  const [aiClearing, setAiClearing] = useState<{ llm: boolean; embedding: boolean }>(
    { llm: false, embedding: false }
  );
  const [editingPromptField, setEditingPromptField] = useState<PromptField | null>(
    null
  );
  const [editingPromptValue, setEditingPromptValue] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);
  const tokenRef = useRef<HTMLTextAreaElement | null>(null);
  const curlRef = useRef<HTMLTextAreaElement | null>(null);
  const displayName = userLabel || t("common.admin");
  const curlExample = generatedToken ? buildCurlExample(generatedToken) : "";
  const editingPrompt = editingPromptField
    ? PROMPT_DEFINITIONS.find((item) => item.field === editingPromptField) ?? null
    : null;

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial: ThemeMode =
      stored === "light" || stored === "dark" ? stored : "system";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", theme);
    }
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const loadAiSettings = async () => {
      setAiNoticeKey(null);
      setAiNoticeTone(null);
      try {
        const data = await fetchAiSettings({ token });
        if (!active) {
          return;
        }
        setAiHasLlmKey(data.has_llm_api_key);
        setAiHasEmbeddingKey(data.has_embedding_api_key);
        setAiForm((prev) => ({
          ...prev,
          llmBaseUrl: data.llm_base_url ?? "",
          llmModel: data.llm_model ?? "",
          summarySystemPrompt: data.summary_system_prompt ?? "",
          summaryUserPromptTemplate: data.summary_user_prompt_template ?? "",
          polishSystemPrompt: data.polish_system_prompt ?? "",
          polishUserPromptTemplate: data.polish_user_prompt_template ?? "",
          visionUserPrompt: data.vision_user_prompt ?? "",
          embeddingBaseUrl: data.embedding_base_url ?? "",
          embeddingModel: data.embedding_model ?? "",
          embeddingDimensions: data.embedding_dimensions
            ? String(data.embedding_dimensions)
            : ""
        }));
      } catch {
        if (!active) {
          return;
        }
        setAiNoticeKey("settings.error.aiLoadFailed");
        setAiNoticeTone("error");
      }
    };

    loadAiSettings();
    return () => {
      active = false;
    };
  }, [token]);

  const loadTokenItems = useCallback(async () => {
    if (!token) {
      setTokenItems([]);
      return;
    }
    setIsTokenListLoading(true);
    try {
      const data = await listAccessTokens({ token });
      setTokenItems(data.items);
      setTokenNoticeKey(null);
    } catch {
      setTokenNoticeKey("settings.accessToken.loadFailed");
    } finally {
      setIsTokenListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTokenItems().catch(() => {
      setTokenNoticeKey("settings.accessToken.loadFailed");
    });
  }, [loadTokenItems]);

  const handleGenerate = async () => {
    if (!token) {
      setErrorKey("settings.error.notAuthenticated");
      return;
    }
    setErrorKey(null);
    setIsGenerating(true);
    setGeneratedToken(null);
    setCopiedToken(false);
    setCopiedCurl(false);
    setCopyNoticeKey(null);
    setTokenNoticeKey(null);
    try {
      const result = await createAccessToken(
        { label: label.trim() || undefined },
        { token }
      );
      setGeneratedToken(result.access_token);
      await loadTokenItems();
    } catch {
      setErrorKey("settings.error.generateFailed");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyText = async (
    value: string,
    fallbackTarget: HTMLTextAreaElement | null,
    onSuccess: () => void,
    onFailure: () => void
  ) => {
    setCopyNoticeKey(null);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        onSuccess();
        return;
      }
    } catch {
      onFailure();
    }

    if (fallbackTarget) {
      fallbackTarget.focus();
      fallbackTarget.select();
      fallbackTarget.setSelectionRange(0, fallbackTarget.value.length);
      try {
        const success = document.execCommand("copy");
        if (success) {
          onSuccess();
          return;
        }
      } catch {
        onFailure();
      }
    }
    setCopyNoticeKey("settings.accessToken.copyUnsupported");
  };

  const handleCopyToken = async () => {
    if (!generatedToken) {
      return;
    }
    await copyText(
      generatedToken,
      tokenRef.current,
      () => {
        setCopiedToken(true);
        setCopiedCurl(false);
        setTimeout(() => setCopiedToken(false), 1500);
      },
      () => setCopiedToken(false)
    );
  };

  const handleCopyCurl = async () => {
    if (!generatedToken) {
      return;
    }
    await copyText(
      buildCurlExample(generatedToken),
      curlRef.current,
      () => {
        setCopiedCurl(true);
        setCopiedToken(false);
        setTimeout(() => setCopiedCurl(false), 1500);
      },
      () => setCopiedCurl(false)
    );
  };

  const handleRevokeToken = async (keyId: string) => {
    if (!token || revokingTokenId) {
      return;
    }
    setRevokingTokenId(keyId);
    setTokenNoticeKey(null);
    try {
      await revokeAccessToken(keyId, { token });
      await loadTokenItems();
      setTokenNoticeKey("settings.accessToken.revokeSuccess");
    } catch {
      setTokenNoticeKey("settings.accessToken.revokeFailed");
    } finally {
      setRevokingTokenId(null);
    }
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    setAiNoticeKey(null);
    setAiNoticeTone(null);
    const payload = {
      llm_base_url: aiForm.llmBaseUrl.trim() || null,
      llm_model: aiForm.llmModel.trim() || null,
      summary_system_prompt: normalizePromptInput(aiForm.summarySystemPrompt),
      summary_user_prompt_template: normalizePromptInput(
        aiForm.summaryUserPromptTemplate
      ),
      polish_system_prompt: normalizePromptInput(aiForm.polishSystemPrompt),
      polish_user_prompt_template: normalizePromptInput(
        aiForm.polishUserPromptTemplate
      ),
      vision_user_prompt: normalizePromptInput(aiForm.visionUserPrompt),
      embedding_base_url: aiForm.embeddingBaseUrl.trim() || null,
      embedding_model: aiForm.embeddingModel.trim() || null,
      embedding_dimensions: null as number | null
    };
    const dimsRaw = aiForm.embeddingDimensions.trim();
    if (dimsRaw) {
      const parsed = Number(dimsRaw);
      payload.embedding_dimensions = Number.isFinite(parsed) ? parsed : null;
    }
    const llmKey = aiForm.llmApiKey.trim();
    const embeddingKey = aiForm.embeddingApiKey.trim();
    try {
      const result = await updateAiSettings(
        {
          ...payload,
          llm_api_key: llmKey || undefined,
          embedding_api_key: embeddingKey || undefined
        },
        { token }
      );
      setAiHasLlmKey(result.has_llm_api_key);
      setAiHasEmbeddingKey(result.has_embedding_api_key);
      setAiForm((prev) => ({
        ...prev,
        llmApiKey: "",
        embeddingApiKey: "",
        llmBaseUrl: result.llm_base_url ?? "",
        llmModel: result.llm_model ?? "",
        summarySystemPrompt: result.summary_system_prompt ?? "",
        summaryUserPromptTemplate: result.summary_user_prompt_template ?? "",
        polishSystemPrompt: result.polish_system_prompt ?? "",
        polishUserPromptTemplate: result.polish_user_prompt_template ?? "",
        visionUserPrompt: result.vision_user_prompt ?? "",
        embeddingBaseUrl: result.embedding_base_url ?? "",
        embeddingModel: result.embedding_model ?? "",
        embeddingDimensions: result.embedding_dimensions
          ? String(result.embedding_dimensions)
          : ""
      }));
      setAiNoticeKey("settings.ai.saved");
      setAiNoticeTone("success");
    } catch {
      setAiNoticeKey("settings.error.aiSaveFailed");
      setAiNoticeTone("error");
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAi = async (target: "llm" | "embedding") => {
    setAiTesting((prev) => ({ ...prev, [target]: true }));
    try {
      const result = await testAiSettings({ target }, { token });
      if (target === "llm") {
        const ok = Boolean(result.llm_ok);
        const ms = result.llm_latency_ms;
        const reason = result.llm_error || "unknown";
        setAiTestResult((prev) => ({
          ...prev,
          llm: {
            ok,
            message: ok
              ? t("settings.ai.testSuccess", { ms: ms ?? "-" })
              : t("settings.ai.testFailed", { reason })
          }
        }));
      } else {
        const ok = Boolean(result.embedding_ok);
        const ms = result.embedding_latency_ms;
        const reason = result.embedding_error || "unknown";
        setAiTestResult((prev) => ({
          ...prev,
          embedding: {
            ok,
            message: ok
              ? t("settings.ai.testSuccess", { ms: ms ?? "-" })
              : t("settings.ai.testFailed", { reason })
          }
        }));
      }
    } catch {
      const message = t("settings.ai.testFailed", { reason: "request_failed" });
      setAiTestResult((prev) => ({
        ...prev,
        [target]: { ok: false, message }
      }));
    } finally {
      setAiTesting((prev) => ({ ...prev, [target]: false }));
    }
  };

  const handleClearKey = async (target: "llm" | "embedding") => {
    setAiClearing((prev) => ({ ...prev, [target]: true }));
    try {
      const payload = target === "llm" ? { llm_api_key: "" } : { embedding_api_key: "" };
      const result = await updateAiSettings(payload, { token });
      setAiHasLlmKey(result.has_llm_api_key);
      setAiHasEmbeddingKey(result.has_embedding_api_key);
      setAiForm((prev) => ({
        ...prev,
        llmApiKey: target === "llm" ? "" : prev.llmApiKey,
        embeddingApiKey: target === "embedding" ? "" : prev.embeddingApiKey
      }));
      setAiTestResult((prev) => ({
        ...prev,
        [target]: undefined
      }));
      setAiNoticeKey("settings.ai.saved");
      setAiNoticeTone("success");
    } catch {
      setAiNoticeKey("settings.error.aiSaveFailed");
      setAiNoticeTone("error");
    } finally {
      setAiClearing((prev) => ({ ...prev, [target]: false }));
    }
  };

  const handleOpenPromptEditor = (field: PromptField) => {
    const prompt = PROMPT_DEFINITIONS.find((item) => item.field === field);
    if (!prompt) {
      return;
    }
    setEditingPromptField(field);
    setEditingPromptValue(aiForm[field]);
  };

  const handleClosePromptEditor = () => {
    if (promptSaving) {
      return;
    }
    setEditingPromptField(null);
    setEditingPromptValue("");
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) {
      return;
    }

    setPromptSaving(true);
    setAiNoticeKey(null);
    setAiNoticeTone(null);
    try {
      const payload: AiSettingsUpdate = {
        [editingPrompt.payloadField]: normalizePromptInput(editingPromptValue)
      };
      const result = await updateAiSettings(payload, { token });
      setAiHasLlmKey(result.has_llm_api_key);
      setAiHasEmbeddingKey(result.has_embedding_api_key);
      setAiForm((prev) => ({
        ...prev,
        summarySystemPrompt: result.summary_system_prompt ?? "",
        summaryUserPromptTemplate: result.summary_user_prompt_template ?? "",
        polishSystemPrompt: result.polish_system_prompt ?? "",
        polishUserPromptTemplate: result.polish_user_prompt_template ?? "",
        visionUserPrompt: result.vision_user_prompt ?? ""
      }));
      setEditingPromptField(null);
      setEditingPromptValue("");
      setAiNoticeKey("settings.ai.saved");
      setAiNoticeTone("success");
    } catch {
      setAiNoticeKey("settings.error.aiSaveFailed");
      setAiNoticeTone("error");
    } finally {
      setPromptSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 left-12 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_85%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_85%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <Sidebar />
      <BottomTabBar />
      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-6 pt-10 pb-[calc(2.5rem+var(--bottom-tab-height)+env(safe-area-inset-bottom))] md:py-10 md:pl-20">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <header className="flex flex-wrap items-center justify-end gap-4">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200/70 bg-white/80 px-4 py-2 text-sm text-neutral-600 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70 dark:text-neutral-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("common.signedInAs")}{" "}
              <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                {displayName}
              </span>
            </div>
          </header>

          <section className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
              {t("settings.title")}
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{t("settings.heading")}</h1>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
              {t("settings.subtitle")}
            </p>
          </section>

          {errorKey ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {t(errorKey)}
            </div>
          ) : null}

          <section className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <div
              role="tablist"
              aria-label={t("settings.title")}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            >
              {SETTINGS_TABS.map((tab) => {
                const active = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    id={`settings-tab-${tab.value}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`settings-panel-${tab.value}`}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t(tab.labelKey)}</p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {t(tab.hintKey)}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200/70 bg-white/75 p-5 dark:border-neutral-800/60 dark:bg-neutral-950/65">
              {activeTab === "appearance" ? (
                <div
                  id="settings-panel-appearance"
                  role="tabpanel"
                  aria-labelledby="settings-tab-appearance"
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-semibold">{t("settings.theme.title")}</h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {t("settings.theme.subtitle")}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            theme === option.value
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                          }`}
                        >
                          <span className="font-semibold">{t(option.labelKey)}</span>
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {t(option.hintKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">{t("settings.language.title")}</h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {t("settings.language.subtitle")}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {LANGUAGE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLocale(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            locale === option.value
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                          }`}
                        >
                          <span className="font-semibold">{t(option.labelKey)}</span>
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {t(option.hintKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "editor" ? (
                <div
                  id="settings-panel-editor"
                  role="tabpanel"
                  aria-labelledby="settings-tab-editor"
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-semibold">{t("settings.noteWidth.title")}</h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {t("settings.noteWidth.subtitle")}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {NOTE_WIDTH_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setNoteWidth(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            noteWidth === option.value
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                          }`}
                        >
                          <span className="font-semibold">{t(option.labelKey)}</span>
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {t(option.hintKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">{t("settings.editorTextSize.title")}</h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {t("settings.editorTextSize.subtitle")}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {EDITOR_TEXT_SIZE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setEditorTextSize(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            editorTextSize === option.value
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                          }`}
                        >
                          <span className="font-semibold">{t(option.labelKey)}</span>
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {t(option.hintKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "accessToken" ? (
                <div
                  id="settings-panel-accessToken"
                  role="tabpanel"
                  aria-labelledby="settings-tab-accessToken"
                  className="space-y-4"
                >
                  <h2 className="text-xl font-semibold">{t("settings.accessToken.title")}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    {t("settings.accessToken.subtitle")}
                  </p>
                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                      {t("settings.accessToken.label")}
                    </label>
                    <input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder={t("settings.accessToken.placeholder")}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                    />
                    <button
                      type="button"
                      disabled={!token || isGenerating}
                      onClick={handleGenerate}
                      className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating
                        ? t("settings.accessToken.generating")
                        : t("settings.accessToken.generate")}
                    </button>
                  </div>

                  {generatedToken ? (
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                        {t("settings.accessToken.valueTitle")}
                      </p>
                      <div className="mt-3 flex flex-col gap-3">
                        <textarea
                          ref={tokenRef}
                          readOnly
                          rows={3}
                          value={generatedToken}
                          className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-800 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                        />
                        <button
                          type="button"
                          onClick={handleCopyToken}
                          className="self-start rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                        >
                          {copiedToken
                            ? t("settings.accessToken.copied")
                            : t("settings.accessToken.copy")}
                        </button>
                      </div>
                      <div className="mt-5">
                        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.accessToken.curlTitle")}
                        </p>
                        <div className="mt-3 flex flex-col gap-3">
                          <textarea
                            ref={curlRef}
                            readOnly
                            rows={6}
                            value={curlExample}
                            className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-800 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                          <button
                            type="button"
                            onClick={handleCopyCurl}
                            className="self-start rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                          >
                            {copiedCurl
                              ? t("settings.accessToken.curlCopied")
                              : t("settings.accessToken.copyCurl")}
                          </button>
                        </div>
                      </div>
                      {copyNoticeKey ? (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          {t(copyNoticeKey)}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {t("settings.accessToken.storeWarning")}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                        {t("settings.accessToken.listTitle")}
                      </p>
                      <button
                        type="button"
                        onClick={() => loadTokenItems()}
                        disabled={isTokenListLoading}
                        className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                      >
                        {t("settings.accessToken.refresh")}
                      </button>
                    </div>

                    {isTokenListLoading ? (
                      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {t("settings.accessToken.listLoading")}
                      </p>
                    ) : null}

                    {!isTokenListLoading && tokenItems.length === 0 ? (
                      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {t("settings.accessToken.listEmpty")}
                      </p>
                    ) : null}

                    {!isTokenListLoading && tokenItems.length > 0 ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="text-neutral-500 dark:text-neutral-400">
                            <tr>
                              <th className="py-2 pr-4 font-medium">
                                {t("settings.accessToken.table.label")}
                              </th>
                              <th className="py-2 pr-4 font-medium">
                                {t("settings.accessToken.table.createdAt")}
                              </th>
                              <th className="py-2 pr-4 font-medium">
                                {t("settings.accessToken.table.lastUsedAt")}
                              </th>
                              <th className="py-2 pr-4 font-medium">
                                {t("settings.accessToken.table.status")}
                              </th>
                              <th className="py-2 pr-0 font-medium">
                                {t("settings.accessToken.table.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokenItems.map((item) => {
                              const revoked = Boolean(item.revoked_at);
                              const isRevoking = revokingTokenId === item.id;
                              return (
                                <tr
                                  key={item.id}
                                  className="border-t border-neutral-200/70 dark:border-neutral-800/80"
                                >
                                  <td className="py-2 pr-4 text-neutral-800 dark:text-neutral-200">
                                    {item.label?.trim() || t("settings.accessToken.untitled")}
                                  </td>
                                  <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-300">
                                    {formatDateTime(item.created_at, locale)}
                                  </td>
                                  <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-300">
                                    {formatDateTime(item.last_used_at, locale)}
                                  </td>
                                  <td className="py-2 pr-4">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        revoked
                                          ? "border border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
                                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                                      }`}
                                    >
                                      {revoked
                                        ? t("settings.accessToken.status.revoked")
                                        : t("settings.accessToken.status.active")}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-0">
                                    <button
                                      type="button"
                                      disabled={revoked || isRevoking}
                                      onClick={() => handleRevokeToken(item.id)}
                                      className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] text-neutral-600 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                                    >
                                      {isRevoking
                                        ? t("settings.accessToken.revoking")
                                        : t("settings.accessToken.revoke")}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {tokenNoticeKey ? (
                      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {t(tokenNoticeKey)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "ai" ? (
                <div
                  id="settings-panel-ai"
                  role="tabpanel"
                  aria-labelledby="settings-tab-ai"
                  className="space-y-4"
                >
                  <h2 className="text-xl font-semibold">{t("settings.ai.title")}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    {t("settings.ai.subtitle")}
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-neutral-200/70 bg-white/70 p-4 dark:border-neutral-800/60 dark:bg-neutral-950/60">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                        {t("settings.ai.llm.title")}
                      </p>
                      <div className="mt-3 grid gap-3">
                        <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.baseUrl")}
                        </label>
                        <input
                          value={aiForm.llmBaseUrl}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              llmBaseUrl: event.target.value
                            }))
                          }
                          placeholder={t("settings.ai.baseUrl.llm.placeholder")}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.model")}
                        </label>
                        <input
                          value={aiForm.llmModel}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              llmModel: event.target.value
                            }))
                          }
                          placeholder={t("settings.ai.model.llm.placeholder")}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <label className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          <span>{t("settings.ai.apiKey")}</span>
                          {aiHasLlmKey ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                              {t("settings.ai.apiKeySaved")}
                            </span>
                          ) : null}
                        </label>
                        <input
                          type="password"
                          value={aiForm.llmApiKey}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              llmApiKey: event.target.value
                            }))
                          }
                          placeholder={aiHasLlmKey ? t("settings.ai.apiKeySaved") : ""}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.apiKeyHint")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={aiTesting.llm}
                            onClick={() => handleTestAi("llm")}
                            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                          >
                            {aiTesting.llm
                              ? t("settings.ai.testing")
                              : t("settings.ai.test")}
                          </button>
                          <button
                            type="button"
                            disabled={aiClearing.llm}
                            onClick={() => handleClearKey("llm")}
                            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                          >
                            {t("settings.ai.clearKey")}
                          </button>
                          {aiTestResult.llm ? (
                            <span
                              className={`text-xs ${
                                aiTestResult.llm.ok
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300"
                              }`}
                            >
                              {aiTestResult.llm.message}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200/70 bg-white/70 p-4 dark:border-neutral-800/60 dark:bg-neutral-950/60">
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400">
                        {t("settings.ai.embedding.title")}
                      </p>
                      <div className="mt-3 grid gap-3">
                        <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.baseUrl")}
                        </label>
                        <input
                          value={aiForm.embeddingBaseUrl}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              embeddingBaseUrl: event.target.value
                            }))
                          }
                          placeholder={t("settings.ai.baseUrl.embedding.placeholder")}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.model")}
                        </label>
                        <input
                          value={aiForm.embeddingModel}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              embeddingModel: event.target.value
                            }))
                          }
                          placeholder={t("settings.ai.model.embedding.placeholder")}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.dimensions")}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4096}
                          value={aiForm.embeddingDimensions}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              embeddingDimensions: event.target.value
                            }))
                          }
                          placeholder="1024"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <label className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          <span>{t("settings.ai.apiKey")}</span>
                          {aiHasEmbeddingKey ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                              {t("settings.ai.apiKeySaved")}
                            </span>
                          ) : null}
                        </label>
                        <input
                          type="password"
                          value={aiForm.embeddingApiKey}
                          onChange={(event) =>
                            setAiForm((prev) => ({
                              ...prev,
                              embeddingApiKey: event.target.value
                            }))
                          }
                          placeholder={aiHasEmbeddingKey ? t("settings.ai.apiKeySaved") : ""}
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {t("settings.ai.apiKeyHint")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={aiTesting.embedding}
                            onClick={() => handleTestAi("embedding")}
                            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                          >
                            {aiTesting.embedding
                              ? t("settings.ai.testing")
                              : t("settings.ai.test")}
                          </button>
                          <button
                            type="button"
                            disabled={aiClearing.embedding}
                            onClick={() => handleClearKey("embedding")}
                            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                          >
                            {t("settings.ai.clearKey")}
                          </button>
                          {aiTestResult.embedding ? (
                            <span
                              className={`text-xs ${
                                aiTestResult.embedding.ok
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300"
                              }`}
                            >
                              {aiTestResult.embedding.message}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                  </div>

                  <button
                    type="button"
                    disabled={aiSaving}
                    onClick={handleSaveAi}
                    className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    {aiSaving ? t("settings.ai.saving") : t("settings.ai.save")}
                  </button>
                  {aiNoticeKey ? (
                    <p
                      className={`text-xs ${
                        aiNoticeTone === "success"
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {t(aiNoticeKey)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "prompts" ? (
                <div
                  id="settings-panel-prompts"
                  role="tabpanel"
                  aria-labelledby="settings-tab-prompts"
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    {PROMPT_TASK_GROUPS.map((group) => (
                      <div
                        key={group.taskKey}
                        className="space-y-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/30"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                          {t(group.taskKey)}
                        </p>
                        {group.fields.map((field) => {
                          const item = PROMPT_DEFINITIONS.find(
                            (definition) => definition.field === field
                          );
                          if (!item) {
                            return null;
                          }
                          const name = t(item.typeKey);
                          const value = aiForm[item.field];
                          const hasCustomValue = value.trim().length > 0;
                          const preview = hasCustomValue
                            ? value.trim().replace(/\s+/g, " ")
                            : t("settings.ai.prompts.defaultInUse");
                          return (
                            <div
                              key={item.field}
                              className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 md:flex-row md:items-start md:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                                  {name}
                                </p>
                                <p
                                  className={`mt-1 max-h-10 overflow-hidden text-xs leading-5 ${
                                    hasCustomValue
                                      ? "text-neutral-600 dark:text-neutral-300"
                                      : "text-amber-600 dark:text-amber-300"
                                  }`}
                                >
                                  {preview}
                                </p>
                                {item.variablesKey ? (
                                  <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {t(item.variablesKey)}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenPromptEditor(item.field)}
                                className="shrink-0 self-start rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                              >
                                {t("settings.ai.prompts.edit")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {aiNoticeKey ? (
                    <p
                      className={`text-xs ${
                        aiNoticeTone === "success"
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {t(aiNoticeKey)}
                    </p>
                  ) : null}

                  <Dialog
                    open={Boolean(editingPrompt)}
                    onOpenChange={(open) => {
                      if (!open) {
                        handleClosePromptEditor();
                      }
                    }}
                  >
                    <DialogContent className="max-w-2xl border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                      <DialogHeader>
                        <DialogTitle className="text-neutral-900 dark:text-neutral-100">
                          {editingPrompt
                            ? t("settings.ai.prompts.dialogTitle", {
                                name: `${t(editingPrompt.taskKey)} · ${t(editingPrompt.typeKey)}`
                              })
                            : t("settings.ai.prompts.title")}
                        </DialogTitle>
                        <DialogDescription className="text-neutral-600 dark:text-neutral-300">
                          {t("settings.ai.prompts.emptyToDefault")}
                        </DialogDescription>
                      </DialogHeader>

                      {editingPrompt ? (
                        <div className="space-y-3">
                          <label className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                            {t("settings.ai.prompts.promptContent")}
                          </label>
                          <textarea
                            rows={editingPrompt.rows}
                            value={editingPromptValue}
                            onChange={(event) => setEditingPromptValue(event.target.value)}
                            placeholder={t(editingPrompt.placeholderKey)}
                            className="w-full resize-y rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-xs text-neutral-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
                          />
                          {editingPrompt.variablesKey ? (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {t(editingPrompt.variablesKey)}
                            </p>
                          ) : null}
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {t("settings.ai.prompts.localeHint")}
                          </p>
                        </div>
                      ) : null}

                      <DialogFooter className="gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={handleClosePromptEditor}
                          className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-neutral-100"
                        >
                          {t("settings.ai.prompts.cancel")}
                        </button>
                        <button
                          type="button"
                          disabled={promptSaving || !editingPrompt}
                          onClick={handleSavePrompt}
                          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                        >
                          {promptSaving
                            ? t("settings.ai.prompts.saving")
                            : t("settings.ai.prompts.save")}
                        </button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
