import { cookies } from "next/headers";

import {
  LOCALE_COOKIE_NAME,
  createTranslator,
  getLocaleOrDefault
} from "./i18n";

export function getServerLocale() {
  const stored = cookies().get(LOCALE_COOKIE_NAME)?.value ?? null;
  return getLocaleOrDefault(stored);
}

export function getServerTranslator() {
  const locale = getServerLocale();
  const t = createTranslator(locale);
  return { locale, t };
}
