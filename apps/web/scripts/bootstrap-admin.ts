import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password-hash.mjs";

loadEnv({ path: ".env.local" });

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 16 || password.length > 128) {
    console.error("Admin bootstrap requires a valid ADMIN_BOOTSTRAP_EMAIL and a 16–128 character ADMIN_BOOTSTRAP_PASSWORD.");
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Admin bootstrap requires DATABASE_URL in apps/web/.env.local.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  let stage = "database lookup";

  try {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      console.error("Admin bootstrap refused: that email already belongs to a user; no account was changed.");
      process.exitCode = 1;
    } else {
      stage = "password hashing";
      const passwordHash = await hashPassword(password);
      stage = "admin account creation";
      await prisma.user.create({
        data: { email, passwordHash, role: "ADMIN" },
        select: { id: true },
      });
      console.log("Administrator account created.");
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    console.error(
      `Admin bootstrap failed during ${stage}${code ? ` (error code: ${code})` : ""}. Check the database configuration and try again.`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error("Admin bootstrap failed. Check the database configuration and try again.");
  process.exitCode = 1;
});
