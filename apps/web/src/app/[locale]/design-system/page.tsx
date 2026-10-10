import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  DirectionalArrow,
  Dialog,
  Dropdown,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Navigation,
  Pagination,
  ResponsiveTable,
  Select,
  Textarea,
} from "@/components/ui";

export const metadata = {
  title: "معرض نظام التصميم | Shimo Gift",
  robots: { index: false, follow: false },
};

const palette = [
  { name: "أساسي", hex: "#C43C78", css: "--brand-primary", text: "--surface-raised" },
  { name: "ثانوي", hex: "#FCEAF2", css: "--brand-secondary", text: "--text-primary" },
  { name: "مساند", hex: "#5B2941", css: "--brand-accent", text: "--surface-raised" },
  { name: "خلفية", hex: "#FFF9FC", css: "--surface-canvas", text: "--text-primary" },
  { name: "سطح", hex: "#FFFFFF", css: "--surface-raised", text: "--text-primary" },
  { name: "نص", hex: "#20171B", css: "--text-primary", text: "--surface-raised" },
  { name: "نص هادئ", hex: "#725C67", css: "--text-muted", text: "--surface-raised" },
  { name: "حدود", hex: "#F0C9DA", css: "--border-subtle", text: "--text-primary" },
  { name: "نجاح", hex: "#346B57", css: "--status-success", text: "--surface-raised" },
  { name: "تنبيه", hex: "#74530C", css: "--status-warning", text: "--surface-raised" },
  { name: "خطأ", hex: "#963B42", css: "--status-error", text: "--surface-raised" },
  { name: "معلومة", hex: "#C43C78", css: "--status-info", text: "--surface-raised" },
];

export default async function DesignSystemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (locale !== "ar" || process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="ui-demo" id="top">
      <Container>
        <header className="ui-demo__header">
          <span className="ui-demo__eyebrow">محتوى داخلي للتطوير والتحقق</span>
          <h1>أساس التصميم واتجاه الكتابة</h1>
          <p>
            مرجع عملي للمكوّنات والألوان والأنماط العربية واتجاه RTL. هذه الصفحة ليست واجهة متجر،
            ولا تظهر في بيئة الإنتاج.
          </p>
          <Navigation label="التنقل داخل معرض التصميم">
            <ul className="ui-demo__nav-list">
              <li><a href="#palette">الألوان</a></li>
              <li><a href="#type">الخطوط</a></li>
              <li><a href="#components">المكوّنات</a></li>
              <li><a href="#patterns">أنماط RTL</a></li>
            </ul>
          </Navigation>
        </header>

        <div className="ui-demo__sections">
          <section className="ui-demo__section ui-demo__section--wide ui-card" id="brand">
            <h2>الشعار ومصدر الهوية</h2>
            <div className="ui-demo__grid ui-demo__grid--two">
              <div className="ui-demo__logo">
                <Image
                  src="/brand/shimo-logo-transparent.png"
                  alt="شعار Shimo Gift"
                  width={320}
                  height={320}
                  unoptimized
                />
                <p>شعار Shimo Gift بصيغة PNG، معروض دون تغيير أو انعكاس.</p>
              </div>
              <div className="ui-demo__stack">
                <p>
                  يُستخدم الشعار الحالي في واجهة المتجر. تُحفظ نسبه وألوانه كما هي، ولا يُعكس عند تنسيق
                  الواجهة العربية.
                </p>
                <div className="ui-demo__notice">
                  ألوان الواجهة متناسقة مع هوية Shimo Gift، مع ضبط تباين النصوص والأزرار لضمان وضوحها.
                </div>
              </div>
            </div>
          </section>

          <section className="ui-demo__section ui-card" id="palette">
            <h2>ألوان الهوية والحالات</h2>
            <p>كل لون معروض اسمه وقيمة HEX؛ حالات الواجهة تحمل أيضاً تسمية نصية.</p>
            <div className="ui-demo__colors">
              {palette.map((color) => (
                <div
                  className="ui-demo__swatch"
                  key={color.name}
                  style={color.name === "حدود"
                    ? { backgroundColor: "var(--surface-raised)", color: "var(--text-primary)", borderColor: `var(${color.css})` }
                    : { backgroundColor: `var(${color.css})`, color: `var(${color.text})` }}
                >
                  <strong>{color.name}</strong>
                  <span dir="ltr">{color.hex}</span>
                </div>
              ))}
            </div>
            <p>
              تباين النص الأساسي 12.52:1 على الخلفية؛ الأساسي 5.75:1 على الخلفية و6.77:1 على الأبيض؛
              النص الداكن على الثانوي 8.63:1؛ المساند 4.61:1 على الأبيض فقط. الحدود 3.14:1 على الخلفية.
              هذه النسب محسوبة بصيغة WCAG للسطوع النسبي.
            </p>
          </section>

          <section className="ui-demo__section ui-card" id="type">
            <h2>الخطوط والقراءة</h2>
            <div className="ui-demo__type-sample">
              <h3 className="text-2xl font-bold leading-tight">عنوان عربي واضح</h3>
              <p>نص أساسي بارتفاع سطر مريح يناسب القراءة الطويلة على الهاتف والحاسوب.</p>
              <p className="text-sm text-muted">تسمية مساعدة للنموذج أو وصف مختصر.</p>
              <p lang="en" dir="ltr">English labels remain readable alongside Arabic content.</p>
            </div>
            <p>
              الخط المفضل هو Noto Sans Arabic عند توفره على النظام، مع Segoe UI وTahoma وArial كبدائل.
              لم تُحمّل ملفات خطوط أو أوزان إضافية؛ ارتفاع سطر النص العربي 1.8.
            </p>
          </section>

          <section className="ui-demo__section ui-card" id="components">
            <h2>الأزرار والشارات</h2>
            <div className="ui-demo__row">
              <Button>إجراء أساسي</Button>
              <Button variant="secondary">إجراء ثانوي</Button>
              <Button variant="outline">حدود واضحة</Button>
              <Button variant="ghost">إجراء هادئ</Button>
              <Button loading>جارٍ الحفظ</Button>
            </div>
            <div className="ui-demo__row" aria-label="أمثلة حالات معنونة">
              <Badge variant="success">تم بنجاح</Badge>
              <Badge variant="warning">يتطلب الانتباه</Badge>
              <Badge variant="error">تعذر الإكمال</Badge>
              <Badge variant="info">للمعلومية</Badge>
            </div>
          </section>

          <section className="ui-demo__section ui-card">
            <h2>حقول ونماذج</h2>
            <form className="ui-demo__form">
              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="name@example.com"
                dir="ltr"
                hint="تظهر المساعدة أسفل الحقل وتُربط به لقارئات الشاشة."
              />
              <Select label="طريقة التواصل" defaultValue="email">
                <option value="email">البريد الإلكتروني</option>
                <option value="phone">الهاتف</option>
              </Select>
              <Textarea label="ملاحظة اختيارية" rows={3} placeholder="اكتب هنا" />
              <Input
                label="مثال على خطأ"
                type="text"
                defaultValue=""
                error="أدخل قيمة صحيحة للمتابعة."
              />
              <div className="ui-demo__row">
                <Button>زر توضيحي</Button>
                <Button type="reset" variant="outline">إعادة تعيين</Button>
              </div>
            </form>
          </section>

          <section className="ui-demo__section ui-card">
            <h2>البطاقات وحالات المحتوى</h2>
            <Card>
              <h3>بطاقة محتوى عامة</h3>
              <p className="text-muted">مساحة قابلة لإعادة الاستخدام مع حدود وتباعد وظل موحد.</p>
            </Card>
            <LoadingState announce={false} label="جارٍ تحميل المحتوى" lines={3} />
            <EmptyState title="لا توجد عناصر بعد" description="تظهر هنا إرشادات واضحة عند غياب المحتوى." />
            <ErrorState announce={false} title="تعذر تحميل المحتوى" description="يمكن توضيح المشكلة نصياً من دون الاعتماد على اللون وحده." />
          </section>

          <section className="ui-demo__section ui-card ui-demo__section--wide" id="patterns">
            <h2>أنماط التنقل واتجاه RTL</h2>
            <div className="ui-demo__grid ui-demo__grid--two">
              <div className="ui-demo__stack">
                <h3>مسار التنقل</h3>
                <Breadcrumbs items={[
                  { label: "الرئيسية", href: "#top" },
                  { label: "التصميم", href: "#patterns" },
                  { label: "النموذج الحالي", current: true },
                ]} />
                <h3>القائمة المنسدلة</h3>
                <Dropdown label="خيارات العرض">
                  <a href="#palette">الألوان</a>
                  <a href="#components">المكوّنات</a>
                </Dropdown>
                <h3>الحوار</h3>
                <Dialog
                  label="فتح نافذة حوار"
                  title="عنوان النافذة"
                  description="يستخدم عنصر dialog الأصلي لدعم التركيز ومفتاح Escape ولوحة المفاتيح."
                >
                  <p>محتوى نافذة قصير.</p>
                </Dialog>
                <h3>ترقيم الصفحات</h3>
                <Pagination currentPage={2} totalPages={4} hrefForPage={(page) => `#page-${page}`} />
              </div>
              <div className="ui-demo__stack">
                <h3>جدول قابل للتمرير أفقياً</h3>
                <ResponsiveTable label="جدول تجريبي للتخطيط">
                  <thead><tr><th scope="col">العنصر</th><th scope="col">الحالة</th><th scope="col">الوصف</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">النموذج الأول</th><td>جاهز</td><td>مثال RTL</td></tr>
                    <tr><th scope="row">النموذج الثاني</th><td>قيد المراجعة</td><td>مثال متجاوب</td></tr>
                  </tbody>
                </ResponsiveTable>
                <h3>أيقونة اتجاهية</h3>
                <p>تتبع الأيقونة معنى الاتجاه وتنعكس في RTL؛ الصور والشعار لا تنعكس.</p>
                <div className="ui-demo__row">
                  <span>التالي <DirectionalArrow /></span>
                  <span lang="en" dir="ltr">Next <DirectionalArrow /></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
