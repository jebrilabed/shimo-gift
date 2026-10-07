import "server-only";

import { Locale, Prisma, ProductStatus } from "@/generated/prisma/client";
import { buildOwnedOrderFilter } from "./tool-contract.mjs";
import { prisma } from "@/lib/db/prisma";
import { storeCurrency } from "@/lib/phase7/validation.mjs";

const safeLocale = (locale: "ar" | "en") => locale === "en" ? Locale.EN : Locale.AR;
const orderStatusLabels: Record<string, string> = {
  PENDING: "قيد المراجعة",
  CONFIRMED: "تم تأكيده",
  PROCESSING: "قيد التجهيز",
  SHIPPED: "تم شحنه",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغي",
};

function cleanVariant(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 8).flatMap(([key, item]): [string, string][] | [] => {
    if (!/^[\p{L}\p{N}_ -]{1,30}$/u.test(key)) return [];
    if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") return [];
    const text = String(item).slice(0, 60);
    return text ? [[key.slice(0, 30), text]] : [];
  }));
}

const publicProductInclude = (locale: Locale) => ({
  translations: { where: { locale: { in: [...new Set([locale, Locale.AR])] } }, take: 2, select: { locale: true, name: true, shortDescription: true, description: true, slug: true } },
  skus: { where: { isActive: true }, orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }], take: 8, select: { price: true, stockQuantity: true, variantOptions: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
});

type PublicProduct = Prisma.ProductGetPayload<{ include: ReturnType<typeof publicProductInclude> }>;

function productView(product: PublicProduct, locale: Locale, currency: string | null, available: boolean, activeSkuCount: number) {
  const translation = product.translations.find((item) => item.locale === locale);
  const arabicTranslation = product.translations.find((item) => item.locale === Locale.AR);
  if (!translation || !arabicTranslation) return null;
  return {
    name: translation.name,
    description: (translation.shortDescription ?? translation.description ?? null)?.slice(0, 500) ?? null,
    slug: arabicTranslation.slug,
    url: `/ar/products/${arabicTranslation.slug}`,
    imageUrl: product.images[0]?.url ?? null,
    variants: product.skus.slice(0, 8).map((sku) => ({
      options: cleanVariant(sku.variantOptions),
      price: currency ? sku.price.toFixed(2) : null,
      currency,
      inStock: sku.stockQuantity > 0,
    })),
    hasMoreVariants: activeSkuCount > product.skus.length,
    available,
  };
}

export async function executeStoreAssistantTool(tool: string, args: Record<string, unknown>, userId: string, locale: "ar" | "en") {
  const dbLocale = safeLocale(locale);
  if (tool === "search_products") {
    const query = String(args.query).trim().slice(0, 100);
    const words = [...new Set(query.split(/\s+/).filter(Boolean))].slice(0, 5);
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        AND: [
          ...words.map((word) => ({
            OR: [
              { translations: { some: { locale: dbLocale, name: { contains: word, mode: "insensitive" as const } } } },
              { translations: { some: { locale: dbLocale, shortDescription: { contains: word, mode: "insensitive" as const } } } },
              { category: { translations: { some: { locale: dbLocale, name: { contains: word, mode: "insensitive" as const } } } } },
            ],
          })),
          { OR: [{ categoryId: null }, { category: { status: "ACTIVE" } }] },
        ],
      },
      take: 5,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: publicProductInclude(dbLocale),
    });
    const currency = storeCurrency;
    const productIds = products.map((product) => product.id);
    const [availableGroups, skuGroups] = await Promise.all([
      prisma.productSku.groupBy({ by: ["productId"], where: { productId: { in: productIds }, isActive: true, stockQuantity: { gt: 0 } }, _count: { _all: true } }),
      prisma.productSku.groupBy({ by: ["productId"], where: { productId: { in: productIds }, isActive: true }, _count: { _all: true } }),
    ]);
    const availableById = new Map(availableGroups.map((item) => [item.productId, item._count._all]));
    const skuCountById = new Map(skuGroups.map((item) => [item.productId, item._count._all]));
    return { products: products.map((product) => productView(product, dbLocale, currency, (availableById.get(product.id) ?? 0) > 0, skuCountById.get(product.id) ?? 0)).filter(Boolean) };
  }

  if (tool === "get_product" || tool === "get_product_stock") {
    const slug = String(args.slug);
    const product = await prisma.product.findFirst({
      where: {
        status: ProductStatus.ACTIVE,
        AND: [
          { OR: [{ slug }, { translations: { some: { locale: dbLocale, slug } } }] },
          { OR: [{ categoryId: null }, { category: { status: "ACTIVE" } }] },
        ],
      },
      include: publicProductInclude(dbLocale),
    });
    if (!product) return { found: false };
    if (tool === "get_product") {
      const currency = storeCurrency;
      const [available, activeSkuCount] = await Promise.all([
        prisma.productSku.count({ where: { productId: product.id, isActive: true, stockQuantity: { gt: 0 } } }),
        prisma.productSku.count({ where: { productId: product.id, isActive: true } }),
      ]);
      return { found: true, product: productView(product, dbLocale, currency, available > 0, activeSkuCount) };
    }
    const variant = String(args.variant ?? "").trim().toLocaleLowerCase();
    const [stockSkus, totalSkus, availableCount] = await Promise.all([
      prisma.productSku.findMany({ where: { productId: product.id, isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], take: 64, select: { variantOptions: true, stockQuantity: true } }),
      prisma.productSku.count({ where: { productId: product.id, isActive: true } }),
      prisma.productSku.count({ where: { productId: product.id, isActive: true, stockQuantity: { gt: 0 } } }),
    ]);
    const skus = stockSkus.map((sku) => ({ options: cleanVariant(sku.variantOptions), inStock: sku.stockQuantity > 0 }));
    const selected = variant ? skus.filter((sku) => Object.values(sku.options).some((value) => String(value).toLocaleLowerCase().includes(variant))) : skus;
    if (!selected.length && variant && totalSkus > stockSkus.length) return { found: false, reason: "variant-list-too-large" };
    if (!selected.length && variant) return { found: false, reason: "variant-not-found" };
    return { found: true, variants: selected.slice(0, 8), hasMoreVariants: totalSkus > selected.length, available: variant ? selected.some((item) => item.inStock) : availableCount > 0 };
  }

  if (tool === "get_faq") {
    const query = String(args.query).trim().slice(0, 160);
    const words = [...new Set(query.split(/\s+/).filter(Boolean))].slice(0, 5);
    const faqs = await prisma.fAQ.findMany({
      where: { isActive: true, translations: { some: { locale: dbLocale, OR: words.flatMap((word) => [
        { question: { contains: word, mode: "insensitive" as const } },
        { answer: { contains: word, mode: "insensitive" as const } },
      ]) } } },
      take: 5,
      orderBy: { sortOrder: "asc" },
      include: { translations: { where: { locale: dbLocale }, take: 1, select: { question: true, answer: true } } },
    });
    return { items: faqs.flatMap((faq) => faq.translations.map((item) => ({ question: item.question.slice(0, 300), answer: item.answer.slice(0, 2000) }))) };
  }

  if (tool === "get_shipping_policy" || tool === "get_return_policy") {
    const pageKey = tool === "get_shipping_policy" ? "shipping-policy" : "return-policy";
    const page = await prisma.contentPage.findFirst({
      where: { pageKey, isActive: true, translations: { some: { locale: dbLocale } } },
      include: { translations: { where: { locale: dbLocale }, take: 1, select: { title: true, body: true } } },
    });
    const content = page?.translations[0];
    return content ? { available: true, title: content.title, content: content.body.slice(0, 5000) } : { available: false };
  }

  if (tool === "get_order_status") {
    const customer = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (customer?.role !== "CUSTOMER") throw new Error("Customer authentication required.");
    const where = buildOwnedOrderFilter(userId, String(args.orderNumber));
    if (!where) return { found: false };
    const order = await prisma.order.findFirst({
      where,
      select: { orderNumber: true, status: true, createdAt: true, total: true, currency: true },
    });
    if (!order) return { found: false };
    return {
      found: true,
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: orderStatusLabels[order.status] ?? "حالة الطلب غير متاحة",
      orderDate: order.createdAt.toISOString(),
      total: order.total.toString(),
      currency: order.currency,
    };
  }
  throw new Error("Unsupported store tool.");
}
