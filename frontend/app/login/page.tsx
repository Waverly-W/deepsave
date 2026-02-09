import Link from "next/link";
import { redirect } from "next/navigation";

import { apiUrl } from "../../lib/api";
import { getServerTranslator } from "../../lib/i18n-server";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

async function getInitStatus(): Promise<boolean | null> {
  try {
    const response = await fetch(apiUrl("/system/init-status"), {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { initialized?: boolean };
    return Boolean(data.initialized);
  } catch (error) {
    return null;
  }
}

export default async function LoginPage() {
  const initialized = await getInitStatus();
  if (initialized === false) {
    redirect("/setup");
  }
  const { t } = getServerTranslator();

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 left-12 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl dark:bg-teal-400/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.2),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
        <section className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
            {t("common.appName")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            {t("login.title")}
          </h1>
          <p className="mt-4 text-base text-neutral-600 dark:text-neutral-300">
            {t("login.subtitle")}
          </p>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <LoginForm />
          </div>
          <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("login.needSetup")}{" "}
            <Link className="font-semibold text-sky-500" href="/setup">
              {t("login.runSetup")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
