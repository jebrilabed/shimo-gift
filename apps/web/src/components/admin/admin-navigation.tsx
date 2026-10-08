"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return (
    <nav className={variant === "sidebar" ? "admin-nav" : "admin-mobile-nav"} aria-label={messages.ar.admin}>
      {links.map(({ href, label, mark }) => {
        const current = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return <Link aria-current={current ? "page" : undefined} className={variant === "sidebar" ? `admin-nav__link${current ? " is-current" : ""}` : `admin-mobile-nav__link${current ? " is-current" : ""}`} href={href} key={href}>
          {variant === "sidebar" && <span aria-hidden="true">{mark}</span>}{label}
        </Link>;
      })}
    </nav>
  );
}
