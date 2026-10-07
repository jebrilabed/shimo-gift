import { NextResponse } from "next/server";
import { isAuthorizedAIService } from "@/lib/ai/tool-auth.mjs";
import { validateAIToolRequest } from "@/lib/ai/tool-contract.mjs";
import { executeStoreAssistantTool } from "@/lib/ai/store-tools";
import { verifyAIIdentityToken } from "@/lib/ai/identity-verify.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedAIService(request.headers.get("authorization"), process.env.AI_INTERNAL_SERVICE_TOKEN ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid-request" }, { status: 400 }); }
  const validated = validateAIToolRequest(body);
  if (!validated) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  const identity = verifyAIIdentityToken(request.headers.get("x-farasha-identity"), process.env.AI_INTERNAL_SERVICE_TOKEN ?? "");
  if (!identity || !["CUSTOMER", "GUEST"].includes(identity.role)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.locale !== validated.locale) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  if (validated.tool === "get_order_status" && identity.role !== "CUSTOMER") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  try {
    const result = await executeStoreAssistantTool(validated.tool, validated.arguments, identity.sub, validated.locale);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI store tool failed.", { tool: validated.tool, errorType: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "tool-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
