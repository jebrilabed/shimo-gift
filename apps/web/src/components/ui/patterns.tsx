import type { ReactNode } from "react";
import { cx } from "./cx";

export function DirectionalArrow({ direction = "next" }: { direction?: "next" | "previous" }) {
  return (
    <svg className={cx("ui-directional-icon", `ui-directional-icon--${direction}`)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Navigation({ children, label }: { children: ReactNode; label: string }) {
  return <nav aria-label={label}>{children}</nav>;
}

export type BreadcrumbItem = { current?: boolean; href?: string; label: string };

export function Breadcrumbs({ items, label = "مسار التنقل" }: { items: BreadcrumbItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="ui-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && <span aria-hidden="true">/</span>}{" "}
            {item.current || !item.href ? (
              <span aria-current={item.current ? "page" : undefined}>{item.label}</span>
            ) : (
              <a href={item.href}>{item.label}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ currentPage, hrefForPage, totalPages }: {
  currentPage: number;
  hrefForPage: (page: number) => string;
  totalPages: number;
}) {
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav className="ui-pagination" aria-label="التنقل بين الصفحات">
      <a href={hrefForPage(previousPage)} tabIndex={currentPage === 1 ? -1 : undefined} aria-label="الصفحة السابقة" aria-disabled={currentPage === 1}>
        <DirectionalArrow direction="previous" /> <span>السابق</span>
      </a>
      <span aria-current="page">صفحة {currentPage} من {totalPages}</span>
      <a href={hrefForPage(nextPage)} tabIndex={currentPage === totalPages ? -1 : undefined} aria-label="الصفحة التالية" aria-disabled={currentPage === totalPages}>
        <span>التالي</span> <DirectionalArrow direction="next" />
      </a>
    </nav>
  );
}

export function ResponsiveTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="ui-table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="ui-table">{children}</table>
    </div>
  );
}
