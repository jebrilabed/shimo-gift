"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null });

  return (
    <form action={action} className="flex flex-col gap-5">
      <Input
        autoComplete="username"
        dir="ltr"
        label="البريد الإلكتروني"
        maxLength={254}
        name="email"
        required
        type="email"
      />
      <Input
        autoComplete="current-password"
        label="كلمة المرور"
        maxLength={128}
        minLength={8}
        name="password"
        required
        type="password"
      />
      <ToastMessage eventKey={state} message={state.error} tone="error" />
      <Button loading={pending} type="submit">
        دخول
      </Button>
    </form>
  );
}
