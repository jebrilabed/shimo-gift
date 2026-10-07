export const supportedLocales = ["ar"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ar";

export function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export function getLocaleDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
