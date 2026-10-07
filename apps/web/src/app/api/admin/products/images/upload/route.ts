import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const maxFileSize = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("unauthorized", 403);
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return errorResponse("unauthorized", 401);
    if (error instanceof AuthorizationDeniedError) return errorResponse("unauthorized", 403);
    return errorResponse("unauthorized", 401);
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
  if (!cloudName || !apiKey || !apiSecret) return errorResponse("upload-not-configured", 503);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxFileSize + 64 * 1024) return errorResponse("file-too-large", 413);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("invalid-file", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) return errorResponse("invalid-file", 400);
  if (file.size > maxFileSize) return errorResponse("file-too-large", 413);
  if (!allowedTypes.has(file.type)) return errorResponse("invalid-file-type", 415);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesImageSignature(file.type, header)) return errorResponse("invalid-file-type", 415);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `farasha/products/${randomUUID()}`;
  const parameters = { public_id: publicId, timestamp };
  const toSign = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
  const uploadData = new FormData();
  uploadData.append("file", file, "product-image");
  uploadData.append("api_key", apiKey);
  uploadData.append("timestamp", timestamp);
  uploadData.append("public_id", publicId);
  uploadData.append("signature", signature);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: "POST",
      body: uploadData,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => null) as {
      secure_url?: unknown;
      public_id?: unknown;
      error?: { message?: unknown };
    } | null;
    if (!response.ok || typeof result?.secure_url !== "string" || typeof result.public_id !== "string") {
      const providerMessage = typeof result?.error?.message === "string" ? result.error.message : "";
      const createPermissionDenied = response.status === 403 && /missing permissions/i.test(providerMessage) && /create/i.test(providerMessage);
      console.error("Product image upload provider request failed.", {
        status: response.status,
        reason: createPermissionDenied ? "create-permission-denied" : "provider-rejected",
      });
      if (createPermissionDenied) return errorResponse("upload-permission-denied", 502);
      return errorResponse("upload-failed", 502);
    }

    const imageUrl = new URL(result.secure_url);
    if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "res.cloudinary.com" || !imageUrl.pathname.startsWith(`/${cloudName}/image/upload/`) || result.public_id !== publicId) {
      console.error("Product image upload provider returned an invalid asset reference.");
      return errorResponse("upload-failed", 502);
    }
    return NextResponse.json({ url: imageUrl.toString(), publicId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Product image upload provider request failed.");
    return errorResponse("upload-failed", 502);
  }
}
