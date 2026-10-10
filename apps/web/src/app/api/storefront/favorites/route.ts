import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { storeCurrency } from "@/lib/phase7/validation.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { slugs?: unknown }).slugs)) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }

  const slugs = [...new Set((body as { slugs: unknown[] }).slugs.filter(
    (slug): slug is string => typeof slug === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,119}$/u.test(slug),
  ))].slice(0, 200);

  if (slugs.length === 0) return Response.json({ products: [], currency: storeCurrency });

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      translations: { some: { locale: Locale.AR, slug: { in: slugs } } },
    },
    select: {
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
      translations: { where: { locale: Locale.AR, slug: { in: slugs } }, take: 1, select: { name: true, slug: true } },
      skus: { where: { isActive: true }, select: { price: true } },
      category: { select: { translations: { where: { locale: Locale.AR }, take: 1, select: { name: true } } } },
    },
  });

  return Response.json({
    currency: storeCurrency,
    products: products.flatMap((product) => {
      const translation = product.translations[0];
      if (!translation) return [];
      const minimumPrice = product.skus.reduce<number | null>((minimum, sku) => {
        const price = Number(sku.price.toString());
        return minimum === null || price < minimum ? price : minimum;
      }, null);
      return [{
        slug: translation.slug,
        name: translation.name,
        image: product.images[0] ?? null,
        category: product.category?.translations[0]?.name ?? null,
        price: minimumPrice?.toFixed(2) ?? null,
      }];
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}