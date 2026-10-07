import Link from "next/link";
import { Badge, Card, Container, Input } from "@/components/ui";
import { StorefrontSubmitButton } from "@/components/storefront/submit-button";
import { clearCartAction, removeCartItemAction, updateCartQuantityAction } from "../actions";
import { getCartSnapshot, isCartLineAvailable, isCartLineSellable } from "@/lib/storefront/cart";
import { Prisma } from "@/generated/prisma/client";
import { displayVariantOptions, formatMoney } from "@/lib/storefront/format";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import { getStoreCurrency } from "@/lib/storefront/orders";
import { SafeProductImage } from "@/components/storefront/safe-product-image";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  added: messages.ar.added,
  updated: messages.ar.noticeUpdated,
  removed: messages.ar.noticeRemoved,
  cleared: messages.ar.noticeCleared,
  stock: messages.ar.stockChanged,
  unavailable: messages.ar.unavailable,
  invalid: messages.ar.validationQuantity,
  empty: messages.ar.cartEmptyError,
  error: messages.ar.databaseUnavailable,
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, cart, currency] = await Promise.all([searchParams, getCartSnapshot(), getStoreCurrency()]);
  const items = cart?.items ?? [];
  const subtotal = items.reduce((sum, item) => sum.add(item.sku.price.mul(item.quantity)), new Prisma.Decimal(0));
  const quantityCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const canCheckout = items.length > 0 && items.every(isCartLineAvailable);

  return (
    <main className="store-main">
      <Container>
        <header className="store-page-heading"><h1>{messages.ar.cartTitle}</h1></header>
        {notice && notices[notice] && <p className={`store-alert ${notice === "added" ? "store-alert--success" : "store-alert--error"}`} role="status">{notices[notice]}</p>}
        {!items.length ? (
          <div className="ui-state"><span className="ui-state__symbol" aria-hidden="true">◇</span><h2>{messages.ar.cartEmpty}</h2><Link className="ui-button ui-button--primary" href="/ar">{messages.ar.continueShopping}</Link></div>
        ) : (
          <div className="store-columns">
            <div className="store-cart-list">
              {items.map((item) => {
                const available = isCartLineAvailable(item);
                const adjustable = isCartLineSellable(item) && item.sku.stockQuantity > 0;
                const translation = item.sku.product.translations[0];
                const image = item.sku.product.images[0];
                const lineTotal = item.sku.price.mul(item.quantity);
                return (
                  <Card className="store-cart-item" key={item.id}>
                    <div className="store-cart-item__image">{image ? <SafeProductImage alt={image.altText || translation?.name || messages.ar.product} sizes="96px" src={image.url} /> : <span>{messages.ar.noImage}</span>}</div>
                    <div className="store-cart-item__content">
                      <h2>{translation ? <Link href={`/ar/products/${encodeURIComponent(translation.slug)}`}>{translation.name}</Link> : messages.ar.unavailableItem}</h2>
                      {displayVariantOptions(item.sku.variantOptions) && <p className="store-muted">{displayVariantOptions(item.sku.variantOptions)}</p>}
                      <p>{currency ? <>{messages.ar.price}: {formatMoney(item.sku.price, currency)} · {messages.ar.lineTotal}: <strong>{formatMoney(lineTotal, currency)}</strong></> : messages.ar.currencyUnavailable}</p>
                      {!available && <Badge variant="error">{messages.ar.unavailableItem}</Badge>}
                      <div className="store-cart-item__actions">
                        {adjustable && (
                          <form action={updateCartQuantityAction} className="store-form--inline">
                            <input name="itemId" type="hidden" value={item.id} />
                            <Input aria-label={messages.ar.quantity} defaultValue={item.quantity} label={messages.ar.quantity} max={item.sku.stockQuantity} min={1} name="quantity" required type="number" />
                            <StorefrontSubmitButton pendingText={messages.ar.updating}>{messages.ar.updateQuantity}</StorefrontSubmitButton>
                          </form>
                        )}
                        <form action={removeCartItemAction}><input name="itemId" type="hidden" value={item.id} /><StorefrontSubmitButton pendingText={messages.ar.removing}>{messages.ar.remove}</StorefrontSubmitButton></form>
                      </div>
                    </div>
                  </Card>
                );
              })}
              <form action={clearCartAction}><StorefrontSubmitButton pendingText={messages.ar.clearing}>{messages.ar.clearCart}</StorefrontSubmitButton></form>
            </div>
            <Card className="store-summary">
              <h2>{messages.ar.subtotal}</h2>
              <p className="store-summary__row"><span>{messages.ar.cartItemsCount}</span><strong>{quantityCount}</strong></p>
              <p className="store-summary__row"><span>{messages.ar.cartLinesCount}</span><strong>{items.length}</strong></p>
              {currency ? <p className="store-summary__row"><span>{messages.ar.subtotal}</span><strong>{formatMoney(subtotal, currency)}</strong></p> : <p className="store-alert store-alert--error">{messages.ar.currencyNotConfigured}</p>}
              <p className="store-muted">{messages.ar.shippingNotIncluded}</p>
              {canCheckout && currency ? <Link className="ui-button ui-button--primary w-full" href="/ar/checkout">{messages.ar.checkout}</Link> : <p className="store-alert store-alert--error">{currency ? messages.ar.cartInvalid : messages.ar.currencyNotConfigured}</p>}
              <Link href="/ar">{messages.ar.continueShopping}</Link>
            </Card>
          </div>
        )}
      </Container>
    </main>
  );
}
import type { Metadata } from "next";
