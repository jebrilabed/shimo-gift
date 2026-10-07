"use client";

import { Button, Container } from "@/components/ui";
import "./globals.css";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <main>
          <Container width="reading" className="grid gap-3 py-20 text-start">
            <h1 className="text-2xl font-semibold">تعذر تحميل الصفحة</h1>
            <p>يرجى المحاولة مرة أخرى.</p>
            <Button className="w-fit" onClick={reset}>إعادة المحاولة</Button>
          </Container>
        </main>
      </body>
    </html>
  );
}
