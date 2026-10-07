import { normalizeWhatsAppRecipient, buildWhatsAppTemplateRequest } from "./template-request.mjs";

export class WhatsAppProviderError extends Error {
  constructor(category, safeMessage, retryAfterMs = null) {
    super(safeMessage);
    this.name = "WhatsAppProviderError";
    this.category = category;
    this.safeMessage = safeMessage;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp - now : null;
}

function safeProviderFailure(status, retryAfter) {
  if (status === 429) return new WhatsAppProviderError("rate-limited", "WhatsApp provider rate limit; retry scheduled.", retryAfter);
  if (status >= 500 || status === 408) return new WhatsAppProviderError("ambiguous", "WhatsApp provider returned a server/timeout response; delivery is uncertain.");
  if (status === 401 || status === 403) return new WhatsAppProviderError("rejected", "WhatsApp provider rejected server credentials or permissions.");
  if (status === 400) return new WhatsAppProviderError("rejected", "WhatsApp provider rejected the recipient or configured template.");
  return new WhatsAppProviderError("rejected", `WhatsApp provider rejected the request (HTTP ${status}).`);
}

export function createWhatsAppProvider({ fetchImpl = fetch, timeoutMs = 8_000 } = {}) {
  return {
    buildRequest({ notification, recipient, templateName, config }) {
      const normalizedRecipient = normalizeWhatsAppRecipient(recipient, config.defaultCountryCode);
      if (!normalizedRecipient) return null;
      return buildWhatsAppTemplateRequest({
        recipient: normalizedRecipient,
        templateName,
        languageCode: config.languageCode,
        payload: notification.payload,
      });
    },
    async sendTemplate(request, config) {
      if (!config?.apiVersion || !config.phoneNumberId || !config.accessToken) {
        throw new WhatsAppProviderError("rejected", "WhatsApp provider configuration is incomplete.");
      }
      let response;
      try {
        response = await fetchImpl(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
          method: "POST",
          headers: { authorization: `Bearer ${config.accessToken}`, "content-type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new WhatsAppProviderError("ambiguous", "WhatsApp request timed out or the network failed; delivery is uncertain.");
      }
      if (!response.ok) throw safeProviderFailure(response.status, parseRetryAfter(response.headers.get("retry-after")));
      let body;
      try { body = await response.json(); }
      catch { throw new WhatsAppProviderError("ambiguous", "WhatsApp accepted an unreadable response; delivery is uncertain."); }
      const messageId = body && typeof body === "object" && Array.isArray(body.messages) && typeof body.messages[0]?.id === "string" ? body.messages[0].id : null;
      if (!messageId) throw new WhatsAppProviderError("ambiguous", "WhatsApp returned an unexpected success response; delivery is uncertain.");
      return { messageId };
    },
  };
}
