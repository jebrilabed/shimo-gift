export function normalizeWhatsAppRecipient(value, defaultCountryCode = "") {
  if (typeof value !== "string" || value.length > 40) return null;
  const normalized = value.trim().replace(/[\s().-]/g, "");
  let digits;
  if (normalized.startsWith("+")) digits = normalized.slice(1);
  else if (normalized.startsWith("00")) digits = normalized.slice(2);
  else if (defaultCountryCode && /^\d+$/.test(defaultCountryCode) && /^\d+$/.test(normalized) && !normalized.startsWith("0")) digits = `${defaultCountryCode}${normalized}`;
  else return null;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function buildWhatsAppTemplateRequest({ recipient, templateName, languageCode, payload }) {
  if (!/^[1-9]\d{7,14}$/.test(recipient) || !/^[a-z0-9_]{1,512}$/.test(templateName) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const { customerName, orderNumber, total, currency } = payload;
  if (![customerName, orderNumber, total, currency].every((value) => typeof value === "string") || !/^\d+(?:\.\d{1,2})?$/.test(total) || !/^[A-Z]{3}$/.test(currency)) return null;
  return {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [{
        type: "body",
        parameters: [customerName, orderNumber, total, currency].map((text) => ({ type: "text", text: text.slice(0, 120) })),
      }],
    },
  };
}
