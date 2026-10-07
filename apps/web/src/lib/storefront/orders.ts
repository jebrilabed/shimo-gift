import "server-only";

import { randomBytes } from "node:crypto";
import { CartStatus, Locale, OrderStatus, ProductStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { storeCurrency } from "@/lib/phase7/validation.mjs";
import { canTransitionOrder } from "./order-workflow.mjs";
import { checkoutCartBinding, checkoutQuoteMatches } from "./checkout-security.mjs";
import { calculateCheckoutAmounts } from "./checkout-pricing.mjs";
import { buildOrderNotificationEvent, getOrderNotificationEventType } from "@/lib/notifications/order-events.mjs";
import { findOwnedCustomerAddress } from "./address-ownership.mjs";

export class StorefrontOperationError extends Error {
  constructor(readonly reason: "empty-cart" | "stock-changed" | "invalid-cart" | "cart-changed" | "invalid-checkout-attempt" | "invalid-transition" | "missing-sku" | "already-cancelled" | "restock-unavailable" | "currency-not-configured" | "store-inactive" | "address-unavailable") {
    super(reason);
    this.name = "StorefrontOperationError";
  }
}

export async function getStoreCurrency() {
  return storeCurrency;
}

function newOrderNumber() {
  return `FAR-${randomBytes(16).toString("hex").toUpperCase()}`;
}

export async function createOrderFromCart({
  guestTokenHash,
  userId,
  contactName,
  contactPhone,
  address,
  city,
  customerNote,
  addressId,
  idempotencyKey,
  quote,
}: {
  guestTokenHash: string | null;
  userId: string | null;
  contactName: string;
  contactPhone: string;
  address: string;
  city: string;
  customerNote: string;
  addressId?: string;
  idempotencyKey: string;
  quote: {
    cartBinding: string;
    currency: string;
    items: { skuId: string; quantity: number; unitPrice: string }[];
  };
}) {
  return prisma.$transaction(async (tx) => {
    const findExistingOrder = async () => {
      const existing = await tx.order.findUnique({
        where: { idempotencyKey },
        select: { id: true, orderNumber: true, status: true, createdAt: true, total: true, currency: true, userId: true },
      });
      if (!existing) return null;
      if (existing.userId !== userId) throw new StorefrontOperationError("invalid-checkout-attempt");
      return {
        id: existing.id,
        orderNumber: existing.orderNumber,
        status: existing.status,
        createdAt: existing.createdAt,
        total: existing.total,
        currency: existing.currency,
      };
    };
    const previousOrder = await findExistingOrder();
    if (previousOrder) return previousOrder;

    const cart = await tx.cart.findFirst({
      where: {
        ...(userId ? { userId } : { guestTokenHash: guestTokenHash ?? undefined, userId: null }),
        status: CartStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!cart) throw new StorefrontOperationError("empty-cart");

    const lockedCart = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "carts" WHERE "id" = ${cart.id} FOR UPDATE
    `);
    if (!lockedCart.length) throw new StorefrontOperationError("empty-cart");

    // A concurrent duplicate can be waiting for this cart row. Recheck after the
    // lock so it reuses the committed order instead of seeing the converted cart.
    const orderAfterLock = await findExistingOrder();
    if (orderAfterLock) return orderAfterLock;

    const cartItems = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      select: { skuId: true, quantity: true },
      orderBy: [{ skuId: "asc" }],
    });
    if (!cartItems.length) throw new StorefrontOperationError("empty-cart");

    const skuIds = cartItems.map(({ skuId }) => skuId);
    const cartWithDetails = await tx.cart.findUnique({
      where: { id: cart.id },
      select: {
        items: {
          where: { skuId: { in: skuIds } },
          select: {
            id: true,
            skuId: true,
            quantity: true,
            sku: {
              select: {
                id: true,
                productId: true,
              },
            },
          },
        },
      },
    });
    if (!cartWithDetails || cartWithDetails.items.length !== cartItems.length) {
      throw new StorefrontOperationError("invalid-cart");
    }

    const productIds = [...new Set(cartWithDetails.items.map(({ sku }) => sku.productId))].sort();
    for (const productId of productIds) {
      const productLock = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE
      `);
      if (!productLock.length) throw new StorefrontOperationError("invalid-cart");
    }
    for (const skuId of skuIds) {
      const skuLock = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "product_skus" WHERE "id" = ${skuId} FOR UPDATE
      `);
      if (!skuLock.length) throw new StorefrontOperationError("invalid-cart");
    }

    const freshItems = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: [{ skuId: "asc" }],
      select: {
        skuId: true,
        quantity: true,
        sku: {
          select: {
            id: true,
            skuCode: true,
            price: true,
            stockQuantity: true,
            isActive: true,
            variantOptions: true,
            product: {
              select: {
                id: true,
                status: true,
                translations: { where: { locale: Locale.AR }, take: 1, select: { name: true } },
                category: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    if (!freshItems.length) throw new StorefrontOperationError("empty-cart");

    const amounts = calculateCheckoutAmounts(freshItems.map(({ sku, quantity }) => ({ unitPrice: sku.price.toFixed(2), quantity })));
    if (!amounts) throw new StorefrontOperationError("invalid-cart");
    const subtotal = new Prisma.Decimal(amounts.subtotal);
    const shippingCost = new Prisma.Decimal(amounts.shipping);
    const total = new Prisma.Decimal(amounts.total);
    const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const [index, item] of freshItems.entries()) {
      const { sku, quantity } = item;
      const available = sku.isActive &&
        sku.product.status === ProductStatus.ACTIVE &&
        (sku.product.category === null || sku.product.category.status === "ACTIVE") &&
        sku.product.translations.length > 0;
      if (!available) throw new StorefrontOperationError("invalid-cart");
      if (sku.stockQuantity < quantity) throw new StorefrontOperationError("stock-changed");

      const lineTotal = new Prisma.Decimal(amounts.lineSubtotals[index]);
      orderItems.push({
        sku: { connect: { id: sku.id } },
        productNameSnapshot: sku.product.translations[0].name,
        skuCodeSnapshot: sku.skuCode,
        variantSnapshot: sku.variantOptions ?? Prisma.JsonNull,
        unitPrice: sku.price,
        quantity,
        subtotal: lineTotal,
      });
    }

    const currentQuoteItems = freshItems.map(({ sku, quantity }) => ({
      skuId: sku.id,
      quantity,
      unitPrice: sku.price.toFixed(2),
    }));
    if (checkoutCartBinding(process.env.AUTH_SECRET ?? "", cart.id) !== quote.cartBinding ||
      !checkoutQuoteMatches(quote.items, currentQuoteItems)) {
      throw new StorefrontOperationError("cart-changed");
    }

    const settings = await tx.storeSettings.findUnique({ where: { id: "singleton" }, select: { isActive: true } });
    if (settings?.isActive === false) throw new StorefrontOperationError("store-inactive");
    const currency = storeCurrency;
    if (quote.currency !== currency) throw new StorefrontOperationError("cart-changed");
    if (addressId && !userId) throw new StorefrontOperationError("address-unavailable");
    const savedAddress = addressId ? await findOwnedCustomerAddress(tx, addressId, userId!) : null;
    if (addressId && !savedAddress) throw new StorefrontOperationError("address-unavailable");
    const finalContactName = savedAddress?.fullName ?? contactName;
    const finalContactPhone = savedAddress?.phone ?? contactPhone;
    const shippingAddress = savedAddress
      ? { address: savedAddress.addressLine, city: savedAddress.city, postalCode: savedAddress.postalCode, notes: savedAddress.notes }
      : { address, city };
    const customer = userId ? await tx.customer.findUnique({ where: { userId }, select: { id: true, email: true } }) : null;

    for (const item of freshItems) {
      const changed = await tx.productSku.updateMany({
        where: { id: item.sku.id, isActive: true, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (changed.count !== 1) throw new StorefrontOperationError("stock-changed");
    }

    const orderNumber = newOrderNumber();
    const order = await tx.order.create({
      data: {
        orderNumber,
        idempotencyKey,
        userId,
        customerId: customer?.id ?? null,
        status: OrderStatus.PENDING,
        paymentStatus: "UNPAID",
        contactName: finalContactName,
        contactPhone: finalContactPhone,
        contactEmail: customer?.email ?? null,
        shippingAddress,
        customerNote: customerNote || null,
        currency,
        subtotal,
        shippingCost,
        total,
        items: { create: orderItems },
      },
      select: { id: true, orderNumber: true, status: true, createdAt: true, total: true, currency: true },
    });

    const createdNotification = buildOrderNotificationEvent("ORDER_CREATED", {
      ...order,
      contactName: finalContactName,
      contactPhone: finalContactPhone,
    });
    if (createdNotification) await tx.notificationOutbox.create({ data: createdNotification });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { status: CartStatus.CONVERTED } });
    return order;
  });
}

export async function changeOrderStatus(orderId: string, nextStatus: OrderStatus, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        contactName: true,
        contactPhone: true,
        total: true,
        currency: true,
        items: { select: { skuId: true, quantity: true } },
      },
    });
    if (!order) return { ok: false as const, reason: "not-found" as const };
    if (order.status === OrderStatus.CANCELLED && nextStatus === OrderStatus.CANCELLED) {
      return { ok: false as const, reason: "already-cancelled" as const };
    }
    if (!canTransitionOrder(order.status, nextStatus)) return { ok: false as const, reason: "transition" as const };
    if (nextStatus === OrderStatus.CANCELLED && order.items.some((item) =>
      item.skuId === null || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
    )) {
      return { ok: false as const, reason: "missing-sku" as const };
    }

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: nextStatus },
    });
    if (updated.count !== 1) {
      if (nextStatus === OrderStatus.CANCELLED) {
        const latest = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
        if (latest?.status === OrderStatus.CANCELLED) return { ok: false as const, reason: "already-cancelled" as const };
      }
      return { ok: false as const, reason: "transition" as const };
    }

    if (nextStatus === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        if (!item.skuId) throw new StorefrontOperationError("missing-sku");
        const restored = await tx.productSku.updateMany({
          where: { id: item.skuId, stockQuantity: { lte: 2_147_483_647 - item.quantity } },
          data: { stockQuantity: { increment: item.quantity } },
        });
        if (restored.count !== 1) throw new StorefrontOperationError("restock-unavailable");
      }
    }

    await tx.adminAuditLog.create({
      data: {
        actorUserId,
        action: nextStatus === OrderStatus.CANCELLED ? "orders.cancel" : "orders.status.update",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          from: order.status,
          to: nextStatus,
          inventoryRestored: nextStatus === OrderStatus.CANCELLED,
          ...(nextStatus === OrderStatus.CANCELLED ? {
            restockedItems: order.items.map(({ skuId, quantity }) => ({ skuId, quantity })),
          } : {}),
        },
      },
    });
    const eventType = getOrderNotificationEventType(nextStatus);
    const notification = eventType && buildOrderNotificationEvent(eventType, order);
    if (notification) await tx.notificationOutbox.create({ data: notification });
    return { ok: true as const, orderNumber: order.orderNumber, from: order.status, to: nextStatus };
  });
}
