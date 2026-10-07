import type { WhatsAppConfig } from "./config.mjs";
export class WhatsAppProviderError extends Error {
  category: "rate-limited" | "rejected" | "ambiguous";
  safeMessage: string;
  retryAfterMs: number | null;
}
export function createWhatsAppProvider(options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): {
  buildRequest(input: { notification: { eventType: string; payload: unknown }; recipient: string; templateName: string; config: WhatsAppConfig }): unknown;
  sendTemplate(request: unknown, config?: WhatsAppConfig): Promise<{ messageId: string }>;
};
