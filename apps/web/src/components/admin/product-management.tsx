"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import { cloudinaryImageUrl } from "@/lib/seo/cloudinary-image.mjs";
import { Button, Card } from "@/components/ui";
import { deleteImage, makePrimaryImage, moveImage, saveImage, type ManagementState } from "@/app/(admin)/admin/products/[id]/management-actions";
import { adminMessages } from "@/lib/admin/messages";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { ProductImageUploader, type UploadedProductImage } from "./product-image-uploader";

function productImageLoader({ src, width }: { src: string; width: number }) {
  return cloudinaryImageUrl(src, width) ?? src;
}
type ProductImage = { id: string; url: string; providerPublicId: string | null; altText: string | null; sortOrder: number };
function ImageEditor({ productId, image, canAddImage }: { productId: string; image?: ProductImage; canAddImage: boolean }) {
  const [state, action, pending] = useActionState(saveImage, {} as ManagementState);
  const [uploadedImage, setUploadedImage] = useState<UploadedProductImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const currentUrl = uploadedImage?.url ?? image?.url ?? "";
  const currentPublicId = uploadedImage?.providerPublicId ?? image?.providerPublicId ?? "";
  return <form action={action} className="admin-image-editor">
    <input name="productId" type="hidden" value={productId} />
    <input name="imageId" type="hidden" value={image?.id ?? ""} />
    <input name="url" type="hidden" value={currentUrl} />
    <input name="providerPublicId" type="hidden" value={currentPublicId} />
    <ProductImageUploader maxFiles={image ? 1 : canAddImage ? 1 : 0} onUploaded={setUploadedImage} onUploadingChange={setUploading} />
    {uploadedImage && <div className="admin-product-image-preview"><Image alt={uploadedImage.fileName} height={72} loader={productImageLoader} src={uploadedImage.url} width={72} /><span>{uploadedImage.fileName}</span></div>}
    <div className="flex flex-wrap items-center gap-2">
      {state.error && <p role="alert" className="admin-feedback admin-feedback--error">{state.error}</p>}
      {state.success && <p role="status" className="admin-feedback admin-feedback--success">{state.success}</p>}
      <Button disabled={uploading || !currentUrl} loading={pending}>{image ? messages.ar.saveImage : messages.ar.addImage}</Button>
    </div>
  </form>;
}
function ImageControls({ productId, imageId, index, count }: { productId: string; imageId: string; index: number; count: number }) {
  const [moveState, moveAction, movePending] = useActionState(moveImage, {} as ManagementState);
  const [primaryState, primaryAction, primaryPending] = useActionState(makePrimaryImage, {} as ManagementState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteImage, {} as ManagementState);
  const hidden = <><input type="hidden" name="productId" value={productId} /><input type="hidden" name="imageId" value={imageId} /></>;
  return <div className="grid gap-2"><div className="flex flex-wrap gap-2">
    {index > 0 && <form action={moveAction}>{hidden}<input type="hidden" name="direction" value="up" /><Button size="small" variant="outline" loading={movePending}>{messages.ar.moveUp}</Button></form>}
    {index < count - 1 && <form action={moveAction}>{hidden}<input type="hidden" name="direction" value="down" /><Button size="small" variant="outline" loading={movePending}>{messages.ar.moveDown}</Button></form>}
    <form action={primaryAction}>{hidden}<Button size="small" variant="outline" loading={primaryPending}>{messages.ar.setPrimary}</Button></form>
    <form action={deleteAction}>{hidden}<Button size="small" variant="ghost" loading={deletePending}>{messages.ar.delete}</Button></form>
  </div>{moveState.error && <p role="alert">{moveState.error}</p>}{moveState.success && <p role="status">{moveState.success}</p>}{primaryState.error && <p role="alert">{primaryState.error}</p>}{primaryState.success && <p role="status">{primaryState.success}</p>}{deleteState.error && <p role="alert">{deleteState.error}</p>}{deleteState.success && <p role="status">{deleteState.success}</p>}</div>;
}
export function ProductManagement({ productId, images = [] }: { productId: string; images?: ProductImage[] }) {
  return <div className="mt-8 grid gap-6">
    <Card><h2 className="mb-4 text-xl font-semibold">{messages.ar.productImages}</h2>{images.length ? <div className="mb-4 grid gap-4 md:grid-cols-2">{images.map((image, index) => <div key={image.id} className="grid gap-2 rounded-xl border p-3"><div className="flex items-center gap-3"><Image loader={productImageLoader} src={image.url} alt={image.altText || adminMessages.ar.imageAlt} width={96} height={96} className="rounded object-cover" /><span>{image.sortOrder === 0 ? messages.ar.primaryImage : messages.ar.imageNumber.replace("{number}", String(image.sortOrder + 1))}</span></div><ImageEditor productId={productId} image={image} canAddImage={false} /><ImageControls productId={productId} imageId={image.id} index={index} count={images.length} /></div>)}</div> : <p className="mb-4">{messages.ar.noImages}</p>}<ImageEditor productId={productId} canAddImage={images.length < 8} /></Card>
  </div>;
}
