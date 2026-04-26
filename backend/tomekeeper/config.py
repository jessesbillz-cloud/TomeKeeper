"""Environment-driven settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    allowed_origins: str = "http://localhost:5173"

    # Dev escape hatch. When true, the backend skips JWT verification and
    # uses the service-role client for every request. Pair with
    # VITE_DEV_NO_AUTH=1 on the frontend. NEVER enable in production.
    dev_no_auth: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
