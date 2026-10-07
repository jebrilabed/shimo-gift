import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { attachGuestCookie, getChatActor } from "@/lib/ai/chat-actor";
import { prisma } from "@/lib/db/prisma";
import { requestAIChat } from "@/lib/ai/chat-client";
import { buildConversationOwnershipFilter } from "@/lib/ai/tool-contract.mjs";

export const dynamic = "force-dynamic";
const maxMessageLength = 2000;
const maxHistory = 8;

export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  let actor;
  try { actor = await getChatActor(); } catch { return NextResponse.json({ error: "authentication-required" }, { status: 403 }); }
  const { threadId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(threadId)) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const where = buildConversationOwnershipFilter(actor.owner, threadId);
  if (!where) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const thread = await prisma.chatConversation.findFirst({ where, select: { id: true } });
  if (!thread) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: thread.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  const response = NextResponse.json({ messages: messages.reverse() }, { headers: { "Cache-Control": "no-store" } });
  attachGuestCookie(response, actor);
  return response;
}

export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  let actor;
  try { actor = await getChatActor(); } catch { return NextResponse.json({ error: "authentication-required" }, { status: 403 }); }
  const { threadId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(threadId)) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const where = buildConversationOwnershipFilter(actor.owner, threadId);
  if (!where) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const thread = await prisma.chatConversation.findFirst({ where, select: { id: true } });
  if (!thread) return NextResponse.json({ error: "not-found" }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid-request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  const message = "message" in body && typeof body.message === "string" ? body.message.trim() : "";
  const locale = "locale" in body && body.locale === "en" ? "en" : "ar";
  if (!message || message.length > maxMessageLength) return NextResponse.json({ error: "invalid-message" }, { status: 400 });

  const recent = await prisma.chatMessage.findMany({
    where: { conversationId: thread.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: maxHistory,
    select: { role: true, content: true },
  });
  const headerRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = /^[A-Za-z0-9-]{1,80}$/.test(headerRequestId) ? headerRequestId : randomUUID();
  let answer: string;
  try {
    answer = await requestAIChat({
      subject: actor.subject,
      role: actor.role,
      conversationId: thread.id,
      locale,
      message,
      history: recent.reverse().flatMap((item) => item.role === "USER" || item.role === "ASSISTANT"
        ? [{ role: item.role, content: item.content.slice(0, 1500) }]
        : []),
    }, requestId);
  } catch {
    return NextResponse.json({ error: "assistant-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.createMany({ data: [
      { conversationId: thread.id, role: "USER", content: message },
      { conversationId: thread.id, role: "ASSISTANT", content: answer },
    ] });
    await tx.chatConversation.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  });
  const response = NextResponse.json({ message: { role: "ASSISTANT", content: answer } }, { headers: { "Cache-Control": "no-store" } });
  attachGuestCookie(response, actor);
  return response;
}
