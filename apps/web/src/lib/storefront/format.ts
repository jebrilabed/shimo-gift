import { Prisma } from "@/generated/prisma/client";
import { supportedCurrencies } from "@/lib/phase7/validation.mjs";

export function formatMoney(amount: Prisma.Decimal | string, currency: string, locale = "ar-SA") {
  const value = typeof amount === "string" ? new Prisma.Decimal(amount) : amount;
  if (!supportedCurrencies.includes(currency)) return `${value.toFixed(2)} ${currency.slice(0, 3)}`;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value.toNumber());
}

export function displayVariantOptions(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return "";
  return Object.entries(value)
    .filter(([, option]) => typeof option === "string" || typeof option === "number" || typeof option === "boolean")
    .map(([key, option]) => `${key}: ${String(option)}`)
    .join(" · ");
}

export function addressParts(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== "object") return { address: "", city: "" };
  const record = value as Record<string, Prisma.JsonValue>;
  return {
    address: typeof record.address === "string" ? record.address : "",
    city: typeof record.city === "string" ? record.city : "",
  };
}
