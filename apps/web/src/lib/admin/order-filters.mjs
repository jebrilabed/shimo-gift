function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function parseAdminOrderFilters(params, validStatuses, validPaymentStatuses) {
  const rawQuery = first(params.q);
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 120) : "";
  const rawStatus = first(params.status);
  const rawPaymentStatus = first(params.paymentStatus);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const from = rawFrom ? parseDate(rawFrom) : null;
  const to = rawTo ? parseDate(rawTo) : null;
  const dateError = (!!rawFrom && !from) || (!!rawTo && !to) || (!!from && !!to && rawFrom > rawTo);
  const rawPage = Number(first(params.page) ?? 1);

  return {
    query,
    status: typeof rawStatus === "string" && validStatuses.includes(rawStatus) ? rawStatus : "",
    paymentStatus: typeof rawPaymentStatus === "string" && validPaymentStatuses.includes(rawPaymentStatus) ? rawPaymentStatus : "",
    from: dateError ? null : from,
    toExclusive: dateError || !to ? null : new Date(to.getTime() + 24 * 60 * 60 * 1000),
    fromValue: typeof rawFrom === "string" ? rawFrom : "",
    toValue: typeof rawTo === "string" ? rawTo : "",
    dateError,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function buildAdminOrderWhere(filters) {
  const createdAt = filters.from || filters.toExclusive
    ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.toExclusive ? { lt: filters.toExclusive } : {}) }
    : undefined;
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(filters.query ? {
      OR: [
        { orderNumber: { contains: filters.query, mode: "insensitive" } },
        { contactName: { contains: filters.query, mode: "insensitive" } },
        { contactPhone: { contains: filters.query } },
      ],
    } : {}),
  };
}
