export const AI_TOOL_NAMES: readonly string[];
export function validateAIToolRequest(value: unknown): { tool: string; arguments: Record<string, unknown>; locale: "ar" | "en" } | null;
export function hasMatchingOrigin(origin: string | null, requestOrigin: string): boolean;
export function buildConversationOwnershipFilter(owner: { userId: string | null; guestTokenHash: string | null }, conversationId: string): { id: string; userId?: string; guestTokenHash?: string } | null;
export function buildOwnedOrderFilter(userId: string, orderNumber: string): { userId: string; orderNumber: string } | null;
