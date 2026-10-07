import { timingSafeEqual } from "node:crypto";

export function isAuthorizedAIService(value, expectedSecret) {
  if (typeof value !== "string" || typeof expectedSecret !== "string" || expectedSecret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
