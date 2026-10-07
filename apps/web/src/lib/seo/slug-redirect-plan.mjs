export function planSlugRedirects(redirects, oldSlug, newSlug) {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return { updates: [], removals: [], redirect: null };
  const updates = new Map();
  for (const item of redirects) {
    if (item.oldSlug !== newSlug && item.newSlug === oldSlug) updates.set(item.oldSlug, newSlug);
  }
  return {
    updates: [...updates].map(([from, to]) => ({ oldSlug: from, newSlug: to })),
    removals: redirects.filter((item) => item.oldSlug === newSlug).map((item) => item.oldSlug),
    redirect: { oldSlug, newSlug },
  };
}
