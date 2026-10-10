"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import type { AdminActionState } from "@/lib/admin/config";

type FormAction = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function ActionForm({
  action,
  fields,
  label,
  variant = "outline",
  confirmMessage,
  className,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "outline" | "ghost";
  confirmMessage?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} onSubmit={(event) => {
      if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
    }}>
      {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
      <Button type="submit" variant={variant} size="small" loading={pending} className={className}>{label}</Button>
      <ToastMessage eventKey={state} message={state.error} tone="error" />
      <ToastMessage eventKey={state} message={state.success} tone="success" />
    </form>
  );
}
