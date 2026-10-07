"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { deleteAddress, setDefaultAddress } from "../actions";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export function AddressActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [defaultState, defaultAction, defaultPending] = useActionState(setDefaultAddress, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAddress, {});
  return <div className="flex flex-wrap gap-2">
    {!isDefault && <form action={defaultAction}><input type="hidden" name="addressId" value={id} /><Button variant="outline" size="small" loading={defaultPending}>{messages.ar.setDefault}</Button></form>}
    <form action={deleteAction}><input type="hidden" name="addressId" value={id} /><Button variant="ghost" size="small" loading={deletePending}>{messages.ar.delete}</Button></form>
    {defaultState.error && <p role="alert">{defaultState.error}</p>}{defaultState.success && <p role="status">{defaultState.success}</p>}
    {deleteState.error && <p role="alert">{deleteState.error}</p>}{deleteState.success && <p role="status">{deleteState.success}</p>}
  </div>;
}
