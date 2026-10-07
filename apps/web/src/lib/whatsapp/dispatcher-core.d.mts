export const MAX_NOTIFICATION_ATTEMPTS: number;
export const NOTIFICATION_BATCH_SIZE: number;
export const STALE_PROCESSING_MS: number;
export const RETRY_BACKOFF_MS: number[];
export function retryDelayMs(attemptNumber: number, retryAfterMs?: number): number;
export function processClaimedNotification(notification: { id: string; eventType: string; recipient: string; payload: unknown; retryCount: number }, deps: {
  repository: { markFailed(id: string, error: string, deliveryUnknown: boolean, now: Date): Promise<unknown>; markSent(id: string, messageId: string, now: Date): Promise<unknown>; scheduleRetry(id: string, error: string, nextAttemptAt: Date, now: Date): Promise<unknown> };
  provider: { buildRequest(input: unknown): unknown; sendTemplate(request: unknown): Promise<{ messageId: string }> };
  config: { templates: Record<string, string> }; now?: () => Date;
}): Promise<{ status: "SENT" | "PENDING" | "FAILED"; reason?: string; nextAttemptAt?: Date }>;
export function dispatchNotificationBatch(input: {
  repository: { failStaleProcessing(before: Date, now: Date): Promise<number>; claimNext(now: Date, onlyId?: string): Promise<{ id: string; eventType: string; recipient: string; payload: unknown; retryCount: number } | null> };
  provider: { buildRequest(input: unknown): unknown; sendTemplate(request: unknown): Promise<{ messageId: string }> };
  config: { issues: string[]; templates: Record<string, string> };
  now?: () => Date; limit?: number; onlyId?: string;
}): Promise<{ status: "ok" | "unavailable"; reason?: string; missing?: string[]; processed: number; staleCount?: number; results?: Array<{ status: string; reason?: string; nextAttemptAt?: Date }> }>;
