export const ADMIN_PAGE_SIZE = 20;
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const LOW_STOCK_SETTING_KEY = "lowStockThreshold";

export type AdminActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};
