"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({ children, className, disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button className={className} type="submit" loading={pending} disabled={disabled}>{children}</Button>;
}
