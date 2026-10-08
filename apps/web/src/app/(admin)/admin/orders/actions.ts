"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { AuthorizationDeniedError, AuthenticationRequiredError, requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { changeOrderStatus, StorefrontOperationError } from "@/lib/storefront/orders";

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
