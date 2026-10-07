import { NextResponse } from "next/server";
import { attachGuestCookie, getChatActor } from "@/lib/ai/chat-actor";
import { prisma } from "@/lib/db/prisma";
import { buildConversationOwnershipFilter } from "@/lib/ai/tool-contract.mjs";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  let actor;
  try { actor = await getChatActor(); } catch { return NextResponse.json({ error: "authentication-required" }, { status: 403 }); }
  const { threadId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(threadId)) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const where = buildConversationOwnershipFilter(actor.owner, threadId);
  if (!where) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const deleted = await prisma.chatConversation.deleteMany({ where });
  const response = deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not-found" }, { status: 404 });
  attachGuestCookie(response, actor);
  return response;
}
