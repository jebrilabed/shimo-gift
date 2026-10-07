"use client";

import { Button, Container } from "@/components/ui";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main lang="ar" dir="rtl">
      <Container width="reading" className="grid gap-3 py-20 text-start">
        <h1 className="text-2xl font-semibold">حدث خطأ غير متوقع</h1>
        <p>يرجى المحاولة مرة أخرى.</p>
        <Button className="w-fit" onClick={reset}>إعادة المحاولة</Button>
      </Container>
    </main>
  );
}
