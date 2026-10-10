"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationStatus, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AuthorizationDeniedError, AuthenticationRequiredError, requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { changeOrderStatus, StorefrontOperationError } from "@/lib/storefront/orders";

class OrderDeletionError extends Error {
  constructor(readonly notice: "deleteMissingSku" | "deleteRestockUnavailable") {
    super(notice);
    this.name = "OrderDeletionError";
  }
}

export async function updateOrderStatusAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "").trim();
  if (!orderId || orderId.length > 64 || !Object.values(OrderStatus).includes(statusValue as OrderStatus)) {
    redirect("/admin/orders?notice=invalid");
  }

  let notice = "updated";
  try {
    const admin = await requireAdmin();
    const result = await changeOrderStatus(orderId, statusValue as OrderStatus, admin.id);
    if (!result.ok) {
      notice = result.reason === "not-found" ? "notFound"
        : result.reason === "missing-sku" ? "missingSku"
          : result.reason === "already-cancelled" ? "alreadyCancelled"
            : "transition";
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/ar/login");
    if (error instanceof AuthorizationDeniedError) redirect("/admin/orders?notice=denied");
    if (error instanceof StorefrontOperationError && error.reason === "missing-sku") notice = "missingSku";
    else if (error instanceof StorefrontOperationError && error.reason === "restock-unavailable") notice = "restockUnavailable";
    else {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      console.error("Admin order status update failed.", { code });
      notice = "error";
    }
  }
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/ar/orders");
  redirect(`/admin/orders/${encodeURIComponent(orderId)}?notice=${notice}`);
}

export async function updatePaymentStatusAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const statusValue = String(formData.get("paymentStatus") ?? "").trim();
  if (!orderId || orderId.length > 64) {
    redirect("/admin/orders?notice=invalid");
  }
  if (!Object.values(PaymentStatus).includes(statusValue as PaymentStatus)) {
    redirect(`/admin/orders/${encodeURIComponent(orderId)}?notice=paymentInvalid`);
  }

  let notice = "paymentUpdated";
  try {
    const admin = await requireAdmin();
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, paymentStatus: true } });
      if (!order) return { ok: false as const, reason: "not-found" as const };
      if (order.paymentStatus === statusValue) return { ok: true as const, changed: false };

      const updated = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: order.paymentStatus },
        data: { paymentStatus: statusValue as PaymentStatus },
      });
      if (updated.count !== 1) return { ok: false as const, reason: "conflict" as const };

      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "orders.payment-status.update",
          entityType: "Order",
          entityId: orderId,
          metadata: { orderNumber: order.orderNumber, from: order.paymentStatus, to: statusValue },
        },
      });
      return { ok: true as const, changed: true };
    });
    if (!result.ok) notice = result.reason === "not-found" ? "notFound" : "paymentUpdateFailed";
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/ar/login");
    if (error instanceof AuthorizationDeniedError) redirect("/admin/orders?notice=denied");
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Admin order payment status update failed.", { code });
    notice = "paymentUpdateFailed";
  }

  if (notice === "paymentUpdated") {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${encodeURIComponent(orderId)}`);
    revalidatePath("/ar/orders");
    revalidatePath("/ar/orders/[orderNumber]", "page");
  }
  redirect(`/admin/orders/${encodeURIComponent(orderId)}?notice=${notice}`);
}

export async function deleteOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId || orderId.length > 64) redirect("/admin/orders?notice=invalid");

  let notice = "deleted";
  try {
    const admin = await requireAdmin();
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE
      `);
      if (!locked.length) return "not-found" as const;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          items: { select: { skuId: true, quantity: true } },
        },
      });
      if (!order) return "not-found" as const;

      // Keep the dispatcher from claiming a pending message while deletion is in progress.
      await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "notification_outbox" WHERE "orderId" = ${order.id} FOR UPDATE
      `);
      const processingNotification = await tx.notificationOutbox.findFirst({
        where: { orderId: order.id, status: NotificationStatus.PROCESSING },
        select: { id: true },
      });
      if (processingNotification) return "notification-processing" as const;

      const shouldRestock = order.status !== OrderStatus.CANCELLED &&
        order.status !== OrderStatus.SHIPPED &&
        order.status !== OrderStatus.DELIVERED;
      if (shouldRestock) {
        if (order.items.some((item) => item.skuId === null || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
          return "missing-sku" as const;
        }
        for (const item of order.items) {
          if (!item.skuId) throw new OrderDeletionError("deleteMissingSku");
          const restored = await tx.productSku.updateMany({
            where: { id: item.skuId, stockQuantity: { lte: 2_147_483_647 - item.quantity } },
            data: { stockQuantity: { increment: item.quantity } },
          });
          if (restored.count !== 1) throw new OrderDeletionError("deleteRestockUnavailable");
        }
      }

      await tx.notificationOutbox.deleteMany({ where: { orderId: order.id, status: NotificationStatus.PENDING } });
      await tx.notificationOutbox.updateMany({ where: { orderId: order.id }, data: { orderId: null } });
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "orders.delete",
          entityType: "Order",
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total.toString(),
            inventoryRestored: shouldRestock,
            ...(shouldRestock ? { restockedItems: order.items.map(({ skuId, quantity }) => ({ skuId, quantity })) } : {}),
          },
        },
      });
      await tx.order.delete({ where: { id: order.id } });
      return "deleted" as const;
    });

    if (result === "not-found") notice = "notFound";
    else if (result === "missing-sku") notice = "deleteMissingSku";
    else if (result === "notification-processing") notice = "deleteNotificationProcessing";
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/ar/login");
    if (error instanceof AuthorizationDeniedError) redirect("/admin/orders?notice=denied");
    if (error instanceof OrderDeletionError) {
      notice = error.notice;
    } else {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      console.error("Admin order deletion failed.", { code });
      notice = "deleteFailed";
    }
  }

  if (notice === "deleted") {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/ar/orders");
    revalidatePath("/ar/orders/[orderNumber]", "page");
  }
  if (notice === "deleted") redirect("/admin/orders?notice=deleted");
  redirect(`/admin/orders/${encodeURIComponent(orderId)}?notice=${notice}`);
}
