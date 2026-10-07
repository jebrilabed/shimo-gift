export type UserRole = "CUSTOMER" | "ADMIN";
export interface RoleBearingUser {
  id: string;
  role: UserRole;
}
export class AuthenticationRequiredError extends Error {}
export class AuthorizationDeniedError extends Error {}
export function authorizeRole<TUser extends RoleBearingUser>(
  user: TUser | null,
  allowedRoles: readonly UserRole[],
): TUser;
