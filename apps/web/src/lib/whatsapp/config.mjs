const eventTemplateEnv = {
  ORDER_CREATED: "WHATSAPP_TEMPLATE_ORDER_CREATED",
  ORDER_CONFIRMED: "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  ORDER_PROCESSING: "WHATSAPP_TEMPLATE_ORDER_PROCESSING",
  ORDER_SHIPPED: "WHATSAPP_TEMPLATE_ORDER_SHIPPED",
  ORDER_DELIVERED: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
  ORDER_CANCELLED: "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
};

export function readWhatsAppConfig(env = process.env) {
  const templates = Object.fromEntries(Object.entries(eventTemplateEnv).map(([eventType, envKey]) => [eventType, env[envKey]?.trim() ?? ""]));
  const defaultCountryCode = env.WHATSAPP_DEFAULT_COUNTRY_CODE?.trim() ?? "";
  const config = {
    accessToken: env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "",
    apiVersion: env.WHATSAPP_API_VERSION?.trim() ?? "",
    languageCode: env.WHATSAPP_TEMPLATE_LANGUAGE_CODE?.trim() ?? "",
    defaultCountryCode,
    templates,
  };
  const issues = [];
  if (!config.accessToken) issues.push("WHATSAPP_ACCESS_TOKEN");
  if (!/^\d{4,30}$/.test(config.phoneNumberId)) issues.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!/^v\d+\.\d+$/.test(config.apiVersion)) issues.push("WHATSAPP_API_VERSION");
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(config.languageCode)) issues.push("WHATSAPP_TEMPLATE_LANGUAGE_CODE");
  if (defaultCountryCode && !/^\d{1,3}$/.test(defaultCountryCode)) issues.push("WHATSAPP_DEFAULT_COUNTRY_CODE");
  return { ...config, issues };
}

export function getWhatsAppTemplate(config, eventType) {
  const templateName = config.templates[eventType];
  return typeof templateName === "string" && /^[a-z0-9_]{1,512}$/.test(templateName) ? templateName : null;
}
