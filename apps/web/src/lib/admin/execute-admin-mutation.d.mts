export function executeAdminMutation<TAdmin, TResult>(
  requireAdmin: () => Promise<TAdmin>,
  operation: (admin: TAdmin) => Promise<TResult>,
): Promise<{ ok: true; value: TResult } | { ok: false; reason: "unauthenticated" | "forbidden" }>;
