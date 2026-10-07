type ProductInput = {
  nameAr: string;
  nameEn: string;
  slug: string;
  skuCode: string;
  descriptionAr: string;
  descriptionEn: string;
  seoTitleAr: string;
  seoDescriptionAr: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
  categoryId: string | null;
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
  imageUrls: string[];
  uploadedImages: { url: string; publicId: string }[];
  isActive: boolean;
};

type CategoryInput = {
  nameAr: string;
  nameEn: string;
  slug: string;
  descriptionAr: string;
  descriptionEn: string;
  seoTitleAr: string;
  seoDescriptionAr: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
  parentId: string | null;
  isActive: boolean;
};

export function parseProductInput(formData: FormData):
  | { ok: true; value: ProductInput }
  | { ok: false; errors: Record<string, string> };
export function parseCategoryInput(formData: FormData):
  | { ok: true; value: CategoryInput }
  | { ok: false; errors: Record<string, string> };
export function parseInventoryInput(formData: FormData):
  | { ok: true; value: { skuId: string; productId: string; quantity: number } }
  | { ok: false; error: string };
