import { serializeJsonLd } from "@/lib/seo/public-seo.mjs";
import Link from "next/link";

export function SeoJsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export type BreadcrumbItem = { name: string; path?: string };

export function StoreBreadcrumbs({ items, jsonLd }: { items: BreadcrumbItem[]; jsonLd: Record<string, unknown> | null }) {
  if (items.length < 2) return null;
  return <>
    <nav aria-label="مسار التنقل" className="store-breadcrumbs">
      <ol>{items.map((item, index) => <li key={`${item.name}-${index}`}>
        {index > 0 && <span aria-hidden="true"> / </span>}
        {item.path && index < items.length - 1 ? <Link href={item.path}>{item.name}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.name}</span>}
      </li>)}</ol>
    </nav>
    {jsonLd && <SeoJsonLd data={jsonLd} />}
  </>;
}
