import Link from "next/link";
import { CategoryForm, type CategoryFormValues } from "@/components/admin/category-form";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function NewCategoryPage() {
  await requireAdminPage();
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { translations: { where: { locale: "AR" }, take: 1 } } });
  const values: CategoryFormValues = { nameAr: "", nameEn: "", slug: "", descriptionAr: "", descriptionEn: "", seoTitleAr: "", seoDescriptionAr: "", seoTitleEn: "", seoDescriptionEn: "", parentId: "", isActive: true };
  return <div className="admin-page"><header className="admin-page__header"><h1>{messages.ar.addCategory}</h1><Link className="ui-button ui-button--ghost" href="/admin/categories">{messages.ar.back}</Link></header><CategoryForm values={values} parents={categories.map((category) => ({ id: category.id, name: category.translations[0]?.name ?? category.slug }))} /></div>;
}
