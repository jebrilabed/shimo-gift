export type OrderNotificationEventType = "ORDER_CREATED" | "ORDER_CONFIRMED" | "ORDER_PROCESSING" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "ORDER_CANCELLED";
export function buildOrderNotificationEvent(eventType: OrderNotificationEventType | string, order: { id: string; contactPhone?: string; contactName?: string; orderNumber?: string; total?: unknown; currency?: string }): {
  eventKey: string; eventType: string; orderId: string; recipient: string;
  payload: { customerName: string; orderNumber: string; total: string; currency: string };
} | null;
export function getOrderNotificationEventType(status: string): OrderNotificationEventType | null;
