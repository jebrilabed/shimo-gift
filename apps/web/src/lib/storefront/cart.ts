import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { CartStatus, Locale } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { CART_COOKIE_NAME, CART_LIFETIME_DAYS } from "./config";
import { mergeCartQuantity } from "./cart-workflow.mjs";

const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CART_LIFETIME_DAYS * 24 * 60 * 60,
};

function validToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function readCartTokenHash() {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE_NAME)?.value;
  return validToken(token) ? hashToken(token) : null;
}

async function ensureGuestCart() {
  const jar = await cookies();
  let token = jar.get(CART_COOKIE_NAME)?.value;
  if (!validToken(token)) {
    token = randomBytes(32).toString("base64url");
    jar.set(CART_COOKIE_NAME, token, cartCookieOptions);
  }

  const guestTokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CART_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const current = await tx.cart.findUnique({ where: { guestTokenHash }, select: { id: true, expiresAt: true } });
    if (current?.expiresAt && current.expiresAt <= now) {
      await tx.cartItem.deleteMany({ where: { cartId: current.id } });
    }
    return tx.cart.upsert({
      where: { guestTokenHash },
      create: { guestTokenHash, expiresAt },
      update: { status: CartStatus.ACTIVE, expiresAt },
      select: { id: true, guestTokenHash: true },
    });
  });
}

async function ensureCustomerCart(userId: string) {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE_NAME)?.value;
  const guestTokenHash = validToken(token) ? hashToken(token) : null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Serialize cart creation and guest merges per account without a new schema constraint.
    const userLock = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE
    `);
    if (!userLock.length) throw new Error("Authenticated cart owner no longer exists.");

    const customer = await tx.customer.findUnique({ where: { userId }, select: { id: true } });
    if (guestTokenHash) {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "carts"
        WHERE "guestTokenHash" = ${guestTokenHash} AND "userId" IS NULL AND "status" = 'ACTIVE'
        FOR UPDATE
      `);
    }
    const ownedCart = await tx.cart.findFirst({
      where: { userId, status: CartStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true },
    });
    if (ownedCart) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${ownedCart.id} FOR UPDATE`);
    }
    const guestCart = guestTokenHash ? await tx.cart.findFirst({
      where: { guestTokenHash, userId: null, status: CartStatus.ACTIVE },
      select: { id: true, expiresAt: true },
    }) : null;

    if (!ownedCart && guestCart) {
      if (guestCart.expiresAt && guestCart.expiresAt <= now) {
        await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      }
      return tx.cart.update({
        where: { id: guestCart.id },
        data: { userId, customerId: customer?.id ?? null, guestTokenHash: null, expiresAt: null },
        select: { id: true, guestTokenHash: true },
      });
    }

    const cart = ownedCart ?? await tx.cart.create({
      data: { userId, customerId: customer?.id ?? null, status: CartStatus.ACTIVE },
      select: { id: true },
    });

    if (guestCart && guestCart.id !== cart.id) {
      const guestItems = guestCart.expiresAt && guestCart.expiresAt <= now
        ? []
        : await tx.cartItem.findMany({ where: { cartId: guestCart.id }, select: { skuId: true, quantity: true } });
      const ownedItems = await tx.cartItem.findMany({ where: { cartId: cart.id }, select: { skuId: true, quantity: true } });
      const skuIds = [...new Set([...guestItems, ...ownedItems].map((item) => item.skuId))].sort();

      for (const skuId of skuIds) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "product_skus" WHERE "id" = ${skuId} FOR UPDATE`);
      }
      for (const skuId of skuIds) {
        const current = ownedItems.find((item) => item.skuId === skuId)?.quantity ?? 0;
        const incoming = guestItems.find((item) => item.skuId === skuId)?.quantity ?? 0;
        const sku = await tx.productSku.findUnique({ where: { id: skuId }, select: { stockQuantity: true } });
        const quantity = sku ? mergeCartQuantity(current, incoming, sku.stockQuantity) : 0;
        if (quantity === 0) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id, skuId } });
          continue;
        }
        await tx.cartItem.upsert({
          where: { cartId_skuId: { cartId: cart.id, skuId } },
          create: { cartId: cart.id, skuId, quantity },
          update: { quantity },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await tx.cart.update({
        where: { id: guestCart.id },
        data: { status: CartStatus.CONVERTED, guestTokenHash: null },
      });
    }

    return tx.cart.update({
      where: { id: cart.id },
      data: { customerId: customer?.id ?? null, expiresAt: null },
      select: { id: true, guestTokenHash: true },
    });
  });
}

/** Returns the cart belonging to the authenticated customer, or to the HTTP-only guest token. */
export async function ensureActiveCart() {
  const user = await getCurrentUser();
  return user?.role === "CUSTOMER" ? ensureCustomerCart(user.id) : ensureGuestCart();
}

export async function getCartCount() {
  const user = await getCurrentUser();
  if (user?.role === "CUSTOMER") {
    const cart = await ensureCustomerCart(user.id);
    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id }, select: { quantity: true } });
    return items.reduce((count, item) => count + item.quantity, 0);
  }

  const guestTokenHash = await readCartTokenHash();
  if (!guestTokenHash) return 0;
  const cart = await prisma.cart.findFirst({
    where: { guestTokenHash, status: CartStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { items: { select: { quantity: true } } },
  });
  return cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;
}

export async function getCartSnapshot() {
  const user = await getCurrentUser();
  let cartId: string;
  if (user?.role === "CUSTOMER") {
    // Customer cart access can merge an existing guest cart, but it never writes cookies.
    const cart = await ensureCustomerCart(user.id);
    cartId = cart.id;
  } else {
    // Rendering an empty guest cart must not create a cookie or mutate the database.
    // Guest carts are created by cart server actions, where cookie writes are allowed.
    const guestTokenHash = await readCartTokenHash();
    if (!guestTokenHash) return null;
    const cart = await prisma.cart.findFirst({
      where: {
        guestTokenHash,
        status: CartStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!cart) return null;
    cartId = cart.id;
  }
  return prisma.cart.findFirst({
    where: { id: cartId, status: CartStatus.ACTIVE },
    select: {
      id: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          sku: {
            select: {
              id: true,
              price: true,
              stockQuantity: true,
              isActive: true,
              variantOptions: true,
              product: {
                select: {
                  id: true,
                  slug: true,
                  status: true,
                  translations: { where: { locale: Locale.AR }, take: 1, select: { name: true, slug: true } },
                  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
                  category: { select: { status: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function isCartLineSellable(item: NonNullable<Awaited<ReturnType<typeof getCartSnapshot>>>["items"][number]) {
  return item.sku.isActive &&
    item.sku.product.status === "ACTIVE" &&
    (item.sku.product.category === null || item.sku.product.category.status === "ACTIVE") &&
    item.sku.product.translations.length > 0;
}

export function isCartLineAvailable(item: NonNullable<Awaited<ReturnType<typeof getCartSnapshot>>>["items"][number]) {
  return isCartLineSellable(item) && item.sku.stockQuantity > 0 && item.sku.stockQuantity >= item.quantity;
}
