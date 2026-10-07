import "server-only";

import { randomBytes, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/authorization";

export const AI_GUEST_COOKIE = "farasha_ai_guest";

export type ChatOwner = { userId: string | null; guestTokenHash: string | null };
export type ChatActor = {
  owner: ChatOwner;
  subject: string;
  role: "CUSTOMER" | "GUEST";
  guestCookie?: string;
};

function tokenDigest(token: string, secret: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export async function getChatActor(): Promise<ChatActor> {
  const user = await getCurrentUser();
  if (user) {
    if (user.role !== "CUSTOMER") throw new Error("Customer chat access is required.");
    return { owner: { userId: user.id, guestTokenHash: null }, subject: user.id, role: "CUSTOMER" };
  }
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("Guest chat is not configured.");
  const jar = await cookies();
  const existing = jar.get(AI_GUEST_COOKIE)?.value;
  const valid = typeof existing === "string" && /^[A-Za-z0-9_-]{43}$/.test(existing);
  const token = valid ? existing : randomBytes(32).toString("base64url");
  const digest = tokenDigest(token, secret);
  return {
    owner: { userId: null, guestTokenHash: digest },
    subject: digest,
    role: "GUEST",
    ...(!valid ? { guestCookie: token } : {}),
  };
}

export function attachGuestCookie(response: NextResponse, actor: ChatActor) {
  if (actor.guestCookie) response.cookies.set(AI_GUEST_COOKIE, actor.guestCookie, chatGuestCookieOptions());
}

export function chatGuestCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/ai",
    maxAge: 60 * 60 * 24 * 30,
  };
}
