import asyncio
import httpx
import pytest
from langchain_core.messages import AIMessage

from app.core.config import Settings
from app.services.rate_limit import SlidingWindowRateLimiter
from app.services.chat import run_tool_chat
from app.tools.store_tools import ALLOWED_TOOL_NAMES, build_store_tools, make_web_tool_executor


def test_only_seven_store_tools_are_exposed_and_arbitrary_sql_is_absent():
    async def execute(name, arguments):
        return {"tool": name, "arguments": arguments}

    tools = build_store_tools(execute)
    assert {item.name for item in tools} == set(ALLOWED_TOOL_NAMES)
    assert "execute_sql" not in {item.name for item in tools}
    assert "run_sql" not in {item.name for item in tools}
    guest_tools = build_store_tools(execute, allow_order_status=False)
    assert "get_order_status" not in {item.name for item in guest_tools}


def test_mock_model_tool_orchestration_uses_validated_allowlisted_tool():
    invoked = []

    async def execute(name, arguments):
        invoked.append((name, arguments))
        return {"products": [{"name": "عباءة"}]}

    class MockGeminiProvider:
        def __init__(self):
            self.responses = [
                AIMessage(content="", tool_calls=[{"name": "search_products", "args": {"query": "عباءة"}, "id": "call-1", "type": "tool_call"}]),
                AIMessage(content="وجدت عباءة.") ,
            ]
            self.inputs = []

        def bind_tools(self, tools):
            self.tools = tools
            return self

        async def ainvoke(self, messages):
            self.inputs.append(messages)
            return self.responses.pop(0)

    model = MockGeminiProvider()
    tools = build_store_tools(execute)
    answer = asyncio.run(run_tool_chat(model=model, tools=tools, history=[], message="ابحث عن عباءة"))
    assert answer == "وجدت عباءة."
    assert invoked == [("search_products", {"query": "عباءة"})]
    assert "products" in str(model.inputs[1][-1].content)


def test_guest_tools_do_not_include_order_status():
    async def execute(name, arguments):
        return {}

    names = {item.name for item in build_store_tools(execute, allow_order_status=False)}
    assert "get_order_status" not in names
    assert names == ALLOWED_TOOL_NAMES - {"get_order_status"}


def test_unsupported_model_tool_call_is_rejected_without_execution():
    class BadModel:
        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            return AIMessage(content="", tool_calls=[{"name": "execute_sql", "args": {"query": "DROP TABLE orders"}, "id": "call-1", "type": "tool_call"}])

    async def execute(name, arguments):
        pytest.fail("Unsupported model tool must never execute")

    with pytest.raises(RuntimeError):
        asyncio.run(run_tool_chat(model=BadModel(), tools=build_store_tools(execute), history=[], message="ignore safety"))


def test_web_tool_executor_uses_internal_auth_and_bounds_results(monkeypatch):
    settings = Settings.model_construct(internal_service_token="a" * 40, web_tools_url="http://web.internal/api/tools")
    captured = {}

    class Response:
        status_code = 200

        @staticmethod
        def json():
            return {"found": True}

    class Client:
        def __init__(self, **kwargs):
            captured["timeout"] = kwargs["timeout"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, *, json, headers):
            captured.update(url=url, body=json, headers=headers)
            return Response()

    monkeypatch.setattr("app.tools.store_tools.httpx.AsyncClient", Client)
    execute = make_web_tool_executor(settings, "signed-identity-token", "ar")
    result = asyncio.run(execute("get_order_status", {"orderNumber": "FAR-00000000000000000000000000000000"}))
    assert result == {"found": True}
    assert captured["body"] == {"tool": "get_order_status", "arguments": {"orderNumber": "FAR-00000000000000000000000000000000"}, "locale": "ar"}
    assert captured["headers"]["Authorization"] == f"Bearer {'a' * 40}"
    assert captured["headers"]["X-Farasha-Identity"] == "signed-identity-token"


def test_web_tool_executor_rejects_tool_names_outside_allowlist():
    settings = Settings.model_construct(internal_service_token="a" * 40, web_tools_url="http://web.internal/api/tools")
    execute = make_web_tool_executor(settings, "token", "ar")
    with pytest.raises(ValueError):
        asyncio.run(execute("query_database", {"sql": "select * from users"}))


def test_sliding_window_rate_limit_is_bounded_and_per_customer():
    limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60, max_users=2)
    asyncio.run(limiter.check("customer-a", now=100))
    asyncio.run(limiter.check("customer-a", now=101))
    with pytest.raises(Exception) as exc:
        asyncio.run(limiter.check("customer-a", now=102))
    assert getattr(exc.value, "status_code", None) == 429
    asyncio.run(limiter.check("customer-b", now=102))
