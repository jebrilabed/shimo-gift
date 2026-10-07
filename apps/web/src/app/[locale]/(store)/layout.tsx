import type { ReactNode } from "react";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";

export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return children;
}
