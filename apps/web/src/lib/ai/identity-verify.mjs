import { createHmac, timingSafeEqual } from "node:crypto";

function decodePart(value) {
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { return null; }
}

export function verifyAIIdentityToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length > 4096 || typeof secret !== "string" || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT" || !claims || typeof claims !== "object") return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  let received;
  try { received = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (claims.iss !== "farasha-web" || claims.aud !== "farasha-ai" || !["CUSTOMER", "GUEST"].includes(claims.role) ||
    typeof claims.sub !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(claims.sub) ||
    typeof claims.conversation_id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(claims.conversation_id) ||
    !["ar", "en"].includes(claims.locale) || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
    claims.iat > now + 30 || claims.exp <= now || claims.exp - claims.iat > 120) return null;
  return {
    sub: claims.sub,
    conversationId: claims.conversation_id,
    locale: claims.locale,
    role: claims.role,
  };
}
