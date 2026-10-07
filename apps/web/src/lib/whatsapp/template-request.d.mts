export function normalizeWhatsAppRecipient(value: unknown, defaultCountryCode?: string): string | null;
export function buildWhatsAppTemplateRequest(input: {
  recipient: string; templateName: string; languageCode: string;
  payload: unknown;
}): {
  messaging_product: "whatsapp"; to: string; type: "template";
  template: { name: string; language: { code: string }; components: Array<{ type: "body"; parameters: Array<{ type: "text"; text: string }> }> };
} | null;
