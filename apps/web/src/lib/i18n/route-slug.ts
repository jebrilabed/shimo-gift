/** Decode a dynamic route segment before looking up its stored Unicode slug. */
export function decodeRouteSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
