export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationDeniedError extends Error {
  constructor() {
    super("You are not authorized to access this resource.");
    this.name = "AuthorizationDeniedError";
  }
}

export function authorizeRole(user, allowedRoles) {
  if (!user) throw new AuthenticationRequiredError();
  if (!allowedRoles.includes(user.role)) throw new AuthorizationDeniedError();
  return user;
}
