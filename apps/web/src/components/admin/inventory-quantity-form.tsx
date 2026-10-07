"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui";
import { adminMessages as messages } from "@/lib/admin/messages";
import type { AdminActionState } from "@/lib/admin/config";
import { updateInventory } from "@/app/(admin)/admin/actions";
import { SubmitButton } from "./submit-button";

export function InventoryQuantityForm({ skuId, productId, quantity }: { skuId: string; productId: string; quantity: number }) {
  const [state, action] = useActionState<AdminActionState, FormData>(updateInventory, {});
  const [quantityValue, setQuantityValue] = useState(String(quantity));
  useEffect(() => {
    setQuantityValue(String(quantity));
  }, [quantity, state.success]);
  return <form className="admin-inline-form" action={action}>
    <input type="hidden" name="skuId" value={skuId} />
    <input type="hidden" name="productId" value={productId} />
    <Input name="quantity" label={messages.ar.quantity} type="number" min="0" max="999999999" step="1" value={quantityValue} onChange={(event) => setQuantityValue(event.target.value)} error={state.error} />
    <SubmitButton>{messages.ar.updateStock}</SubmitButton>
    {state.error && <span className="admin-form-feedback admin-form-feedback--error" role="alert">{state.error}</span>}
    {state.success && <span className="admin-form-feedback admin-form-feedback--success" role="status">{state.success}</span>}
  </form>;
}
