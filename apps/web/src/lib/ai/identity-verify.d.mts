export function verifyAIIdentityToken(token: string | null, secret: string, now?: number): { sub: string; conversationId: string; locale: "ar" | "en"; role: "CUSTOMER" | "GUEST" } | null;
