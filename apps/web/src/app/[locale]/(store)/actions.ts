"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ensureActiveCart, readCartTokenHash } from "@/lib/storefront/cart";
import { parseCartQuantity, parseCheckoutInput } from "@/lib/storefront/order-workflow.mjs";
import { createOrderFromCart, StorefrontOperationError } from "@/lib/storefront/orders";
import { checkoutOwnerBinding, verifyCheckoutAttemptToken } from "@/lib/storefront/checkout-security.mjs";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

const textField = (data: FormData, field: string) => {
  const value = data.get(field);
  return typeof value === "string" ? value.trim() : "";
};

export async function addToCartAction(formData: FormData) {
  const skuId = textField(formData, "skuId");
  const parsedQuantity = parseCartQuantity(formData.get("quantity"));
  if (!skuId || skuId.length > 64 || !parsedQuantity.ok) redirect("/ar/cart?notice=invalid");
  const quantity = parsedQuantity.quantity;

  let failure: string | null = null;
  try {
    const cart = await ensureActiveCart();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cart.id} FOR UPDATE`);
      const initialSku = await tx.productSku.findUnique({ where: { id: skuId }, select: { productId: true } });
      if (!initialSku) throw new StorefrontOperationError("invalid-cart");
      const settings = await tx.storeSettings.findUnique({ where: { id: "singleton" }, select: { isActive: true } });
      if (settings?.isActive === false) throw new StorefrontOperationError("store-inactive");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${initialSku.productId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "product_skus" WHERE "id" = ${skuId} FOR UPDATE`);
      const sku = await tx.productSku.findUnique({
        where: { id: skuId },
        select: {
          id: true,
          stockQuantity: true,
          isActive: true,
          product: {
            select: {
              status: true,
              translations: { where: { locale: Locale.AR }, take: 1, select: { id: true } },
              category: { select: { status: true } },
            },
          },
        },
      });
      if (!sku || !sku.isActive || sku.product.status !== ProductStatus.ACTIVE ||
        (sku.product.category && sku.product.category.status !== "ACTIVE") || !sku.product.translations.length) {
        throw new StorefrontOperationError("invalid-cart");
      }
      const existing = await tx.cartItem.findUnique({
        where: { cartId_skuId: { cartId: cart.id, skuId } },
        select: { quantity: true },
      });
      const finalQuantity = (existing?.quantity ?? 0) + quantity;
      if (finalQuantity > sku.stockQuantity) throw new StorefrontOperationError("stock-changed");
      await tx.cartItem.upsert({
        where: { cartId_skuId: { cartId: cart.id, skuId } },
        create: { cartId: cart.id, skuId, quantity },
        update: { quantity: { increment: quantity } },
      });
    });
  } catch (error) {
    failure = error instanceof StorefrontOperationError && error.reason === "stock-changed" ? "stock" : "unavailable";
    if (!(error instanceof StorefrontOperationError)) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      console.error("Cart add failed.", { code });
    }
  }
  if (failure) redirect(`/ar/cart?notice=${failure}`);
  revalidatePath("/ar");
  revalidatePath("/ar/cart");
  redirect("/ar/cart?notice=added");
}

export async function updateCartQuantityAction(formData: FormData) {
  const itemId = textField(formData, "itemId");
  const parsedQuantity = parseCartQuantity(formData.get("quantity"));
  if (!itemId || itemId.length > 64 || !parsedQuantity.ok) redirect("/ar/cart?notice=invalid");
  const quantity = parsedQuantity.quantity;

  let notice = "updated";
  try {
    const cart = await ensureActiveCart();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cart.id} FOR UPDATE`);
      const initialItem = await tx.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, select: { skuId: true } });
      if (!initialItem) throw new StorefrontOperationError("invalid-cart");
      const initialSku = await tx.productSku.findUnique({ where: { id: initialItem.skuId }, select: { productId: true } });
      if (!initialSku) throw new StorefrontOperationError("invalid-cart");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${initialSku.productId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "product_skus" WHERE "id" = ${initialItem.skuId} FOR UPDATE`);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
        select: {
          id: true,
          sku: {
            select: {
              id: true,
              stockQuantity: true,
              isActive: true,
              product: { select: { status: true, translations: { where: { locale: Locale.AR }, take: 1, select: { id: true } }, category: { select: { status: true } } } },
            },
          },
        },
      });
      if (!item) throw new StorefrontOperationError("invalid-cart");
      const available = item.sku.isActive && item.sku.product.status === ProductStatus.ACTIVE &&
        (!item.sku.product.category || item.sku.product.category.status === "ACTIVE") && item.sku.product.translations.length > 0;
      if (!available) throw new StorefrontOperationError("invalid-cart");
      if (quantity > item.sku.stockQuantity) throw new StorefrontOperationError("stock-changed");
      await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
    });
  } catch (error) {
    if (error instanceof StorefrontOperationError) {
      notice = error.reason === "stock-changed" ? "stock" : "unavailable";
    } else {
      notice = "error";
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      console.error("Cart quantity update failed.", { code });
    }
  }
  revalidatePath("/ar");
  revalidatePath("/ar/cart");
  redirect(`/ar/cart?notice=${notice}`);
}

export async function removeCartItemAction(formData: FormData) {
  const itemId = textField(formData, "itemId");
  if (!itemId || itemId.length > 64) redirect("/ar/cart?notice=invalid");
  try {
    const cart = await ensureActiveCart();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cart.id} FOR UPDATE`);
      await tx.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Cart item removal failed.", { code });
    redirect("/ar/cart?notice=error");
  }
  revalidatePath("/ar");
  revalidatePath("/ar/cart");
  redirect("/ar/cart?notice=removed");
}

export async function clearCartAction() {
  try {
    const cart = await ensureActiveCart();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cart.id} FOR UPDATE`);
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Cart clear failed.", { code });
    redirect("/ar/cart?notice=error");
  }
  revalidatePath("/ar");
  revalidatePath("/ar/cart");
  redirect("/ar/cart?notice=cleared");
}

export type CheckoutActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: { contactName: string; contactPhone: string; address: string; city: string; customerNote: string; addressId?: string };
};

export async function submitCheckoutAction(_previousState: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> {
  const parsed = parseCheckoutInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values: parsed.values };
  const checkoutValues = parsed.value;
  let checkoutStage = "session";
  try {
    const user = await getCurrentUser();
    const userId = user?.role === "CUSTOMER" ? user.id : null;
    const guestTokenHash = userId ? null : await readCartTokenHash();
    if (!userId && !guestTokenHash) return { error: messages.ar.cartEmptyError, values: checkoutValues };
    const secret = process.env.AUTH_SECRET ?? "";
    const ownerBinding = userId
      ? checkoutOwnerBinding(secret, "customer", userId)
      : checkoutOwnerBinding(secret, "guest", guestTokenHash!);
    const checkoutAttempt = ownerBinding
      ? verifyCheckoutAttemptToken(textField(formData, "checkoutToken"), secret, ownerBinding)
      : null;
    if (!checkoutAttempt) return { error: messages.ar.checkoutUnavailable, values: checkoutValues };

    checkoutStage = "create-order";
    const order = await createOrderFromCart({
      guestTokenHash,
      userId,
      ...checkoutValues,
      idempotencyKey: checkoutAttempt.idempotencyKey,
      quote: checkoutAttempt.quote,
    });
    checkoutStage = "refresh-pages";
    revalidatePath("/ar");
    revalidatePath("/ar/cart");
    revalidatePath("/ar/orders");
    redirect(`/ar/order-confirmation/${order.orderNumber}`);
  } catch (error) {
    if (error instanceof StorefrontOperationError) {
      if (error.reason === "empty-cart") return { error: messages.ar.cartEmptyError, values: checkoutValues };
      if (error.reason === "stock-changed") return { error: messages.ar.stockChanged, values: checkoutValues };
      if (error.reason === "invalid-cart") return { error: messages.ar.cartInvalid, values: checkoutValues };
      if (error.reason === "cart-changed") return { error: messages.ar.checkoutCartChanged, values: checkoutValues };
      if (error.reason === "invalid-checkout-attempt") return { error: messages.ar.checkoutUnavailable, values: checkoutValues };
      if (error.reason === "currency-not-configured") return { error: messages.ar.currencyNotConfigured, values: checkoutValues };
      if (error.reason === "store-inactive") return { error: messages.ar.storeInactive, values: checkoutValues };
      if (error.reason === "address-unavailable") return { error: messages.ar.addressUnavailable, values: checkoutValues };
    }
    // Next redirects are thrown control-flow errors and must pass through untouched.
    if (error && typeof error === "object" && "digest" in error) throw error;
    const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const cause = errorRecord.cause && typeof errorRecord.cause === "object"
      ? errorRecord.cause as Record<string, unknown>
      : {};
    console.error("Checkout order creation failed.", {
      stage: checkoutStage,
      name: typeof errorRecord.name === "string" ? errorRecord.name : "unknown",
      code: typeof errorRecord.code === "string" ? errorRecord.code : "unknown",
      causeName: typeof cause.name === "string" ? cause.name : "unknown",
      causeCode: typeof cause.code === "string" ? cause.code : "unknown",
    });
    return { error: messages.ar.databaseUnavailable, values: checkoutValues };
  }
  return { error: messages.ar.genericError, values: checkoutValues };
}

export async function recoverCheckoutAttemptAction(token: string): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    const userId = user?.role === "CUSTOMER" ? user.id : null;
    const guestTokenHash = userId ? null : await readCartTokenHash();
    if (!userId && !guestTokenHash) return null;
    const secret = process.env.AUTH_SECRET ?? "";
    const ownerBinding = userId
      ? checkoutOwnerBinding(secret, "customer", userId)
      : checkoutOwnerBinding(secret, "guest", guestTokenHash!);
    if (!ownerBinding) return null;
    const attempt = verifyCheckoutAttemptToken(token, secret, ownerBinding);
    if (!attempt) return null;
    const order = await prisma.order.findUnique({
      where: { idempotencyKey: attempt.idempotencyKey },
      select: { orderNumber: true, userId: true },
    });
    return order?.userId === userId ? order.orderNumber : null;
  } catch {
    return null;
  }
}
