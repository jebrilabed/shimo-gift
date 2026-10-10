"use client";

import { useId, useState } from "react";
import { ToastMessage } from "@/components/ui/toast";

export type UploadedProductImage = {
  url: string;
  providerPublicId: string;
  fileName: string;
};

const maxFileSize = 4 * 1024 * 1024;

function uploadError(code: string | undefined) {
  if (code === "upload-not-configured") return "رفع الصور غير مفعّل بعد. أضف إعدادات Cloudinary إلى متغيرات البيئة.";
  if (code === "invalid-file-type") return "اختر صورة بصيغة JPG أو PNG أو WEBP.";
  if (code === "file-too-large") return "الحد الأقصى لحجم الصورة 4 ميجابايت.";
  if (code === "unauthorized") return "انتهت الجلسة أو لا تملك صلاحية رفع الصور.";
  if (code === "upload-permission-denied") return "مفتاح Cloudinary لا يملك صلاحية رفع الصور. تحقّق من صلاحية إنشاء الصور في مجلد المنتجات.";
  return "تعذر رفع الصورة. حاول مرة أخرى.";
}

export function ProductImageUploader({ maxFiles, onUploaded, onUploadingChange }: {
  maxFiles: number;
  onUploaded: (image: UploadedProductImage) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setError("");
    setStatus("");
    if (!files.length) return;
    if (files.length > maxFiles) {
      setError(`يمكن اختيار ${maxFiles} صورة إضافية كحد أقصى.`);
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    let uploadedCount = 0;
    for (const file of files) {
      if (file.size > maxFileSize) {
        setError(`${file.name}: ${uploadError("file-too-large")}`);
        continue;
      }
      const data = new FormData();
      data.append("file", file);
      try {
        const response = await fetch("/api/admin/products/images/upload", { method: "POST", body: data, credentials: "same-origin" });
        const result = await response.json().catch(() => ({})) as { url?: string; publicId?: string; error?: string };
        if (!response.ok || !result.url || !result.publicId) {
          setError(uploadError(result.error));
          continue;
        }
        onUploaded({ url: result.url, providerPublicId: result.publicId, fileName: file.name });
        uploadedCount += 1;
        setStatus(`تم رفع ${uploadedCount} من ${files.length} صورة.`);
      } catch {
        setError(uploadError(undefined));
      }
    }
    setUploading(false);
    onUploadingChange?.(false);
  }

  return <div className="admin-image-upload">
    <label className="admin-image-upload__label" htmlFor={id}>رفع الصور من الجهاز</label>
    <input
      accept="image/jpeg,image/png,image/webp"
      className="admin-image-upload__input"
      disabled={uploading || maxFiles < 1}
      id={id}
      multiple
      onChange={uploadFiles}
      type="file"
    />
    <p className="admin-image-upload__hint">JPG أو PNG أو WEBP · حتى 4 ميجابايت للصورة · 8 صور كحد أقصى</p>
    {uploading && <p aria-live="polite" className="admin-feedback">جاري رفع الصور…</p>}
    <ToastMessage eventKey={status} message={status} tone="success" />
    <ToastMessage eventKey={error} message={error} tone="error" />
  </div>;
}
