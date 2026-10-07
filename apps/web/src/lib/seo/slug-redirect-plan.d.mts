export function planSlugRedirects(redirects: { oldSlug: string; newSlug: string }[], oldSlug: string, newSlug: string): {
  updates: { oldSlug: string; newSlug: string }[]; removals: string[]; redirect: { oldSlug: string; newSlug: string } | null;
};
