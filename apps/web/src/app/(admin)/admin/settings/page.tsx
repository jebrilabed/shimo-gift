import { Card } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "./settings-form";
import { PasswordForm } from "./password-form";
import { adminMessages } from "@/lib/admin/messages";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { storefrontMessages } from "@/lib/storefront/messages";
export default async function StoreSettingsPage() {
  await requireAdminPage();
  const settings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  const addressValue = settings?.address && typeof settings.address === "object" && !Array.isArray(settings.address) && "address" in settings.address && typeof settings.address.address === "string" ? settings.address.address : "";
  return <div className="admin-page"><header className="admin-page__header"><div><h1>{messages.ar.settingsTitle}</h1><p>{messages.ar.settingsDescription}</p></div></header><Card><SettingsForm values={{ storeName: settings?.storeName ?? storefrontMessages.ar.brand, description: settings?.description ?? "", contactPhone: settings?.contactPhone ?? "", email: settings?.email ?? "", address: addressValue, isActive: settings?.isActive ?? true }} /><p className="mt-5 text-sm text-slate-600">{messages.ar.settingsHint}</p></Card><Card><h2 className="mb-2 text-xl font-semibold">{adminMessages.ar.changePassword}</h2><p className="mb-5 text-sm text-slate-600">{adminMessages.ar.changePasswordDescription}</p><PasswordForm /></Card></div>;
}
