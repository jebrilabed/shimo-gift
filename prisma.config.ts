import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
loadEnv({ path: resolve(repositoryRoot, "apps/web/.env.local") });
loadEnv({ path: resolve(repositoryRoot, "apps/web/.env") });
loadEnv({ path: resolve(repositoryRoot, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Empty keeps format/validate/generate usable before local PostgreSQL setup.
    url: process.env.DATABASE_URL ?? "",
  },
});
