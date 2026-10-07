import "server-only";
import { Locale } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { planSlugRedirects } from "@/lib/seo/slug-redirect-plan.mjs";

type RedirectTransaction = Pick<typeof prisma, "slugRedirect">;

export async function preservePublicSlug(
  tx: RedirectTransaction,
  input: { resourceType: "PRODUCT" | "CATEGORY" | "CONTENT_PAGE"; locale: Locale; oldSlug: string; newSlug: string },
) {
  const { resourceType, locale, oldSlug, newSlug } = input;
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;
  const scope = { resourceType, locale };
  const existing = await tx.slugRedirect.findMany({ where: scope, select: { oldSlug: true, newSlug: true } });
  const plan = planSlugRedirects(existing, oldSlug, newSlug);
  for (const update of plan.updates) await tx.slugRedirect.update({ where: { resourceType_locale_oldSlug: { ...scope, oldSlug: update.oldSlug } }, data: { newSlug: update.newSlug } });
  for (const remove of plan.removals) await tx.slugRedirect.delete({ where: { resourceType_locale_oldSlug: { ...scope, oldSlug: remove } } });
  await tx.slugRedirect.upsert({
    where: { resourceType_locale_oldSlug: { ...scope, oldSlug: plan.redirect!.oldSlug } },
    create: { ...scope, ...plan.redirect! },
    update: { newSlug: plan.redirect!.newSlug },
  });
}
