export function allowedOrderTransitions(status: string): string[];
export function canTransitionOrder(from: string, to: string): boolean;
export function parseCheckoutInput(formData: FormData):
  | { ok: true; value: { contactName: string; contactPhone: string; address: string; city: string; customerNote: string } }
  | { ok: false; errors: Record<string, string>; values: { contactName: string; contactPhone: string; address: string; city: string; customerNote: string } };
export function parseCartQuantity(value: unknown): { ok: true; quantity: number } | { ok: false };
