import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/auth";
import { adminMessages as messages } from "@/lib/admin/messages";
import { Button } from "@/components/ui";
import { AdminNavigation } from "./admin-navigation";

export function AdminShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar" aria-label={messages.ar.admin}>
        <Link className="admin-brand" href="/admin" aria-label={messages.ar.admin}>
          <span className="admin-brand__mark">
            <Image alt="" height={48} src="/brand/shimo-logo-transparent.png" width={48} />
          </span>
          <span><strong>{messages.ar.brand}</strong><small>{messages.ar.admin}</small></span>
        </Link>
        <AdminNavigation variant="sidebar" />
        <div className="admin-sidebar__footer">
          <span className="admin-identity__avatar" aria-hidden="true">{email?.slice(0, 1).toLocaleUpperCase("ar") ?? "م"}</span>
          <span className="admin-identity__text"><strong>{messages.ar.admin}</strong><small dir="ltr">{email ?? ""}</small></span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/ar/login" }); }}>
            <Button type="submit" variant="ghost" size="small" aria-label={messages.ar.signOut}>↪</Button>
          </form>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-mobile-header">
          <Link href="/admin" className="admin-brand admin-brand--compact">
            <span className="admin-brand__mark">
              <Image alt="" height={48} src="/brand/shimo-logo-transparent.png" width={48} />
            </span>
            <strong>{messages.ar.brand}</strong>
          </Link>
          <div className="admin-mobile-header__tools">
          <AdminNavigation variant="mobile" />
          <form action={async () => { "use server"; await signOut({ redirectTo: "/ar/login" }); }}>
            <Button type="submit" variant="outline" size="small">{messages.ar.signOut}</Button>
          </form>
          <span className="admin-mobile-identity" dir="ltr">{email ?? ""}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
