import type { Prisma } from "@/generated/prisma/client";

export type AdminOrderFilters = {
  query: string;
  status: string;
  paymentStatus: string;
  from: Date | null;
  toExclusive: Date | null;
  fromValue: string;
  toValue: string;
  dateError: boolean;
  page: number;
};
export function parseAdminOrderFilters(
  params: Record<string, string | string[] | undefined>,
  validStatuses: string[],
  validPaymentStatuses: string[],
): AdminOrderFilters;
export function buildAdminOrderWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput;

