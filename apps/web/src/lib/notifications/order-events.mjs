const eventTypes = new Set([
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
]);

export function buildOrderNotificationEvent(eventType, order) {
  if (!eventTypes.has(eventType) || typeof order?.id !== "string" || !order.id) return null;
  const recipient = typeof order.contactPhone === "string" ? order.contactPhone.trim() : "";
  return {
    eventKey: `${eventType}:${order.id}`,
    eventType,
    orderId: order.id,
    recipient,
    payload: {
      customerName: typeof order.contactName === "string" ? order.contactName.trim().slice(0, 120) : "",
      orderNumber: typeof order.orderNumber === "string" ? order.orderNumber : "",
      total: typeof order.total?.toString === "function" ? order.total.toString() : String(order.total ?? ""),
      currency: typeof order.currency === "string" ? order.currency : "",
    },
  };
}

export function getOrderNotificationEventType(status) {
  return eventTypes.has(`ORDER_${status}`) && status !== "CREATED" ? `ORDER_${status}` : null;
}
