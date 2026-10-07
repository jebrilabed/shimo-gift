import type { Metadata } from "next";
import Image from "next/image";
import { Card, Container } from "@/components/ui";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { LoginForm } from "./login-form";
import Link from "next/link";
import { phase7Messages as phaseMessages } from "@/lib/phase7/messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps & { searchParams: Promise<{ registered?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { registered } = await searchParams;

  return (
    <main className="auth-page">
      <Container>
        <div className="mx-auto w-full max-w-md">
          <Card className="auth-page__card flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-2 text-start">
              <p className="auth-page__brand">
                <span className="auth-page__mark"><Image alt="" height={48} src="/brand/shimo-logo.png" width={48} /></span>
                Shimo Gift
              </p>
              <h1 className="text-2xl font-semibold">تسجيل الدخول</h1>
              <p className="text-sm leading-7 text-muted">أدخل بيانات حسابك للمتابعة في متجر Shimo Gift.</p>
            </div>
            <LoginForm />
            {registered === "1" && <p className="text-sm text-green-700" role="status">{phaseMessages.ar.registered}</p>}
            <p className="text-sm">{phaseMessages.ar.noAccount} <Link href="/ar/register" className="underline font-bold text-pink-600">{phaseMessages.ar.registerTitle}</Link></p>
          </Card>
        </div>
      </Container>
    </main>
  );
}
