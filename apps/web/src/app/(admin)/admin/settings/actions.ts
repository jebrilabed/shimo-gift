"use server";
import { revalidatePath } from "next/cache";
import { Locale, Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { parseStoreSettings } from "@/lib/phase7/validation.mjs";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export type SettingsState = { error?: string; success?: string };
export async function saveStoreSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  let admin;
  try { admin = await requireAdmin(); } catch { return { error: messages.ar.settingsUnauthorized }; }
  const parsed = parseStoreSettings(formData);
  if (!parsed.ok) return { error: messages.ar.settingsInvalid };
  const { address, ...values } = parsed.value;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.storeSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...values, defaultLocale: Locale.AR, address: address ? { address } : Prisma.JsonNull },
        update: { ...values, defaultLocale: Locale.AR, address: address ? { address } : Prisma.JsonNull },
      });
      await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "settings.store.update", entityType: "StoreSettings", entityId: "singleton", metadata: { changedFields: Object.keys(parsed.value) } } });
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Store settings save failed.", { code });
    return { error: messages.ar.settingsFailed };
  }
  revalidatePath("/admin/settings");
  revalidatePath("/ar");
  revalidatePath("/ar/cart");
  revalidatePath("/ar/checkout");
  revalidatePath("/ar/contact");
  revalidatePath("/ar/[slug]", "page");
  revalidatePath("/sitemap.xml");
  return { success: messages.ar.settingsSaved };
}
