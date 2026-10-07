import "server-only";
import { createAIIdentityToken } from "@/lib/ai/identity-token";

type ChatRequest = {
  subject: string;
  role: "CUSTOMER" | "GUEST";
  conversationId: string;
  locale: "ar" | "en";
  message: string;
  history: { role: "USER" | "ASSISTANT"; content: string }[];
};

export async function requestAIChat(body: ChatRequest, requestId: string) {
  const token = process.env.AI_INTERNAL_SERVICE_TOKEN ?? "";
  const serviceUrl = process.env.AI_SERVICE_URL ?? "";
  if (token.length < 32 || !serviceUrl) throw new Error("AI service configuration is unavailable.");
  let endpoint: URL;
  try { endpoint = new URL("/api/v1/ai/chat", serviceUrl); } catch { throw new Error("AI service configuration is invalid."); }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") throw new Error("AI service URL must use HTTP(S).");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Farasha-Identity": createAIIdentityToken({ subject: body.subject, role: body.role, conversationId: body.conversationId, locale: body.locale }),
    },
    body: JSON.stringify({ conversation_id: body.conversationId, locale: body.locale, message: body.message, history: body.history }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error("AI service request failed.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("message" in result) || typeof result.message !== "string" || result.message.length > 4000) {
    throw new Error("AI service response was invalid.");
  }
  return result.message.trim();
}
