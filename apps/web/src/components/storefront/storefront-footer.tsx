import Link from "next/link";
import Image from "next/image";
import { Locale } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getPublicSiteData } from "@/lib/seo/site-data";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

export async function StorefrontFooter() {
  const [publicPages, storeData] = await Promise.all([
    prisma.contentPageTranslation.findMany({ where: { locale: Locale.AR, slug: { notIn: ["account", "admin", "api", "assistant", "cart", "categories", "checkout", "design-system", "faq", "login", "orders", "products", "register", "search"] }, contentPage: { isActive: true } }, orderBy: [{ contentPage: { pageKey: "asc" } }], select: { title: true, slug: true, contentPage: { select: { pageKey: true } } } }).catch(() => []),
    getPublicSiteData(),
  ]);
  const hasContactDetails = Boolean(storeData.phone || storeData.email || storeData.address);
  const hasContactPage = publicPages.some((page) => page.contentPage.pageKey === "contact");

  return (
    <footer className="store-footer">
      <div className="page-container store-footer__inner">
        <div className="store-footer__brand">
          <Link href="/ar" className="store-footer__brand-link">
            <span className="store-footer__logo-mark">
              <Image alt="" height={48} src="/brand/shimo-logo.png" width={48} />
            </span>
            <span className="store-footer__wordmark">{storeData.storeName || messages.ar.brand}</span>
          </Link>
          <p className="store-footer__desc">
            {storeData.storeDescription || "عالم من الهدايا المميزة والفاخرة المصممة بحب لتصنع أجمل الذكريات."}
          </p>
          {hasContactDetails && (
            <div className="store-footer__contact">
              {storeData.phone && <a href={`tel:${storeData.phone}`} dir="ltr">{storeData.phone}</a>}
              {storeData.email && <a href={`mailto:${storeData.email}`}>{storeData.email}</a>}
              {storeData.address && <span>{storeData.address}</span>}
            </div>
          )}
        </div>
        <nav aria-label="روابط المتجر" className="store-footer__nav">
          <Link href="/ar">{messages.ar.home}</Link>
          <Link href="/ar/products">{messages.ar.products}</Link>
          {publicPages.map((page) => <Link href={`/ar/${encodeURIComponent(page.slug)}`} key={page.slug}>{page.title}</Link>)}
          {!hasContactPage && hasContactDetails && <Link href="/ar/contact">تواصل معنا</Link>}
          <Link href="/ar/cart">{messages.ar.cart}</Link>
          <Link href="/ar/account">{messages.ar.account}</Link>
        </nav>
        <p className="store-footer__copyright">
          © {new Date().getFullYear()} {storeData.storeName || messages.ar.brand}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
