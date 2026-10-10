"use client";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { updateProfile } from "./actions";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return <form action={action} className="flex max-w-lg flex-col gap-4"><Input label={messages.ar.registerName} name="name" defaultValue={name} required maxLength={120} autoComplete="name" /><ToastMessage eventKey={state} message={state.error} tone="error" /><ToastMessage eventKey={state} message={state.success} tone="success" /><Button loading={pending}>{messages.ar.saveName}</Button></form>;
}
