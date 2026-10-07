const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedSlugs = new Set([
  "account", "admin", "api", "assistant", "cart", "categories", "checkout",
  "design-system", "faq", "login", "orders", "products", "register", "search",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTranslation(formData, prefix, fields, errors) {
  const fieldName = (field) => `${field}${prefix[0].toUpperCase()}${prefix.slice(1)}`;
  const result = Object.fromEntries(fields.map((field) => [field, text(formData.get(fieldName(field)))]));
  const any = Object.values(result).some(Boolean);
  if (!any) return null;
  for (const field of fields) if (!result[field]) errors[fieldName(field)] = "translationIncomplete";
  return result;
}

function checkSlug(value, key, errors) {
  if (!slugPattern.test(value) || value.length > 160 || reservedSlugs.has(value.toLowerCase())) {
    errors[key] = "invalidSlug";
  }
}

export function parseContentPageInput(formData) {
  const errors = {};
  const pageKey = text(formData.get("pageKey")).toLowerCase();
  const titleAr = text(formData.get("titleAr"));
  const slugAr = text(formData.get("slugAr"));
  const bodyAr = text(formData.get("bodyAr"));
  const seoTitleAr = text(formData.get("seoTitleAr"));
  const seoDescriptionAr = text(formData.get("seoDescriptionAr"));
  const en = optionalTranslation(formData, "en", ["title", "slug", "body"], errors);
  const seoTitleEn = text(formData.get("seoTitleEn"));
  const seoDescriptionEn = text(formData.get("seoDescriptionEn"));

  if (!keyPattern.test(pageKey) || pageKey.length > 80) errors.pageKey = "invalidKey";
  if (!titleAr) errors.titleAr = "required";
  else if (titleAr.length > 180) errors.titleAr = "tooLong";
  if (!slugAr) errors.slugAr = "required";
  else checkSlug(slugAr, "slugAr", errors);
  if (!bodyAr) errors.bodyAr = "required";
  else if (bodyAr.length > 50000) errors.bodyAr = "tooLong";
  if (seoTitleAr.length > 180) errors.seoTitleAr = "tooLong";
  if (seoDescriptionAr.length > 500) errors.seoDescriptionAr = "tooLong";
  if (seoTitleEn.length > 180) errors.seoTitleEn = "tooLong";
  if (seoDescriptionEn.length > 500) errors.seoDescriptionEn = "tooLong";
  if (!en && (seoTitleEn || seoDescriptionEn)) errors.titleEn = "translationIncomplete";
  if (en) {
    if (en.title.length > 180) errors.titleEn = "tooLong";
    if (en.slug) checkSlug(en.slug, "slugEn", errors);
    if (en.body.length > 50000) errors.bodyEn = "tooLong";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pageKey, titleAr, slugAr, bodyAr, seoTitleAr, seoDescriptionAr,
      en: en ? { title: en.title, slug: en.slug, body: en.body, seoTitle: seoTitleEn || null, seoDescription: seoDescriptionEn || null } : null,
      isActive: formData.get("isActive") === "on",
    },
  };
}

export function parseFaqInput(formData) {
  const errors = {};
  const questionAr = text(formData.get("questionAr"));
  const answerAr = text(formData.get("answerAr"));
  const questionEn = text(formData.get("questionEn"));
  const answerEn = text(formData.get("answerEn"));
  const sortRaw = text(formData.get("sortOrder")) || "0";
  const sortOrder = /^(0|[1-9]\d{0,5})$/.test(sortRaw) ? Number(sortRaw) : null;
  if (!questionAr) errors.questionAr = "required";
  else if (questionAr.length > 250) errors.questionAr = "tooLong";
  if (!answerAr) errors.answerAr = "required";
  else if (answerAr.length > 10000) errors.answerAr = "tooLong";
  if (questionEn.length > 250) errors.questionEn = "tooLong";
  if (answerEn.length > 10000) errors.answerEn = "tooLong";
  if (Boolean(questionEn) !== Boolean(answerEn)) errors[questionEn ? "answerEn" : "questionEn"] = "translationIncomplete";
  if (sortOrder === null) errors.sortOrder = "invalidOrder";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      questionAr, answerAr,
      en: questionEn ? { question: questionEn, answer: answerEn } : null,
      sortOrder,
      isActive: formData.get("isActive") === "on",
    },
  };
}
