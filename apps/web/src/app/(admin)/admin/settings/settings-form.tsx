"use client";
import { useActionState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { saveStoreSettings } from "./actions";
import { phase7Messages as messages } from "@/lib/phase7/messages";
type SettingsValues = { storeName: string; description: string; contactPhone: string; email: string; address: string; isActive: boolean };
export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, action, pending] = useActionState(saveStoreSettings, {});
  return <form action={action} className="admin-form max-w-3xl">
    <Input label={messages.ar.storeName} name="storeName" required maxLength={120} defaultValue={values.storeName} />
    <Textarea label={messages.ar.storeDescription} name="description" rows={4} maxLength={2000} defaultValue={values.description} />
    <input type="hidden" name="currency" value="ILS" />
    <p>{messages.ar.currency}: ILS — {messages.ar.currencyILS}</p>
    <Input label={messages.ar.contactPhone} name="contactPhone" maxLength={40} dir="ltr" defaultValue={values.contactPhone} />
    <Input label={messages.ar.storeEmail} name="email" type="email" maxLength={254} dir="ltr" defaultValue={values.email} />
    <Textarea label={messages.ar.storeAddress} name="address" rows={3} maxLength={500} defaultValue={values.address} />
    <Select label={messages.ar.defaultLocale} name="defaultLocale" defaultValue="ar"><option value="ar">{messages.ar.Arabic}</option></Select>
    <label className="admin-checkbox"><input type="checkbox" name="isActive" defaultChecked={values.isActive} /><span>{messages.ar.storeActive}</span></label>
    {state.error && <p className="admin-feedback admin-feedback--error" role="alert">{state.error}</p>}{state.success && <p className="admin-feedback admin-feedback--success" role="status">{state.success}</p>}
    <div className="admin-page__actions"><Button loading={pending}>{messages.ar.saveSettings}</Button></div>
  </form>;
}
