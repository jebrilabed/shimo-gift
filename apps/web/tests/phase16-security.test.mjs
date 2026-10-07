import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createCurrentUserReader } from "../src/lib/auth/current-user-reader.mjs";
import { findOwnedCustomerAddress } from "../src/lib/storefront/address-ownership.mjs";
import { serializeJsonLd } from "../src/lib/seo/public-seo.mjs";

test("missing and malformed sessions fail closed without a database lookup", async () => {
  for (const session of [null, {}, { user: {} }, { user: { id: "" } }]) {
    let databaseRead = false;
    const readUser = createCurrentUserReader(async () => session, async () => {
      databaseRead = true;
      return null;
    });
    assert.equal(await readUser(), null);
    assert.equal(databaseRead, false);
  }

  const deletedUserSession = createCurrentUserReader(
    async () => ({ user: { id: "customer-deleted" } }),
    async () => null,
  );
  assert.equal(await deletedUserSession(), null);
});

test("address access is scoped to the server-authenticated owner", async () => {
  const addresses = [
    { id: "address-a", userId: "customer-a", addressLine: "A" },
    { id: "address-b", userId: "customer-b", addressLine: "B" },
  ];
  const queries = [];
  const tx = { customerAddress: { findFirst: async (query) => {
    queries.push(query);
    return addresses.find((address) => address.id === query.where.id && address.userId === query.where.userId) ?? null;
  } } };

  assert.equal((await findOwnedCustomerAddress(tx, "address-a", "customer-a")).addressLine, "A");
  assert.equal(await findOwnedCustomerAddress(tx, "address-b", "customer-a"), null);
  assert.deepEqual(queries[1].where, { id: "address-b", userId: "customer-a" });
  assert.equal(await findOwnedCustomerAddress(tx, "bad/id", "customer-a"), null);
  assert.equal(queries.length, 2, "malformed IDs must be rejected before querying");
});

test("Next applies safe browser security headers and sends HSTS only in production", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /process\.env\.NODE_ENV === "production"/);
  assert.match(config, /Strict-Transport-Security/);
});

test("JSON-LD escapes script-opening markup before the only HTML injection sink", () => {
  const encoded = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.equal(encoded.includes("</script>"), false);
  assert.equal(encoded.includes("\\u003c/script>"), true);
});

test("example environment values are placeholders and keep secrets server-side", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /DATABASE_URL=.*USER:.*HOST:.*DATABASE/);
  assert.match(example, /AUTH_SECRET=.*REPLACE_WITH_A_RANDOM_SECRET/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_(?:DATABASE_URL|AUTH_SECRET|GEMINI_API_KEY|AI_INTERNAL_SERVICE_TOKEN)/);
});
