import { timingSafeEqual } from "node:crypto";

export function isAuthorizedNotificationCron(authorizationHeader, expectedSecret) {
  if (typeof expectedSecret !== "string" || expectedSecret.length < 32 || typeof authorizationHeader !== "string") return false;
  if (!authorizationHeader.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorizationHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
