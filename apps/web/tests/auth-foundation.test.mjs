import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { authorizeRole, AuthenticationRequiredError, AuthorizationDeniedError } from "../src/lib/auth/authorization-policy.mjs";
import { createCurrentUserReader } from "../src/lib/auth/current-user-reader.mjs";
import { hashPassword, verifyPassword } from "../src/lib/auth/password-hash.mjs";

test("unauthenticated users cannot pass role authorization", () => {
  assert.throws(
    () => authorizeRole(null, ["ADMIN"]),
    AuthenticationRequiredError,
  );
});

test("a CUSTOMER cannot pass admin authorization", () => {
  assert.throws(
    () => authorizeRole({ id: "customer-id", role: "CUSTOMER" }, ["ADMIN"]),
    AuthorizationDeniedError,
  );
});

test("an ADMIN passes admin authorization", () => {
  const admin = { id: "admin-id", role: "ADMIN" };
  assert.equal(authorizeRole(admin, ["ADMIN"]), admin);
});

test("current identity comes from the server session and current database role", async () => {
  let lookedUpId = null;
  const readCurrentUser = createCurrentUserReader(
    async () => ({ user: { id: "session-user", role: "ADMIN" } }),
    async (id) => {
      lookedUpId = id;
      return { id, role: "CUSTOMER" };
    },
  );

  const currentUser = await readCurrentUser();
  assert.equal(lookedUpId, "session-user");
  assert.deepEqual(currentUser, { id: "session-user", role: "CUSTOMER" });
});

test("password hashes are salted, verifiable, and do not store the plaintext", async () => {
  const password = "Pass1234";
  await assert.rejects(hashPassword("Pass123"), /outside the allowed range/);
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, secondHash);
  assert.equal(firstHash.includes(password), false);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("incorrect-passphrase", firstHash), false);
});

test("guest checkout remains optional in the database model", async () => {
  const schema = await readFile(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /model Cart\s*\{[\s\S]*?userId\s+String\?/);
  assert.match(schema, /model Order\s*\{[\s\S]*?userId\s+String\?/);
});
