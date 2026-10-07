"use client";

import Image from "next/image";
import { cloudinaryImageUrl } from "@/lib/seo/cloudinary-image.mjs";

function productThumbnailLoader({ src, width }: { src: string; width: number }) {
  return cloudinaryImageUrl(src, width) ?? src;
}

export function AdminProductThumbnail({ src, alt, width, height }: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return <Image alt={alt} height={height} loader={productThumbnailLoader} src={src} width={width} />;
}
