export const AI_TOOL_NAMES = Object.freeze([
  "search_products",
  "get_product",
  "get_product_stock",
  "get_faq",
  "get_shipping_policy",
  "get_return_policy",
  "get_order_status",
]);

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const orderNumberPattern = /^(?:FAR-[A-F0-9]{32}|OF-[0-9A-HJKMNP-TV-Z]{13})$/i;

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function shortText(value, max) {
  return typeof value === "string" && value.trim().length > 1 && value.length <= max ? value.trim() : null;
}

function validSlug(value) {
  return typeof value === "string" && value.length <= 120 && slugPattern.test(value) ? value : null;
}

export function validateAIToolRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { tool, arguments: args, locale } = value;
  if (!hasOnlyKeys(value, ["tool", "arguments", "locale"]) || !AI_TOOL_NAMES.includes(tool) || !args || typeof args !== "object" || Array.isArray(args)) return null;
  if (locale !== "ar" && locale !== "en") return null;
  let safeArguments;
  switch (tool) {
    case "search_products":
    case "get_faq": {
      if (!hasOnlyKeys(args, ["query"])) return null;
      const query = shortText(args.query, tool === "get_faq" ? 160 : 100);
      if (!query) return null;
      safeArguments = { query };
      break;
    }
    case "get_product": {
      if (!hasOnlyKeys(args, ["slug"])) return null;
      const slug = validSlug(args.slug);
      if (!slug) return null;
      safeArguments = { slug };
      break;
    }
    case "get_product_stock": {
      if (!hasOnlyKeys(args, ["slug", "variant"])) return null;
      const slug = validSlug(args.slug);
      const variant = args.variant === undefined || args.variant === "" ? "" : shortText(args.variant, 100);
      if (!slug || variant === null) return null;
      safeArguments = { slug, variant };
      break;
    }
    case "get_order_status": {
      if (!hasOnlyKeys(args, ["orderNumber"])) return null;
      const orderNumber = typeof args.orderNumber === "string" && orderNumberPattern.test(args.orderNumber) ? args.orderNumber.toUpperCase() : null;
      if (!orderNumber) return null;
      safeArguments = { orderNumber };
      break;
    }
    case "get_shipping_policy":
    case "get_return_policy":
      if (Object.keys(args).length) return null;
      safeArguments = {};
      break;
    default:
      return null;
  }
  return { tool, arguments: safeArguments, locale };
}

export function hasMatchingOrigin(origin, requestOrigin) {
  if (typeof origin !== "string" || typeof requestOrigin !== "string") return false;
  try { return new URL(origin).origin === new URL(requestOrigin).origin; } catch { return false; }
}

export function buildConversationOwnershipFilter(owner, conversationId) {
  if (!owner || typeof owner !== "object" || typeof conversationId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(conversationId)) return null;
  if (typeof owner.userId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(owner.userId) && owner.guestTokenHash === null) {
    return { id: conversationId, userId: owner.userId };
  }
  if (owner.userId === null && typeof owner.guestTokenHash === "string" && /^[a-f0-9]{64}$/.test(owner.guestTokenHash)) {
    return { id: conversationId, guestTokenHash: owner.guestTokenHash };
  }
  return null;
}

export function buildOwnedOrderFilter(userId, orderNumber) {
  if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(userId) ||
    typeof orderNumber !== "string" || !orderNumberPattern.test(orderNumber)) return null;
  return { userId, orderNumber: orderNumber.toUpperCase() };
}
