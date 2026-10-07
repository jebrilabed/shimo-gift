"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { AdminActionState } from "@/lib/admin/config";

type FormAction = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function ActionForm({
  action,
  fields,
  label,
  variant = "outline",
  confirmMessage,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "outline" | "ghost";
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} onSubmit={(event) => {
      if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
    }}>
      {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
      <Button type="submit" variant={variant} size="small" loading={pending}>{label}</Button>
      {state.error && <span className="admin-form-feedback" role="alert">{state.error}</span>}
      {state.success && <span className="admin-form-feedback admin-form-feedback--success" role="status">{state.success}</span>}
    </form>
  );
}
