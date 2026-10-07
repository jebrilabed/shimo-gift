"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { parseImage, parseSku } from "@/lib/phase7/validation.mjs";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export type ManagementState = { error?: string; success?: string };
const fieldText = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

export async function saveSku(_previous: ManagementState, data: FormData): Promise<ManagementState> {
  let admin; try { admin = await requireAdmin(); } catch { return { error: messages.ar.skuUnauthorized }; }
  const parsed = parseSku(data); const productId = fieldText(data, "productId");
  if (!parsed.ok || !productId || productId.length > 64) return { error: messages.ar.skuInvalid };
  const { id, ...value } = parsed.value;
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, kind: true } });
      if (!product) throw new Error("product-not-found");
      let previousStock: number | null = null;
      if (id) {
        const current = await tx.$queryRaw<{ id: string; skuCode: string; stockQuantity: number }[]>(Prisma.sql`
          SELECT "id", "skuCode", "stockQuantity" FROM "product_skus"
          WHERE "id" = ${id} AND "productId" = ${productId}
          FOR UPDATE
        `);
        if (!current.length) throw new Error("sku-not-owned");
        previousStock = current[0].stockQuantity;
        await tx.productSku.update({ where: { id }, data: { ...value, skuCode: current[0].skuCode, price: new Prisma.Decimal(value.price), variantOptions: Object.keys(value.variantOptions).length ? value.variantOptions : Prisma.JsonNull } });
      } else {
        if (product.kind === "SIMPLE") {
          await tx.product.update({ where: { id: productId }, data: { kind: "VARIANT" } });
          await tx.productSku.updateMany({ where: { productId }, data: { isDefault: false } });
        }
        let skuCode: string;
        do {
          skuCode = `FAR-${randomUUID().toUpperCase()}`;
        } while (await tx.productSku.findUnique({ where: { skuCode }, select: { id: true } }));
        await tx.productSku.create({ data: { ...value, skuCode, productId, price: new Prisma.Decimal(value.price), isDefault: false, variantOptions: Object.keys(value.variantOptions).length ? value.variantOptions : Prisma.JsonNull } });
      }
      await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: id ? "catalog.sku.update" : "catalog.sku.create", entityType: "ProductSku", entityId: id || productId, metadata: { productId, fromQuantity: previousStock, toQuantity: value.stockQuantity, isActive: value.isActive } } });
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Product SKU save failed.", { code });
    return { error: code === "P2002" ? messages.ar.skuDuplicate : messages.ar.skuSaveFailed };
  }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/admin/products"); revalidatePath("/admin/inventory"); revalidatePath("/ar"); revalidatePath("/ar/products/[slug]", "page"); revalidatePath("/sitemap.xml");
  return { success: messages.ar.skuSaved };
}

export async function saveImage(_previous: ManagementState, data: FormData): Promise<ManagementState> {
  let admin; try { admin = await requireAdmin(); } catch { return { error: messages.ar.imageUnauthorized }; }
  const parsed = parseImage(data); const productId = fieldText(data, "productId");
  if (!parsed.ok || !productId || productId.length > 64) return { error: messages.ar.imageInvalid };
  const { imageId, ...value } = parsed.value;
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new Error("product-not-found");
      if (imageId) {
        const current = await tx.productImage.findFirst({ where: { id: imageId, productId }, select: { id: true } });
        if (!current) throw new Error("image-not-owned");
        await tx.productImage.update({ where: { id: imageId }, data: value });
      } else {
        const order = await tx.productImage.count({ where: { productId } });
        if (order >= 8) throw new Error("image-limit");
        await tx.productImage.create({ data: { ...value, productId, sortOrder: order } });
      }
      await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: imageId ? "catalog.image.update" : "catalog.image.create", entityType: "ProductImage", entityId: imageId || productId, metadata: { productId } } });
    });
  } catch (error) { const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown"; console.error("Product image save failed.", { code }); return { error: messages.ar.imageSaveFailed }; }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/admin/products"); revalidatePath("/ar"); revalidatePath("/ar/products/[slug]", "page"); revalidatePath("/sitemap.xml");
  return { success: messages.ar.imageSaved };
}

export async function deleteImage(_previous: ManagementState, data: FormData): Promise<ManagementState> {
  let admin; try { admin = await requireAdmin(); } catch { return { error: messages.ar.imageUnauthorized }; }
  const productId = fieldText(data, "productId"); const imageId = fieldText(data, "imageId");
  if (!productId || !imageId || productId.length > 64 || imageId.length > 64) return { error: messages.ar.imageMissing };
  try { await prisma.$transaction(async (tx) => { const image = await tx.productImage.findFirst({ where: { id: imageId, productId }, select: { id: true } }); if (!image) throw new Error("not-owned"); await tx.productImage.delete({ where: { id: imageId } }); const rest = await tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true } }); for (const [sortOrder, item] of rest.entries()) await tx.productImage.update({ where: { id: item.id }, data: { sortOrder } }); await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "catalog.image.delete", entityType: "ProductImage", entityId: imageId, metadata: { productId } } }); }); }
  catch { return { error: messages.ar.imageDeleteFailed }; }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/admin/products"); revalidatePath("/ar"); revalidatePath("/ar/products/[slug]", "page"); revalidatePath("/sitemap.xml"); return { success: messages.ar.imageDeleted };
}

export async function makePrimaryImage(_previous: ManagementState, data: FormData): Promise<ManagementState> {
  let admin; try { admin = await requireAdmin(); } catch { return { error: messages.ar.imageUnauthorized }; }
  const productId = fieldText(data, "productId"); const imageId = fieldText(data, "imageId");
  if (!productId || !imageId) return { error: messages.ar.imageMissing };
  try { await prisma.$transaction(async (tx) => { const images = await tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true } }); if (!images.some((image) => image.id === imageId)) throw new Error("not-owned"); const sorted = [images.find((image) => image.id === imageId)!, ...images.filter((image) => image.id !== imageId)]; for (const [sortOrder, image] of sorted.entries()) await tx.productImage.update({ where: { id: image.id }, data: { sortOrder } }); await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "catalog.image.primary", entityType: "ProductImage", entityId: imageId, metadata: { productId } } }); }); }
  catch { return { error: messages.ar.imagePrimaryFailed }; }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/ar"); revalidatePath("/ar/products/[slug]", "page"); return { success: messages.ar.imagePrimarySaved };
}

export async function moveImage(_previous: ManagementState, data: FormData): Promise<ManagementState> {
  let admin; try { admin = await requireAdmin(); } catch { return { error: messages.ar.imageUnauthorized }; }
  const productId = fieldText(data, "productId"); const imageId = fieldText(data, "imageId"); const direction = fieldText(data, "direction");
  if (!productId || !imageId || !["up", "down"].includes(direction)) return { error: messages.ar.imageMoveFailed };
  try { await prisma.$transaction(async (tx) => { const images = await tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true } }); const index = images.findIndex((image) => image.id === imageId); if (index < 0) throw new Error("not-owned"); const target = index + (direction === "up" ? -1 : 1); if (target < 0 || target >= images.length) return; [images[index], images[target]] = [images[target], images[index]]; for (const [sortOrder, image] of images.entries()) await tx.productImage.update({ where: { id: image.id }, data: { sortOrder } }); await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "catalog.image.reorder", entityType: "ProductImage", entityId: imageId, metadata: { productId, direction } } }); }); }
  catch { return { error: messages.ar.imageMoveFailed }; }
  revalidatePath(`/admin/products/${productId}`); revalidatePath("/ar"); revalidatePath("/ar/products/[slug]", "page"); return { success: messages.ar.imageMoved };
}
