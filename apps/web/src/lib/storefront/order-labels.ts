import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { storefrontMessages as messages } from "./messages";

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: messages.ar.statusPending,
  [OrderStatus.CONFIRMED]: messages.ar.statusConfirmed,
  [OrderStatus.PROCESSING]: messages.ar.statusProcessing,
  [OrderStatus.SHIPPED]: messages.ar.statusShipped,
  [OrderStatus.DELIVERED]: messages.ar.statusDelivered,
  [OrderStatus.CANCELLED]: messages.ar.statusCancelled,
};

export function orderStatusLabel(status: OrderStatus) {
  return statusLabels[status];
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.UNPAID]: messages.ar.paymentUnpaid,
  [PaymentStatus.PENDING]: messages.ar.paymentPending,
  [PaymentStatus.PAID]: messages.ar.paymentPaid,
  [PaymentStatus.FAILED]: messages.ar.paymentFailed,
  [PaymentStatus.REFUNDED]: messages.ar.paymentRefunded,
  [PaymentStatus.PARTIALLY_REFUNDED]: messages.ar.paymentPartiallyRefunded,
};

export function paymentStatusLabel(status: PaymentStatus) {
  return paymentStatusLabels[status];
}
