import "server-only";

import { createHmac } from "node:crypto";

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function createAIIdentityToken({ subject, role, conversationId, locale }: { subject: string; role: "CUSTOMER" | "GUEST"; conversationId: string; locale: "ar" | "en" }) {
  const secret = process.env.AI_INTERNAL_SERVICE_TOKEN ?? "";
  if (secret.length < 32) throw new Error("AI service configuration is unavailable.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: "farasha-web",
    aud: "farasha-ai",
    sub: subject,
    role,
    conversation_id: conversationId,
    locale,
    iat: now,
    exp: now + 120,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
