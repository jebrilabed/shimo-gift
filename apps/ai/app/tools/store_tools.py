import json
from typing import Any, Awaitable, Callable

import httpx
from langchain_core.tools import tool

from app.core.config import Settings

ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
ALLOWED_TOOL_NAMES = frozenset(
    {
        "search_products",
        "get_product",
        "get_product_stock",
        "get_faq",
        "get_shipping_policy",
        "get_return_policy",
        "get_order_status",
    }
)


def make_web_tool_executor(settings: Settings, identity_token: str, locale: str) -> ToolExecutor:
    async def execute(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name not in ALLOWED_TOOL_NAMES:
            raise ValueError("Tool is not allowed.")
        if not settings.internal_auth_ready:
            raise RuntimeError("Internal service authentication is not configured.")
        payload = {
            "tool": name,
            "arguments": arguments,
            "locale": locale,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            response = await client.post(
                settings.web_tools_url,
                json=payload,
                headers={"Authorization": f"Bearer {settings.internal_service_token}", "X-Farasha-Identity": identity_token},
            )
        if response.status_code != 200:
            raise RuntimeError("Store tool request failed.")
        result = response.json()
        if not isinstance(result, dict) or len(json.dumps(result, ensure_ascii=False)) > 8_000:
            raise RuntimeError("Store tool result is invalid.")
        return result

    return execute


def build_store_tools(execute: ToolExecutor, *, allow_order_status: bool = True):
    @tool
    async def search_products(query: str) -> dict[str, Any]:
        """Search active Farasha products by customer-entered product name or category."""
        return await execute("search_products", {"query": query})

    @tool
    async def get_product(slug: str) -> dict[str, Any]:
        """Get the current customer-visible details and prices for one product slug."""
        return await execute("get_product", {"slug": slug})

    @tool
    async def get_product_stock(slug: str, variant: str = "") -> dict[str, Any]:
        """Check current available SKU stock for a product, optionally matching a variant label."""
        return await execute("get_product_stock", {"slug": slug, "variant": variant})

    @tool
    async def get_faq(query: str) -> dict[str, Any]:
        """Find relevant active, approved store FAQ answers."""
        return await execute("get_faq", {"query": query})

    @tool
    async def get_shipping_policy() -> dict[str, Any]:
        """Retrieve the currently published shipping policy; do not infer rates."""
        return await execute("get_shipping_policy", {})

    @tool
    async def get_return_policy() -> dict[str, Any]:
        """Retrieve the currently published returns policy; do not infer eligibility."""
        return await execute("get_return_policy", {})

    @tool
    async def get_order_status(order_number: str) -> dict[str, Any]:
        """Get status for an order owned by the currently authenticated customer."""
        return await execute("get_order_status", {"orderNumber": order_number})

    tools = [
        search_products,
        get_product,
        get_product_stock,
        get_faq,
        get_shipping_policy,
        get_return_policy,
    ]
    if allow_order_status:
        tools.append(get_order_status)
    return tools
