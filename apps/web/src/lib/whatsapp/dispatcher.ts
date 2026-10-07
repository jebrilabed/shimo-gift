import "server-only";

import { NotificationStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { readWhatsAppConfig } from "./config.mjs";
import { dispatchNotificationBatch } from "./dispatcher-core.mjs";
import { createWhatsAppProvider } from "./provider";

export function createNotificationOutboxRepository() {
  return {
    async failStaleProcessing(before: Date, now: Date) {
      const result = await prisma.notificationOutbox.updateMany({
        where: { status: NotificationStatus.PROCESSING, lastAttemptAt: { lt: before } },
        data: {
          status: NotificationStatus.FAILED,
          deliveryUnknown: true,
          nextAttemptAt: null,
          errorMessage: "A worker stopped while delivery was in progress; provider acceptance is unknown. Manual review is required.",
          updatedAt: now,
        },
      });
      return result.count;
    },
    async claimNext(now: Date, onlyId?: string) {
      return prisma.$transaction(async (tx) => {
        const idFilter = onlyId ? Prisma.sql`AND "id" = ${onlyId}` : Prisma.empty;
        const selected = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT "id"
          FROM "notification_outbox"
          WHERE "status" = 'PENDING'
            AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
            ${idFilter}
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `);
        const id = selected[0]?.id;
        if (!id) return null;
        await tx.notificationOutbox.update({
          where: { id },
          data: { status: NotificationStatus.PROCESSING, retryCount: { increment: 1 }, lastAttemptAt: now, nextAttemptAt: null },
        });
        return tx.notificationOutbox.findUnique({
          where: { id },
          select: { id: true, eventType: true, recipient: true, payload: true, retryCount: true },
        });
      });
    },
    async markSent(id: string, messageId: string, now: Date) {
      const result = await prisma.notificationOutbox.updateMany({
        where: { id, status: NotificationStatus.PROCESSING },
        data: { status: NotificationStatus.SENT, providerMessageId: messageId.slice(0, 255), errorMessage: null, deliveryUnknown: false, nextAttemptAt: null, updatedAt: now },
      });
      if (result.count !== 1) throw new Error("Notification claim is no longer owned.");
    },
    async markFailed(id: string, errorMessage: string, deliveryUnknown: boolean, now: Date) {
      const result = await prisma.notificationOutbox.updateMany({
        where: { id, status: NotificationStatus.PROCESSING },
        data: { status: NotificationStatus.FAILED, errorMessage: errorMessage.slice(0, 500), deliveryUnknown, nextAttemptAt: null, updatedAt: now },
      });
      if (result.count !== 1) throw new Error("Notification claim is no longer owned.");
    },
    async scheduleRetry(id: string, errorMessage: string, nextAttemptAt: Date, now: Date) {
      const result = await prisma.notificationOutbox.updateMany({
        where: { id, status: NotificationStatus.PROCESSING },
        data: { status: NotificationStatus.PENDING, errorMessage: errorMessage.slice(0, 500), deliveryUnknown: false, nextAttemptAt, updatedAt: now },
      });
      if (result.count !== 1) throw new Error("Notification claim is no longer owned.");
    },
  };
}

export async function dispatchWhatsAppNotifications({ limit, onlyId }: { limit?: number; onlyId?: string } = {}) {
  const config = readWhatsAppConfig();
  const result = await dispatchNotificationBatch({
    repository: createNotificationOutboxRepository(),
    provider: createWhatsAppProvider(),
    config,
    limit,
    onlyId,
  });
  if (result.status === "ok" && result.processed > 0) {
    for (const item of result.results ?? []) {
      console.info("WhatsApp notification dispatch completed.", { status: item.status, reason: item.reason ?? null });
    }
  }
  return result;
}

export async function retryFailedWhatsAppNotification(id: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.notificationOutbox.findUnique({
      where: { id },
      select: { id: true, eventType: true, status: true, retryCount: true, deliveryUnknown: true },
    });
    if (!existing || existing.status !== NotificationStatus.FAILED) return { ok: false as const, reason: "not-retryable" as const };
    const changed = await tx.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.FAILED },
      data: { status: NotificationStatus.PENDING, retryCount: 0, nextAttemptAt: new Date(), errorMessage: null, deliveryUnknown: false },
    });
    if (changed.count !== 1) return { ok: false as const, reason: "not-retryable" as const };
    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: "notifications.retry",
        entityType: "NotificationOutbox",
        entityId: id,
        metadata: { eventType: existing.eventType, previousAttempts: existing.retryCount, deliveryWasUnknown: existing.deliveryUnknown },
      },
    });
    return { ok: true as const };
  });
}
