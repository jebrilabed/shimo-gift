"use client";
import { useActionState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { saveAddress, type AccountState } from "../actions";
import { phase7Messages as messages } from "@/lib/phase7/messages";
type AddressValues = { id?: string; fullName?: string; phone?: string; addressLine?: string; city?: string; postalCode?: string | null; notes?: string | null; isDefault?: boolean };
export function AddressForm({ address, label }: { address?: AddressValues; label: string }) {
  const [state, action, pending] = useActionState(saveAddress, {} as AccountState);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="addressId" value={address?.id ?? ""} />
    <Input label={messages.ar.fullName} name="fullName" required maxLength={120} defaultValue={address?.fullName ?? ""} />
    <Input label={messages.ar.phone} name="phone" required maxLength={40} dir="ltr" defaultValue={address?.phone ?? ""} />
    <Input label={messages.ar.addressLine} name="addressLine" required maxLength={500} defaultValue={address?.addressLine ?? ""} />
    <Input label={messages.ar.city} name="city" required maxLength={120} defaultValue={address?.city ?? ""} />
    <Input label={messages.ar.postalCode} name="postalCode" maxLength={24} defaultValue={address?.postalCode ?? ""} />
    <Textarea label={messages.ar.notes} name="notes" maxLength={1000} defaultValue={address?.notes ?? ""} />
    <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} />{messages.ar.makeDefault}</label>
    <div className="sm:col-span-2"><ToastMessage eventKey={state} message={state.error} tone="error" /><ToastMessage eventKey={state} message={state.success} tone="success" /><Button loading={pending}>{label}</Button></div>
  </form>;
}
