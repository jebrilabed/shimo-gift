"use server";
import { revalidatePath } from "next/cache";
import { Locale, Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword, verifyPassword } from "@/lib/auth/password-hash.mjs";
import { prisma } from "@/lib/db/prisma";
import { parseStoreSettings } from "@/lib/phase7/validation.mjs";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { adminMessages } from "@/lib/admin/messages";
export type SettingsState = { error?: string; success?: string };
export type PasswordState = { error?: string; success?: string };

function passwordField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function changeAdminPassword(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  let admin;
  try { admin = await requireAdmin(); } catch { return { error: adminMessages.ar.settingsUnauthorized }; }

  const currentPassword = passwordField(formData, "currentPassword");
  const newPassword = passwordField(formData, "newPassword");
  const confirmation = passwordField(formData, "confirmation");
  if (!currentPassword || !newPassword || !confirmation) return { error: adminMessages.ar.passwordRequired };
  if (newPassword.length < 8) return { error: adminMessages.ar.passwordTooShort };
  if (newPassword.length > 128 || currentPassword.length > 128 || confirmation.length > 128) {
    return { error: adminMessages.ar.passwordTooLong };
  }
  if (newPassword !== confirmation) return { error: adminMessages.ar.passwordMismatch };

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  } catch {
    return { error: adminMessages.ar.passwordChangeFailed };
  }
  if (!user?.passwordHash) return { error: adminMessages.ar.passwordChangeUnavailable };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: adminMessages.ar.currentPasswordIncorrect };
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(newPassword);
  } catch {
    return { error: adminMessages.ar.passwordChangeFailed };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: admin.id, role: "ADMIN", passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (result.count !== 1) return false;
      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "auth.password.change",
          entityType: "User",
          entityId: admin.id,
          metadata: { changedFields: ["passwordHash"] },
        },
      });
      return true;
    });
    if (!updated) return { error: adminMessages.ar.currentPasswordIncorrect };
  } catch {
    return { error: adminMessages.ar.passwordChangeFailed };
  }

  revalidatePath("/admin/settings");
  return { success: adminMessages.ar.passwordChanged };
}

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
