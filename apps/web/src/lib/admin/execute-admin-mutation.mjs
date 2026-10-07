export async function executeAdminMutation(requireAdmin, operation) {
  try {
    const admin = await requireAdmin();
    return { ok: true, value: await operation(admin) };
  } catch (error) {
    if (error && typeof error === "object" && error.name === "AuthenticationRequiredError") {
      return { ok: false, reason: "unauthenticated" };
    }
    if (error && typeof error === "object" && error.name === "AuthorizationDeniedError") {
      return { ok: false, reason: "forbidden" };
    }
    throw error;
  }
}
