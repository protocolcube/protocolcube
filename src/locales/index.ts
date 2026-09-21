import { ref, watch } from "vue";

import { author as englishAuthor } from "./en/author";
import { common as englishCommon } from "./en/common";
import { help as englishHelp } from "./en/help";
import { reader as englishReader } from "./en/reader";
import { author as simplifiedChineseAuthor } from "./zh-CN/author";
import { common as simplifiedChineseCommon } from "./zh-CN/common";
import { help as simplifiedChineseHelp } from "./zh-CN/help";
import { reader as simplifiedChineseReader } from "./zh-CN/reader";

export const LOCALE_STORAGE_KEY = "protocol-box:locale";
export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationParams = Record<
  string,
  string | number | boolean | null | undefined
>;

const english = {
  ...englishCommon,
  ...englishAuthor,
  ...englishReader,
  ...englishHelp,
} as const;

export type TranslationKey = keyof typeof english;

const simplifiedChinese = {
  ...simplifiedChineseCommon,
  ...simplifiedChineseAuthor,
  ...simplifiedChineseReader,
  ...simplifiedChineseHelp,
} satisfies Record<TranslationKey, string>;

const messages: Record<Locale, Record<TranslationKey, string>> = {
  en: english,
  "zh-CN": simplifiedChinese,
};

function normalizeLocale(value: string | null | undefined): Locale | undefined {
  if (value === "en" || value === "zh-CN") return value;
  return value?.toLowerCase().startsWith("zh") ? "zh-CN" : undefined;
}

function readStoredLocale(): Locale | undefined {
  try {
    return normalizeLocale(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const normalized = normalizeLocale(candidate);
    if (normalized !== undefined) return normalized;
  }
  return "en";
}

export const initialBrowserLocale = detectBrowserLocale();
export const locale = ref<Locale>(readStoredLocale() ?? initialBrowserLocale);

export function setLocale(value: Locale): void {
  locale.value = value;
}

export function t(
  key: TranslationKey,
  params: TranslationParams = {},
): string {
  const template = messages[locale.value][key];
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

watch(
  locale,
  (value) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = value;
    }
    try {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      // Locale persistence is optional; the active selection still applies.
    }
  },
  { immediate: true },
);
