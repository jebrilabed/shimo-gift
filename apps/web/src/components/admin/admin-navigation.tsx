"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminMessages as messages } from "@/lib/admin/messages";

const links = [
  { href: "/admin", label: messages.ar.dashboard, mark: "⌂" },
  { href: "/admin/products", label: messages.ar.products, mark: "◇" },
  { href: "/admin/categories", label: messages.ar.categories, mark: "▦" },
  { href: "/admin/inventory", label: messages.ar.inventory, mark: "▤" },
  { href: "/admin/orders", label: messages.ar.orders, mark: "▧" },
  { href: "/admin/settings", label: messages.ar.storeSettings, mark: "⚙" },
  { href: "/admin/notifications", label: messages.ar.notifications, mark: "◉" },
];

export function AdminNavigation({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const navigation = (
    <nav className={variant === "sidebar" ? "admin-nav" : "admin-mobile-nav"} aria-label={messages.ar.admin}>
      {links.map(({ href, label, mark }) => {
        const current = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return <Link aria-current={current ? "page" : undefined} className={variant === "sidebar" ? `admin-nav__link${current ? " is-current" : ""}` : `admin-mobile-nav__link${current ? " is-current" : ""}`} href={href} key={href} onClick={() => setIsOpen(false)}>
          {variant === "sidebar" && <span aria-hidden="true">{mark}</span>}{label}
        </Link>;
      })}
    </nav>
  );

  if (variant === "sidebar") return navigation;

  return (
    <div className="admin-mobile-menu">
      <button aria-controls="admin-mobile-menu-panel" aria-expanded={isOpen} aria-label={isOpen ? "إغلاق القائمة" : "فتح القائمة"} className="admin-mobile-menu__trigger" onClick={() => setIsOpen((open) => !open)} type="button">
        <span aria-hidden="true">{isOpen ? "×" : "☰"}</span>
        <span>القائمة</span>
      </button>
      <button aria-label="إغلاق القائمة" className={`admin-mobile-menu__backdrop${isOpen ? " is-open" : ""}`} onClick={() => setIsOpen(false)} tabIndex={isOpen ? 0 : -1} type="button" />
      <aside aria-hidden={!isOpen} aria-label={messages.ar.admin} className={`admin-mobile-menu__drawer${isOpen ? " is-open" : ""}`} id="admin-mobile-menu-panel" role="dialog" aria-modal={isOpen}>
        <div className="admin-mobile-menu__heading">
          <strong>{messages.ar.admin}</strong>
          <button aria-label="إغلاق القائمة" className="admin-mobile-menu__close" onClick={() => setIsOpen(false)} type="button">×</button>
        </div>
        {navigation}
      </aside>
    </div>
  );
}
