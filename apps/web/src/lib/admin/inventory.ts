import { DEFAULT_LOW_STOCK_THRESHOLD, LOW_STOCK_SETTING_KEY } from "./config";
import { prisma } from "@/lib/db/prisma";

export async function getLowStockThreshold() {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { configuration: true } });
  const configuration = settings?.configuration;
  if (configuration && typeof configuration === "object" && !Array.isArray(configuration)) {
    const candidate = configuration[LOW_STOCK_SETTING_KEY];
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 1 && candidate <= 1000) return candidate;
  }
  return DEFAULT_LOW_STOCK_THRESHOLD;
}
