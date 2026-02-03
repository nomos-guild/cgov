export const locales = ["en", "de", "fr", "es", "pt", "ja", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
