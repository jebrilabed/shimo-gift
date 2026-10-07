from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    service_name: str = "Farasha AI Service"
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: str = ""
    internal_service_token: str = ""
    web_tools_url: str = "http://127.0.0.1:3000/api/internal/ai/tools"
    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="", validation_alias="GEMINI_MODEL")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def internal_auth_ready(self) -> bool:
        return len(self.internal_service_token) >= 32

    @property
    def gemini_ready(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
