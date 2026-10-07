import Link from "next/link";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function NewProductPage() {
  await requireAdminPage();
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    include: { translations: { where: { locale: "AR" }, take: 1 } },
  });
  const values: ProductFormValues = {
    nameAr: "", nameEn: "", slug: "", descriptionAr: "", descriptionEn: "", seoTitleAr: "", seoDescriptionAr: "", seoTitleEn: "", seoDescriptionEn: "", price: "", compareAtPrice: "",
    stockQuantity: 0, categoryId: "", imageUrls: [], isActive: true,
  };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>{messages.ar.addProduct}</h1><p>{messages.ar.createProductTitle}</p></div><Link className="ui-button ui-button--ghost" href="/admin/products">{messages.ar.back}</Link></header><ProductForm values={values} categories={categories.map((category) => ({ id: category.id, name: category.translations[0]?.name ?? category.slug }))} /></div>;
}
