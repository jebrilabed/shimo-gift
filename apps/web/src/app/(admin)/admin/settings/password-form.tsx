"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { adminMessages } from "@/lib/admin/messages";
import { changeAdminPassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeAdminPassword, {});

  return (
    <div className="max-w-xl">
      <form action={action} className="admin-form">
        <Input label={adminMessages.ar.currentPassword} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} dir="ltr" />
        <Input label={adminMessages.ar.newPassword} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} dir="ltr" />
        <Input label={adminMessages.ar.confirmNewPassword} name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} dir="ltr" />
        <ToastMessage eventKey={state} message={state.error} tone="error" />
        <ToastMessage eventKey={state} message={state.success} tone="success" />
        <div className="admin-page__actions"><Button type="submit" loading={pending}>{adminMessages.ar.updatePassword}</Button></div>
      </form>
    </div>
  );
}
