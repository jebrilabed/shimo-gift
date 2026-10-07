import { isAuthorizedNotificationCron } from "@/lib/notifications/cron-auth.mjs";
import { dispatchWhatsAppNotifications } from "@/lib/whatsapp/dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return Response.json({ status: "not-configured" }, { status: 503 });
  if (!isAuthorizedNotificationCron(request.headers.get("authorization"), secret)) {
    return Response.json({ status: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await dispatchWhatsAppNotifications();
    if (result.status === "unavailable") {
      return Response.json({ status: "unavailable", reason: result.reason, missing: result.missing }, { status: 503 });
    }
    return Response.json({ status: "ok", processed: result.processed, staleRecovered: result.staleCount });
  } catch {
    console.error("Notification dispatcher request failed.");
    return Response.json({ status: "error" }, { status: 500 });
  }
}
