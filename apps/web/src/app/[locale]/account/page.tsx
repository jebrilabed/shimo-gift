import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Container } from "@/components/ui";
import { requireCustomerPage } from "@/lib/auth/authorization";
import { isLocale } from "@/lib/i18n/config";
import { ProfileForm } from "./profile-form";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireCustomerPage();
  return <main className="store-main"><Container><header className="store-page-heading"><h1>{messages.ar.accountTitle}</h1></header><div className="grid gap-6 lg:grid-cols-2"><Card><h2 className="mb-4 text-xl font-semibold">{messages.ar.profile}</h2><p className="mb-4" dir="ltr">{user.email}</p><ProfileForm name={user.name ?? ""} /></Card><Card><h2 className="mb-4 text-xl font-semibold">{messages.ar.shoppingAccount}</h2><nav className="flex flex-col gap-3"><Link className="underline" href="/ar/orders">{messages.ar.myOrders}</Link><Link className="underline" href="/ar/account/addresses">{messages.ar.addresses}</Link><p className="text-sm">{messages.ar.editNameHint}</p></nav></Card></div></Container></main>;
}
