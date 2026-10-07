export function canonicalPath(pathname: string): string | null;
export function resolveSiteUrl(value: string | undefined, production?: boolean): URL | null;
export function canonicalUrl(pathname: string, baseUrl: URL | null): string | null;
export function buildProductStructuredData(input: { name: string; description?: string | null; image?: string | null; skus: { price: string | number; stockQuantity: number }[]; currency: string | null; url: string | null }): Record<string, unknown> | null;
export function buildBreadcrumbData(items: { name: string; path?: string }[], baseUrl: URL | null): Record<string, unknown> | null;
export function serializeJsonLd(value: unknown): string;
export function publicPageEntries(input: { products: { slug: string }[]; categories: { slug: string }[]; pages: { slug: string }[]; hasContact: boolean; baseUrl: URL | null }): string[];
