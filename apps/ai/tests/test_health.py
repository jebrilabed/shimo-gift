from fastapi.testclient import TestClient
from app.core.config import Settings
import app.main as main_module

from app.main import app

client = TestClient(app)


def test_liveness_endpoint_returns_ok() -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"service": "ai", "status": "ok"}
    assert response.headers.get("x-request-id")


def test_readiness_endpoint_reports_missing_optional_chat_configuration(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "settings", Settings.model_construct(
        internal_service_token="",
        gemini_api_key="",
        gemini_model="",
    ))
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["missing"] == ["internal_auth", "gemini"]
