import { checkEnvironment } from "@/lib/config/environment-readiness.mjs";

export function GET() {
  const issues = checkEnvironment();
  const ready = issues.length === 0;
  return Response.json({
    service: "web",
    status: ready ? "ok" : "not-ready",
    readiness: ready ? "environment-ready" : "environment-incomplete",
    checks: {
      application: "ok",
      database: process.env.DATABASE_URL ? "configured" : "not-configured",
      auth: process.env.AUTH_SECRET ? "configured" : "not-configured",
    },
    issues,
  }, { status: ready ? 200 : 503 });
}
