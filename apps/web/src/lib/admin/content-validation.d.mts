export type ParsedContentPage = {
  pageKey: string; titleAr: string; slugAr: string; bodyAr: string; seoTitleAr: string; seoDescriptionAr: string;
  en: { title: string; slug: string; body: string; seoTitle: string | null; seoDescription: string | null } | null;
  isActive: boolean;
};
export type ParsedFaq = {
  questionAr: string; answerAr: string; en: { question: string; answer: string } | null; sortOrder: number; isActive: boolean;
};
export function parseContentPageInput(formData: FormData): { ok: true; value: ParsedContentPage } | { ok: false; errors: Record<string, string> };
export function parseFaqInput(formData: FormData): { ok: true; value: ParsedFaq } | { ok: false; errors: Record<string, string> };
