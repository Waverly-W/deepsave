"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { apiUrl } from "../../lib/api";
import { useI18n } from "../../lib/i18n-provider";

export default function SetupForm() {
  const router = useRouter();
  const { t } = useI18n();
  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t("setup.passwordMin")),
          confirm: z.string().min(8, t("setup.confirmRequired"))
        })
        .refine((values) => values.password === values.confirm, {
          message: t("setup.passwordMismatch"),
          path: ["confirm"]
        }),
    [t]
  );
  type FormValues = z.infer<typeof schema>;
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const response = await fetch(apiUrl("/auth/setup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: values.password })
    });

    if (!response.ok) {
      if (response.status === 409) {
        setServerError(t("setup.adminExists"));
        return;
      }
      const payload = await response.json().catch(() => null);
      setServerError(payload?.detail ?? t("setup.failed"));
      return;
    }

    const login = await signIn("credentials", {
      password: values.password,
      redirect: false
    });
    if (login?.error) {
      setServerError(t("setup.completeLogin"));
      return;
    }

    router.replace("/");
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="block text-sm font-medium">
        {t("setup.passwordLabel")}
        <input
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-2 text-xs text-rose-500">{errors.password.message}</p>
        ) : null}
      </label>

      <label className="block text-sm font-medium">
        {t("setup.confirmLabel")}
        <input
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
          {...register("confirm")}
        />
        {errors.confirm ? (
          <p className="mt-2 text-xs text-rose-500">{errors.confirm.message}</p>
        ) : null}
      </label>

      {serverError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t("setup.initializing") : t("setup.createAdmin")}
      </button>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("setup.deviceConfirm")}
      </p>
    </form>
  );
}
