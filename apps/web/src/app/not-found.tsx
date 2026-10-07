import { Container } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <main lang="ar" dir="rtl">
      <Container width="reading" className="grid gap-3 py-20 text-start">
        <h1 className="text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p>تحقق من الرابط وحاول مرة أخرى.</p>
      </Container>
    </main>
  );
}
