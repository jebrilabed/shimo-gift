import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authorization";
import { AdminShell } from "@/components/admin/admin-shell";
import "../globals.css";
import "./admin.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProtectedAdminRoot({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  if (user.role !== "ADMIN") notFound();

  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body><AdminShell email={user.email}>{children}</AdminShell></body>
    </html>
  );
}
