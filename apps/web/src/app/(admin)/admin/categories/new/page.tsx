import Link from "next/link";
import { CategoryForm, type CategoryFormValues } from "@/components/admin/category-form";
import { Locale } from "@/generated/prisma/enums";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function NewCategoryPage() {
  await requireAdminPage();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, translations: { where: { locale: Locale.AR }, take: 1, select: { name: true } } },
  });
  const values: CategoryFormValues = { nameAr: "", descriptionAr: "", isActive: true, productIds: [] };
  return <div className="admin-page"><header className="admin-page__header"><h1>{messages.ar.addCategory}</h1><Link className="ui-button ui-button--ghost" href="/admin/categories">{messages.ar.back}</Link></header><CategoryForm values={values} products={products.map((product) => ({ id: product.id, name: product.translations[0]?.name ?? product.slug }))} /></div>;
}
