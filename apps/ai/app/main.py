from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.api.v1.ai import router as ai_router

settings = get_settings()

app = FastAPI(
    title=settings.service_name,
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        max_age=600,
    )

register_error_handlers(app)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/health/live", tags=["health"])
async def liveness() -> dict[str, str]:
    return {"service": "ai", "status": "ok"}


@app.get("/health/ready", tags=["health"])
async def readiness() -> dict[str, object]:
    integrations = {
        "internal_auth": settings.internal_auth_ready,
        "gemini": settings.gemini_ready,
    }
    ready = all(integrations.values())
    return {
        "service": "ai",
        "status": "ready" if ready else "degraded",
        "integrations": integrations,
    } | ({"missing": [name for name, configured in integrations.items() if not configured]} if not ready else {})
