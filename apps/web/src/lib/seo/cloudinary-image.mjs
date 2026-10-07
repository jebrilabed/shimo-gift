const existingTransform = /(?:^|,)(?:w_\d+|h_\d+|c_(?:fill|fit|scale|limit|thumb|crop)|f_(?:auto|webp|avif|jpg|png)|q_(?:auto|\d+)|dpr_(?:auto|\d+))/i;

/** Add request-sized delivery transforms only to untransformed Cloudinary asset URLs. */
export function cloudinaryImageUrl(source, width) {
  if (typeof source !== "string" || !Number.isSafeInteger(width) || width < 1) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password) return null;
    const marker = "/image/upload/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const afterMarker = url.pathname.slice(markerIndex + marker.length);
    const segments = afterMarker.split("/");
    const transformationIndex = /^v\d+$/.test(segments[0]) ? 1 : 0;
    if (existingTransform.test(segments[transformationIndex] ?? "")) return null;
    url.pathname = `${url.pathname.slice(0, markerIndex + marker.length)}f_auto,q_auto,w_${width}/${afterMarker}`;
    return url.toString();
  } catch {
    return null;
  }
}
