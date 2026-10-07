"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import type { LoginState } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";

const invalidCredentialsMessage = "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.";

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim().length === 0 ||
    email.length > 254 ||
    password.length < 8 ||
    password.length > 128
  ) {
    return { error: invalidCredentialsMessage };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { role: true },
    });
    await signIn("credentials", {
      email: email.trim(),
      password,
      redirectTo: user?.role === "ADMIN" ? "/admin" : "/ar",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: invalidCredentialsMessage };
    throw error;
  }

  return { error: invalidCredentialsMessage };
}
