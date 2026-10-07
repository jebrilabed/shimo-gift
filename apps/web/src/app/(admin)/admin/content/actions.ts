"use server";

import { revalidatePath } from "next/cache";
import { Locale } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/authorization";
import { executeAdminMutation } from "@/lib/admin/execute-admin-mutation.mjs";
import type { AdminActionState } from "@/lib/admin/config";
import { parseContentPageInput, parseFaqInput } from "@/lib/admin/content-validation.mjs";
import { preservePublicSlug } from "@/lib/seo/slug-redirects";
import { prisma } from "@/lib/db/prisma";

const invalid = "تحقق من الحقول المطلوبة وطول النص والرابط المختصر.";
const denied = "لا تملك صلاحية لتعديل المحتوى العام.";
const unavailable = "تعذر حفظ المحتوى حالياً. تحقق من عدم تكرار الرابط وحاول مرة أخرى.";

async function performAdminMutation(operation: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<AdminActionState>) {
  try {
    const result = await executeAdminMutation(requireAdmin, operation);
    if (!result.ok) return { error: result.reason === "unauthenticated" ? "يرجى تسجيل الدخول مرة أخرى." : denied };
    return result.value;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Admin content mutation failed.", { code });
    return { error: code === "P2002" ? "هذا الرابط أو مفتاح الصفحة مستخدم بالفعل." : unavailable };
  }
}

function fieldErrors(errors: Record<string, string>) {
  return Object.fromEntries(Object.keys(errors).map((field) => [field, errors[field] === "required" ? "هذا الحقل مطلوب." : errors[field] === "invalidSlug" ? "الرابط المختصر غير صالح أو محجوز لمسار النظام." : errors[field] === "translationIncomplete" ? "أكمل جميع حقول الترجمة الإنجليزية أو اتركها فارغة." : errors[field] === "invalidOrder" || errors[field] === "invalidKey" ? invalid : "تجاوز النص الحد المسموح."]));
}

function localeTranslation(locale: Locale, value: { title: string; slug: string; body: string; seoTitle?: string | null; seoDescription?: string | null }) {
  return { locale, ...value, seoTitle: value.seoTitle || null, seoDescription: value.seoDescription || null };
}

function revalidatePublicContent(paths: string[]) {
  for (const path of new Set(["/ar", "/ar/products", "/sitemap.xml", "/robots.txt", ...paths])) revalidatePath(path);
}

export async function saveContentPage(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return performAdminMutation(async (admin) => {
    const parsed = parseContentPageInput(formData);
    if (!parsed.ok) return { fieldErrors: fieldErrors(parsed.errors) };
    const value = parsed.value;
    const id = String(formData.get("contentPageId") ?? "").trim();
    const existing = id ? await prisma.contentPage.findUnique({ where: { id }, include: { translations: true } }) : null;
    if (id && !existing) return { error: "الصفحة غير موجودة." };
    if (existing && existing.pageKey !== value.pageKey) return { fieldErrors: { pageKey: "مفتاح الصفحة ثابت بعد إنشائها." } };
    const oldAr = existing?.translations.find((item) => item.locale === Locale.AR);
    const oldEn = existing?.translations.find((item) => item.locale === Locale.EN);
    const translations = [
      localeTranslation(Locale.AR, { title: value.titleAr, slug: value.slugAr, body: value.bodyAr, seoTitle: value.seoTitleAr, seoDescription: value.seoDescriptionAr }),
      ...(value.en ? [localeTranslation(Locale.EN, value.en)] : []),
    ];
    const touched = await prisma.$transaction(async (tx) => {
      const page = existing
        ? await tx.contentPage.update({ where: { id: existing.id }, data: { isActive: value.isActive }, select: { id: true, isActive: true } })
        : await tx.contentPage.create({ data: { pageKey: value.pageKey, isActive: value.isActive }, select: { id: true, isActive: true } });
      for (const translation of translations) {
        await tx.contentPageTranslation.upsert({
          where: { contentPageId_locale: { contentPageId: page.id, locale: translation.locale } },
          create: { contentPageId: page.id, ...translation },
          update: translation,
        });
      }
      if (!value.en && oldEn) await tx.contentPageTranslation.delete({ where: { contentPageId_locale: { contentPageId: page.id, locale: Locale.EN } } });
      if (oldAr && oldAr.slug !== value.slugAr) await preservePublicSlug(tx, { resourceType: "CONTENT_PAGE", locale: Locale.AR, oldSlug: oldAr.slug, newSlug: value.slugAr });
      if (oldEn && value.en && oldEn.slug !== value.en.slug) await preservePublicSlug(tx, { resourceType: "CONTENT_PAGE", locale: Locale.EN, oldSlug: oldEn.slug, newSlug: value.en.slug });
      await tx.adminAuditLog.create({
        data: { actorUserId: admin.id, action: existing ? "content.page.update" : "content.page.create", entityType: "ContentPage", entityId: page.id, metadata: { pageKey: value.pageKey, isActive: value.isActive } },
      });
      if (existing && existing.isActive !== value.isActive) await tx.adminAuditLog.create({
        data: { actorUserId: admin.id, action: value.isActive ? "content.page.publish" : "content.page.unpublish", entityType: "ContentPage", entityId: page.id, metadata: { pageKey: value.pageKey } },
      });
      if (oldAr && oldAr.slug !== value.slugAr) await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "content.page.slug-change", entityType: "ContentPage", entityId: page.id, metadata: { locale: "ar", fromSlug: oldAr.slug, toSlug: value.slugAr } } });
      if (oldEn && value.en && oldEn.slug !== value.en.slug) await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "content.page.slug-change", entityType: "ContentPage", entityId: page.id, metadata: { locale: "en", fromSlug: oldEn.slug, toSlug: value.en.slug } } });
      return [oldAr?.slug ? `/ar/${encodeURIComponent(oldAr.slug)}` : "", `/ar/${encodeURIComponent(value.slugAr)}`].filter(Boolean);
    });
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/pages");
    revalidatePath(`/admin/content/pages/${existing?.id ?? "new"}`);
    revalidatePath("/ar/[slug]", "page");
    revalidatePublicContent(touched);
    return { success: existing ? "تم تحديث الصفحة." : "تم إنشاء الصفحة." };
  });
}

export async function saveFaq(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return performAdminMutation(async (admin) => {
    const parsed = parseFaqInput(formData);
    if (!parsed.ok) return { fieldErrors: fieldErrors(parsed.errors) };
    const value = parsed.value;
    const id = String(formData.get("faqId") ?? "").trim();
    const existing = id ? await prisma.fAQ.findUnique({ where: { id }, include: { translations: true } }) : null;
    if (id && !existing) return { error: "السؤال غير موجود." };
    await prisma.$transaction(async (tx) => {
      const faq = existing
        ? await tx.fAQ.update({ where: { id: existing.id }, data: { isActive: value.isActive, sortOrder: value.sortOrder }, select: { id: true } })
        : await tx.fAQ.create({ data: { isActive: value.isActive, sortOrder: value.sortOrder }, select: { id: true } });
      const translations = [
        { locale: Locale.AR, question: value.questionAr, answer: value.answerAr },
        ...(value.en ? [{ locale: Locale.EN, ...value.en }] : []),
      ];
      for (const translation of translations) await tx.fAQTranslation.upsert({
        where: { faqId_locale: { faqId: faq.id, locale: translation.locale } },
        create: { faqId: faq.id, ...translation },
        update: { question: translation.question, answer: translation.answer },
      });
      if (!value.en && existing?.translations.some((translation) => translation.locale === Locale.EN)) await tx.fAQTranslation.delete({ where: { faqId_locale: { faqId: faq.id, locale: Locale.EN } } });
      await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: existing ? "content.faq.update" : "content.faq.create", entityType: "FAQ", entityId: faq.id, metadata: { isActive: value.isActive, sortOrder: value.sortOrder } } });
      if (existing && existing.isActive !== value.isActive) await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: value.isActive ? "content.faq.publish" : "content.faq.unpublish", entityType: "FAQ", entityId: faq.id } });
      return [faq.id];
    });
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/faq");
    revalidatePath("/admin/content/faq/new");
    return { success: existing ? "تم تحديث السؤال." : "تم إنشاء السؤال." };
  });
}
