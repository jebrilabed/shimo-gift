"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus } from "@/generated/prisma/enums";
import { AuthorizationDeniedError, AuthenticationRequiredError, requireAdmin } from "@/lib/auth/authorization";
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
