import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkEnvironment } from "../src/lib/config/environment-readiness.mjs";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@db.example:5432/farasha?sslmode=require",
  AUTH_SECRET: "deployment-test-secret-that-is-long-enough",
};

test("production readiness accepts only a public HTTPS SITE_URL", () => {
  assert.deepEqual(checkEnvironment({ ...base, SITE_URL: "https://shop.example" }), []);
  for (const SITE_URL of [
    "http://shop.example",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:pass@shop.example",
    "https://shop.example/path?query=1",
    "not-a-url",
  ]) {
    assert.ok(checkEnvironment({ ...base, SITE_URL }).some((issue) => issue.startsWith("SITE_URL")), SITE_URL);
  }
});

test("Vercel uses the monorepo root and generates Prisma Client before building", async () => {
  const config = JSON.parse(await readFile(new URL("../../../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.framework, "nextjs");
  assert.equal(config.installCommand, "npm ci");
  assert.match(config.buildCommand, /db:generate.*build:web/);
});

test("AI container binds to the platform port and excludes local environment files", async () => {
  const dockerfile = await readFile(new URL("../../ai/Dockerfile", import.meta.url), "utf8");
  const ignore = await readFile(new URL("../../ai/.dockerignore", import.meta.url), "utf8");
  assert.match(dockerfile, /python:3\.12-slim/);
  assert.match(dockerfile, /USER farasha/);
  assert.match(dockerfile, /\$\{PORT:-\$\{AI_PORT:-8000\}\}/);
  assert.match(ignore, /^\.env\.\*$/m);
});
