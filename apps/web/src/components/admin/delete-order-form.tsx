"use client";

import { Button } from "@/components/ui";
import { deleteOrderAction } from "@/app/(admin)/admin/orders/actions";

export function DeleteOrderForm({
  orderId,
  label,
  confirmMessage,
}: {
  orderId: string;
  label: string;
  confirmMessage: string;
}) {
  return (
    <form action={deleteOrderAction} onSubmit={(event) => {
      if (!window.confirm(confirmMessage)) event.preventDefault();
    }}>
      <input name="orderId" type="hidden" value={orderId} />
      <Button className="admin-delete-button" size="small" type="submit" variant="ghost">{label}</Button>
    </form>
  );
}
