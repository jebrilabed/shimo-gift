"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, AuthenticationRequiredError } from "@/lib/auth/authorization";
import { retryFailedWhatsAppNotification, dispatchWhatsAppNotifications } from "@/lib/whatsapp/dispatcher";

export async function retryNotificationAction(formData: FormData) {
  const id = String(formData.get("notificationId") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) redirect("/admin/notifications?notice=invalid");

  let admin;
  try { admin = await requireAdmin(); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/ar/login");
    redirect("/admin/notifications?notice=denied");
  }

  let retried;
  try { retried = await retryFailedWhatsAppNotification(id, admin.id); }
  catch {
    console.error("Admin notification retry failed.");
    redirect("/admin/notifications?notice=error");
  }
  if (!retried.ok) redirect("/admin/notifications?notice=invalid");

  let dispatch;
  try { dispatch = await dispatchWhatsAppNotifications({ limit: 1, onlyId: id }); }
  catch {
    console.error("Admin notification dispatch failed.");
    redirect("/admin/notifications?notice=error");
  }
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
  redirect(`/admin/notifications?notice=${dispatch.status === "unavailable" ? "config" : "retried"}`);
}
