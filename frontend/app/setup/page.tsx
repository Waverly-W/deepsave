import Link from "next/link";
import { redirect } from "next/navigation";

import { apiUrl } from "../../lib/api";
import { getServerTranslator } from "../../lib/i18n-server";
import SetupForm from "./setup-form";

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

export default async function SetupPage() {
  const initialized = await getInitStatus();
  if (initialized) {
    redirect("/login");
  }
  const { t } = getServerTranslator();
  const features = [
    {
      id: "localSecurity",
      title: t("setup.feature.localSecurity.title"),
      body: t("setup.feature.localSecurity.body")
    },
    {
      id: "fastSetup",
      title: t("setup.feature.fastSetup.title"),
      body: t("setup.feature.fastSetup.body")
    },
    {
      id: "apiReady",
      title: t("setup.feature.apiReady.title"),
      body: t("setup.feature.apiReady.body")
    },
    {
      id: "guided",
      title: t("setup.feature.guided.title"),
      body: t("setup.feature.guided.body")
    }
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/20" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-400/20" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_92%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_92%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center">
        <section className="flex-1 space-y-6">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
            {t("setup.firstRun")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            {t("setup.title")}
          </h1>
          <p className="max-w-xl text-base text-neutral-600 dark:text-neutral-300">
            {t("setup.subtitle")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/60"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("setup.alreadyConfigured")}{" "}
            <Link className="font-semibold text-emerald-500" href="/login">
              {t("setup.goToLogin")}
            </Link>
          </div>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
                {t("setup.adminSetup")}
              </p>
              <h2 className="text-2xl font-semibold">
                {t("setup.createPassword")}
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t("setup.passwordHint")}
              </p>
            </div>
            <div className="mt-6">
              <SetupForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
