import { notFound } from "next/navigation";
import Image from "next/image";
import { Card, Container } from "@/components/ui";
import { isLocale } from "@/lib/i18n/config";
import { RegisterForm } from "./register-form";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { storefrontMessages } from "@/lib/storefront/messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="auth-page">
      <Container>
        <Card className="auth-page__card mx-auto flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
          <div>
            <p className="auth-page__brand">
              <span className="auth-page__mark"><Image alt="" height={48} src="/brand/shimo-logo-transparent.png" width={48} /></span>
              {storefrontMessages.ar.brand}
            </p>
            <h1 className="text-2xl font-semibold">{messages.ar.registerTitle}</h1>
            <p className="text-sm text-muted">{messages.ar.registerIntro}</p>
          </div>
          <RegisterForm />
        </Card>
      </Container>
    </main>
  );
}
import type { Metadata } from "next";
