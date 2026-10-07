"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function StorefrontSubmitButton({ children, pendingText, disabled = false }: {
  children: React.ReactNode;
  pendingText: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} disabled={disabled}>{pending ? pendingText : children}</Button>;
}
