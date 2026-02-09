"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import type { TranslationKey } from "../../lib/i18n";
import { LANGUAGE_OPTIONS } from "../../lib/i18n";
import {
  createAccessToken,
  fetchAiSettings,
  testAiSettings,
  updateAiSettings
} from "../../lib/fetchers";
import { useI18n } from "../../lib/i18n-provider";
import Sidebar from "../../components/sidebar";

type ThemeMode = "system" | "light" | "dark";

type SettingsShellProps = {
  userLabel?: string;
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

export default function SettingsShell({ userLabel }: SettingsShellProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [label, setLabel] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyNoticeKey, setCopyNoticeKey] = useState<TranslationKey | null>(
    null
  );
  const [aiForm, setAiForm] = useState({
    llmBaseUrl: "",
    llmModel: "",
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
  const tokenRef = useRef<HTMLTextAreaElement | null>(null);
  const displayName = userLabel || t("common.admin");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial: ThemeMode = stored === "light" || stored === "dark" ? stored : "system";
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
          embeddingBaseUrl: data.embedding_base_url ?? "",
          embeddingModel: data.embedding_model ?? "",
          embeddingDimensions: data.embedding_dimensions
            ? String(data.embedding_dimensions)
            : ""
        }));
      } catch (err) {
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

  const handleGenerate = async () => {
    if (!token) {
      setErrorKey("settings.error.notAuthenticated");
      return;
    }
    setErrorKey(null);
    setIsGenerating(true);
    setGeneratedToken(null);
    setCopied(false);
    setCopyNoticeKey(null);
    try {
      const result = await createAccessToken(
        { label: label.trim() || undefined },
        { token }
      );
      setGeneratedToken(result.access_token);
    } catch (err) {
      setErrorKey("settings.error.generateFailed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedToken) {
      return;
    }
    setCopyNoticeKey(null);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(generatedToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch (err) {
      setCopied(false);
    }

    const fallbackTarget = tokenRef.current;
    if (fallbackTarget) {
      fallbackTarget.focus();
      fallbackTarget.select();
      fallbackTarget.setSelectionRange(0, fallbackTarget.value.length);
      try {
        const success = document.execCommand("copy");
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          return;
        }
      } catch (err) {
        setCopied(false);
      }
    }
    setCopyNoticeKey("settings.accessToken.copyUnsupported");
  };

  const handleSaveAi = async () => {
    setAiSaving(true);
    setAiNoticeKey(null);
    setAiNoticeTone(null);
    const payload = {
      llm_base_url: aiForm.llmBaseUrl.trim() || null,
      llm_model: aiForm.llmModel.trim() || null,
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
        embeddingBaseUrl: result.embedding_base_url ?? "",
        embeddingModel: result.embedding_model ?? "",
        embeddingDimensions: result.embedding_dimensions
          ? String(result.embedding_dimensions)
          : ""
      }));
      setAiNoticeKey("settings.ai.saved");
      setAiNoticeTone("success");
    } catch (err) {
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
    } catch (err) {
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
      const payload =
        target === "llm"
          ? { llm_api_key: "" }
          : { embedding_api_key: "" };
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
    } catch (err) {
      setAiNoticeKey("settings.error.aiSaveFailed");
      setAiNoticeTone("error");
    } finally {
      setAiClearing((prev) => ({ ...prev, [target]: false }));
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
      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-10 pl-20">
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
          <h1 className="mt-3 text-3xl font-semibold">
            {t("settings.heading")}
          </h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            {t("settings.subtitle")}
          </p>
        </section>

        {errorKey ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {t(errorKey)}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <h2 className="text-xl font-semibold">{t("settings.theme.title")}</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                {t("settings.theme.subtitle")}
              </p>
              <div className="mt-5 grid gap-3">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      theme === option.value
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                    }`}
                  >
                    <span className="font-semibold">{t(option.labelKey)}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t(option.hintKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <h2 className="text-xl font-semibold">
                {t("settings.language.title")}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                {t("settings.language.subtitle")}
              </p>
              <div className="mt-5 grid gap-3">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLocale(option.value)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      locale === option.value
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                    }`}
                  >
                    <span className="font-semibold">{t(option.labelKey)}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t(option.hintKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <h2 className="text-xl font-semibold">
                {t("settings.accessToken.title")}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                {t("settings.accessToken.subtitle")}
              </p>
              <div className="mt-4 space-y-3">
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
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
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
                      onClick={handleCopy}
                      className="self-start rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                    >
                      {copied
                        ? t("settings.accessToken.copied")
                        : t("settings.accessToken.copy")}
                    </button>
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
            </div>

            <div className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <h2 className="text-xl font-semibold">{t("settings.ai.title")}</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                {t("settings.ai.subtitle")}
              </p>
              <div className="mt-5 space-y-4">
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
                        {aiTesting.llm ? t("settings.ai.testing") : t("settings.ai.test")}
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
                className="mt-5 w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {aiSaving ? t("settings.ai.saving") : t("settings.ai.save")}
              </button>
              {aiNoticeKey ? (
                <p
                  className={`mt-3 text-xs ${
                    aiNoticeTone === "success"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-rose-600 dark:text-rose-300"
                  }`}
                >
                  {t(aiNoticeKey)}
                </p>
              ) : null}
            </div>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
