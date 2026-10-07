"use client";

import { useState } from "react";
import Image from "next/image";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { cloudinaryImageUrl } from "@/lib/seo/cloudinary-image.mjs";

function imageLoader({ src, width }: { src: string; width: number }) {
  return cloudinaryImageUrl(src, width) ?? src;
}

export function SafeProductImage({ src, alt, sizes, priority = false }: { src: string; alt: string; sizes?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="store-image-empty" role="img" aria-label={alt}>{messages.ar.imageUnavailable}</span>;

  let isPublicHttpsImage = false;
  try {
    const url = new URL(src);
    isPublicHttpsImage = url.protocol === "https:" && !url.username && !url.password;
  } catch {
    isPublicHttpsImage = false;
  }
  if (!isPublicHttpsImage) return <span className="store-image-empty" role="img" aria-label={alt}>{messages.ar.imageUnavailable}</span>;

  return <Image
    src={src}
    alt={alt}
    fill
    sizes={sizes}
    loader={imageLoader}
    priority={priority}
    loading={priority ? "eager" : "lazy"}
    onError={() => setFailed(true)}
  />;
}
