import { getWhatsAppTemplate } from "./config.mjs";

export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const NOTIFICATION_BATCH_SIZE = 3;
export const STALE_PROCESSING_MS = 10 * 60 * 1000;
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

function clampRetryAfter(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(1_000, Math.min(60 * 60_000, value));
}

export function retryDelayMs(attemptNumber, retryAfterMs) {
  const providerDelay = clampRetryAfter(retryAfterMs);
  if (providerDelay !== null) return providerDelay;
  return RETRY_BACKOFF_MS[Math.max(0, Math.min(RETRY_BACKOFF_MS.length - 1, attemptNumber - 1))];
}

export async function processClaimedNotification(notification, { repository, provider, config, now = () => new Date() }) {
  const templateName = getWhatsAppTemplate(config, notification.eventType);
  if (!templateName) {
    await repository.markFailed(notification.id, "WhatsApp template is not configured for this event.", false, now());
    return { status: "FAILED", reason: "template-not-configured" };
  }
  const recipient = notification.recipient;
  const request = provider.buildRequest({ notification, recipient, templateName, config });
  if (!request) {
    await repository.markFailed(notification.id, "The recipient or notification data is invalid.", false, now());
    return { status: "FAILED", reason: "invalid-notification" };
  }

  try {
    const result = await provider.sendTemplate(request, config);
    await repository.markSent(notification.id, result.messageId, now());
    return { status: "SENT" };
  } catch (error) {
    const category = error && typeof error === "object" && "category" in error ? error.category : "ambiguous";
    const safeMessage = error && typeof error === "object" && "safeMessage" in error ? error.safeMessage : "WhatsApp delivery outcome is unknown; automatic retry was stopped.";
    const attempted = notification.retryCount;
    if (category === "rate-limited" && attempted < MAX_NOTIFICATION_ATTEMPTS) {
      const nextAttemptAt = new Date(now().getTime() + retryDelayMs(attempted, error.retryAfterMs));
      await repository.scheduleRetry(notification.id, String(safeMessage), nextAttemptAt, now());
      return { status: "PENDING", reason: "rate-limited", nextAttemptAt };
    }
    const deliveryUnknown = category === "ambiguous";
    const terminalMessage = category === "rate-limited" ? "WhatsApp retry limit reached after provider rate limits." : String(safeMessage);
    await repository.markFailed(notification.id, terminalMessage, deliveryUnknown, now());
    return { status: "FAILED", reason: deliveryUnknown ? "delivery-unknown" : category };
  }
}

export async function dispatchNotificationBatch({ repository, provider, config, now = () => new Date(), limit = NOTIFICATION_BATCH_SIZE, onlyId }) {
  if (config.issues.length) return { status: "unavailable", reason: "configuration-missing", missing: config.issues, processed: 0 };
  const staleCount = await repository.failStaleProcessing(new Date(now().getTime() - STALE_PROCESSING_MS), now());
  let processed = 0;
  const results = [];
  const boundedLimit = Math.max(1, Math.min(NOTIFICATION_BATCH_SIZE, Math.floor(limit)));
  while (processed < boundedLimit) {
    const notification = await repository.claimNext(now(), onlyId);
    if (!notification) break;
    const result = await processClaimedNotification(notification, { repository, provider, config, now });
    processed += 1;
    results.push(result);
  }
  return { status: "ok", processed, staleCount, results };
}
