import hmac
import base64
import json
import re
import time
from typing import Any

from fastapi import Header, HTTPException

from app.core.config import get_settings


def verify_identity_token(token: str | None, secret: str, now: int | None = None) -> dict[str, Any] | None:
    if not token or len(token) > 4096 or len(secret) < 32:
        return None
    parts = token.split(".")
    if len(parts) != 3 or any(not part for part in parts):
        return None
    try:
        header = json.loads(base64.urlsafe_b64decode(parts[0] + "=" * (-len(parts[0]) % 4)))
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        signature = base64.urlsafe_b64decode(parts[2] + "=" * (-len(parts[2]) % 4))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    if header != {"alg": "HS256", "typ": "JWT"} or not isinstance(claims, dict):
        return None
    expected = hmac.digest(secret.encode(), f"{parts[0]}.{parts[1]}".encode(), "sha256")
    if not hmac.compare_digest(signature, expected):
        return None
    current = int(time.time()) if now is None else now
    issued, expires = claims.get("iat"), claims.get("exp")
    if (
        claims.get("iss") != "farasha-web"
        or claims.get("aud") != "farasha-ai"
        or claims.get("role") not in {"CUSTOMER", "GUEST"}
        or not isinstance(claims.get("sub"), str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", claims["sub"])
        or not isinstance(claims.get("conversation_id"), str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", claims["conversation_id"])
        or claims.get("locale") not in {"ar", "en"}
        or not isinstance(issued, int)
        or isinstance(issued, bool)
        or not isinstance(expires, int)
        or isinstance(expires, bool)
        or issued > current + 30
        or expires <= current
        or expires - issued > 120
    ):
        return None
    return claims


async def require_internal_service(
    authorization: str | None = Header(default=None),
    x_farasha_identity: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.internal_auth_ready:
        raise HTTPException(status_code=503, detail="AI service authentication is not configured.")
    expected = f"Bearer {settings.internal_service_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    identity = verify_identity_token(x_farasha_identity, settings.internal_service_token)
    if identity is None:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    return identity
