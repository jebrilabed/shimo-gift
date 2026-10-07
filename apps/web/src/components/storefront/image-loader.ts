import { cloudinaryImageUrl } from "@/lib/seo/cloudinary-image.mjs";

export function cloudinaryImageLoader({ src, width }: { src: string; width: number }) {
  return cloudinaryImageUrl(src, width) ?? src;
}
