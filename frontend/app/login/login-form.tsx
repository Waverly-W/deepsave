"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { TranslationKey } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n-provider";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const schema = useMemo(
    () =>
      z.object({
        password: z.string().min(1, t("login.passwordRequired"))
      }),
    [t]
  );
  type FormValues = z.infer<typeof schema>;
  const [serverErrorKey, setServerErrorKey] = useState<TranslationKey | null>(
    null
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    setServerErrorKey(null);
    const result = await signIn("credentials", {
      password: values.password,
      redirect: false
    });

    if (result?.error) {
      setServerErrorKey("login.invalidPassword");
      return;
    }

    router.replace("/");
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="block text-sm font-medium">
        {t("login.adminPasswordLabel")}
        <input
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-sky-400 dark:focus:ring-sky-400/30"
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-2 text-xs text-rose-500">{errors.password.message}</p>
        ) : null}
      </label>

      {serverErrorKey ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {t(serverErrorKey)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t("login.signingIn") : t("login.signIn")}
      </button>
    </form>
  );
}
