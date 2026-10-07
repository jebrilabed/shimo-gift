import { notFound } from "next/navigation";
import { Card, Container } from "@/components/ui";
import { requireCustomerPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { isLocale } from "@/lib/i18n/config";
import { AddressActions } from "./address-actions";
import { AddressForm } from "./address-form";
import { phase7Messages as messages } from "@/lib/phase7/messages";
export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireCustomerPage();
  const addresses = await prisma.customerAddress.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return <main className="store-main"><Container><header className="store-page-heading"><h1>{messages.ar.addressesTitle}</h1></header><div className="grid gap-6 xl:grid-cols-2">{addresses.map((address) => <Card key={address.id} className="flex flex-col gap-4"><div><h2 className="font-semibold">{address.fullName} {address.isDefault && <span className="text-sm">— {messages.ar.defaultLabel}</span>}</h2><p dir="ltr">{address.phone}</p><p>{address.addressLine}، {address.city}</p>{address.postalCode && <p>{address.postalCode}</p>}{address.notes && <p>{address.notes}</p>}</div><details><summary className="cursor-pointer underline">{messages.ar.editAddress}</summary><AddressForm address={address} label={messages.ar.saveAddress} /></details><AddressActions id={address.id} isDefault={address.isDefault} /></Card>)}{addresses.length === 0 && <Card className="xl:col-span-2">{messages.ar.noAddresses}</Card>}<Card className="xl:col-span-2"><h2 className="mb-4 text-xl font-semibold">{messages.ar.addAddress}</h2><AddressForm label={messages.ar.addAddress} /></Card></div></Container></main>;
}
