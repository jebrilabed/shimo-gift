const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedOrderTransitions(status) {
  return transitions[status] ?? [];
}

export function canTransitionOrder(from, to) {
  return allowedOrderTransitions(from).includes(to);
}

export function parseCheckoutInput(formData) {
  const readText = (field) => {
    const value = formData.get(field);
    return typeof value === "string" ? value.trim() : "";
  };
  const raw = {
    contactName: readText("contactName"),
    contactPhone: readText("contactPhone"),
    address: readText("address"),
    city: readText("city"),
    customerNote: readText("customerNote"),
  };
  const addressId = readText("addressId");
  const errors = {};
  if (!addressId) {
    if (!raw.contactName || raw.contactName.length > 200) errors.contactName = "validationName";
    const digitCount = raw.contactPhone.replace(/\D/g, "").length;
    if (raw.contactPhone.length > 40 || digitCount < 6 || !/^\+?[()\d\s.-]+$/.test(raw.contactPhone)) errors.contactPhone = "validationPhone";
    if (!raw.address || raw.address.length > 500) errors.address = "validationAddress";
    if (!raw.city || raw.city.length > 120) errors.city = "validationCity";
  } else if (addressId.length > 64) errors.address = "validationAddress";
  if (raw.customerNote.length > 2000) errors.customerNote = "validationNote";
  if (Object.keys(errors).length) return { ok: false, errors, values: raw };
  return { ok: true, value: addressId ? { ...raw, addressId } : raw };
}

export function parseCartQuantity(value) {
  const quantity = typeof value === "string" && /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(quantity) && quantity > 0 ? { ok: true, quantity } : { ok: false };
}
