import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./locales";

export function requireLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

export type LocaleParams = Promise<{ locale: string }>;
