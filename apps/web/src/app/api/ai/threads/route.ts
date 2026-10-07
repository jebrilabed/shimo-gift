import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { attachGuestCookie, getChatActor } from "@/lib/ai/chat-actor";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
const maxThreads = 20;

export async function GET() {
  let actor;
  try { actor = await getChatActor(); } catch { return NextResponse.json({ error: "authentication-required" }, { status: 403 }); }
  const threads = await prisma.chatConversation.findMany({
    where: actor.owner,
    orderBy: { updatedAt: "desc" },
    take: maxThreads,
    select: { id: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  const response = NextResponse.json({ threads: threads.map(({ id, createdAt, updatedAt, _count }) => ({ id, createdAt, updatedAt, messageCount: _count.messages })) }, { headers: { "Cache-Control": "no-store" } });
  attachGuestCookie(response, actor);
  return response;
}

export async function POST() {
  let actor;
  try { actor = await getChatActor(); } catch { return NextResponse.json({ error: "authentication-required" }, { status: 403 }); }
  const count = await prisma.chatConversation.count({ where: actor.owner });
  if (count >= maxThreads) return NextResponse.json({ error: "conversation-limit" }, { status: 409 });
  const conversation = await prisma.chatConversation.create({
    data: { ...actor.owner, customerId: null, metadata: { createdBy: "store-assistant", requestId: randomUUID() } },
    select: { id: true, createdAt: true, updatedAt: true },
  });
  const response = NextResponse.json({ thread: conversation }, { status: 201, headers: { "Cache-Control": "no-store" } });
  attachGuestCookie(response, actor);
  return response;
}
