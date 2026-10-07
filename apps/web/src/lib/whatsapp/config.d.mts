export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  languageCode: string;
  defaultCountryCode: string;
  templates: Record<string, string>;
  issues: string[];
};
export function readWhatsAppConfig(env?: NodeJS.ProcessEnv): WhatsAppConfig;
export function getWhatsAppTemplate(config: WhatsAppConfig, eventType: string): string | null;
