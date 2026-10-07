import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createCurrentUserReader } from "./current-user-reader.mjs";
import { authorizeRole, AuthenticationRequiredError, AuthorizationDeniedError } from "./authorization-policy.mjs";

export { AuthenticationRequiredError, AuthorizationDeniedError };

export const getCurrentUser = createCurrentUserReader(
  () => auth(),
  (id) => prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  }),
);

export async function requireUser() {
  return authorizeRole(await getCurrentUser(), ["CUSTOMER", "ADMIN"]);
}

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError();
  if (user.role !== "CUSTOMER") throw new AuthorizationDeniedError();
  return user;
}

export async function requireCustomerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role !== "CUSTOMER") notFound();
  return user;
}

export async function requireRole(roles: readonly ("CUSTOMER" | "ADMIN")[]) {
  return authorizeRole(await getCurrentUser(), roles);
}

export function requireAdmin() {
  return requireRole(["ADMIN"]);
}

/** Page guard uses Next navigation signals so unauthenticated page renders stop
 * before route data queries begin. Server actions should use requireAdmin(). */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  if (user.role !== "ADMIN") notFound();
  return user;
}
