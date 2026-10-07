import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

from app.core.config import get_settings
from app.core.security import require_internal_service
from app.services.chat import answer_chat
from app.services.rate_limit import chat_rate_limiter

router = APIRouter()


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["USER", "ASSISTANT"]
    content: str = Field(min_length=1, max_length=1500)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    conversation_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    locale: str = Field(default="ar", pattern=r"^(ar|en)$")
    message: str = Field(min_length=1, max_length=2000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=8)


class ChatResponse(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request, identity: dict = Depends(require_internal_service)) -> ChatResponse:
    settings = get_settings()
    if not settings.gemini_ready:
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable.")
    if body.conversation_id != identity["conversation_id"] or body.locale != identity["locale"]:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    await chat_rate_limiter.check(identity["sub"])
    request_id = getattr(request.state, "request_id", "unavailable")
    try:
        async with asyncio.timeout(22):
            answer = await answer_chat(body, request_id=request_id, identity_token=request.headers.get("x-farasha-identity", ""), identity_role=identity["role"])
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "AI chat request failed",
            extra={"request_id": request_id, "conversation_id": body.conversation_id, "error_type": type(exc).__name__},
        )
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable.") from None
    return ChatResponse(message=answer)
