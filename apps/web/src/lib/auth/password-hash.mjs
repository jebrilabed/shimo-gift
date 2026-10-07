import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("Password length is outside the allowed range.");
  }

  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || password.length < 1 || password.length > 128) return false;
  if (typeof encodedHash !== "string") return false;

  const [algorithm, nValue, rValue, pValue, saltValue, keyValue, extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    nValue !== String(SCRYPT_N) ||
    rValue !== String(SCRYPT_R) ||
    pValue !== String(SCRYPT_P) ||
    !saltValue ||
    !keyValue ||
    extra !== undefined
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(keyValue, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;

    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
