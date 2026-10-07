import { notFound } from "next/navigation";
import Link from "next/link";
import { CategoryForm, type CategoryFormValues } from "@/components/admin/category-form";
import { Locale } from "@/generated/prisma/enums";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [category, products] = await Promise.all([
    prisma.category.findUnique({ where: { id }, include: { translations: true, products: { select: { id: true } } } }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, translations: { where: { locale: Locale.AR }, take: 1, select: { name: true } } },
    }),
  ]);
  if (!category) notFound();
  const ar = category.translations.find((translation) => translation.locale === "AR");
  const en = category.translations.find((translation) => translation.locale === "EN");
  const values: CategoryFormValues = {
    id: category.id,
    nameAr: ar?.name ?? "",
    nameEn: en?.name ?? "",
    slug: category.slug,
    descriptionAr: ar?.description ?? "",
    descriptionEn: en?.description ?? "",
    seoTitleAr: ar?.seoTitle ?? "",
    seoDescriptionAr: ar?.seoDescription ?? "",
    seoTitleEn: en?.seoTitle ?? "",
    seoDescriptionEn: en?.seoDescription ?? "",
    parentId: category.parentId ?? "",
    isActive: category.status === "ACTIVE",
    productIds: category.products.map((product) => product.id),
  };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>{messages.ar.editCategory}</h1><p>{ar?.name ?? category.slug}</p></div><Link className="ui-button ui-button--ghost" href="/admin/categories">{messages.ar.backToCategories}</Link></header><CategoryForm values={values} products={products.map((product) => ({ id: product.id, name: product.translations[0]?.name ?? product.slug }))} /></div>;
}
