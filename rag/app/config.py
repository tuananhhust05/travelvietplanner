from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    qdrant_url: str = "http://qdrant:6333"
    rag_service_token: str = "change-me-internal-hmac-secret"
    gemini_api_key: str = ""
    serper_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_embed_model: str = "gemini-embedding-001"
    embed_dim: int = 768
    kb_collection: str = "tvp_kb"

    @property
    def stub_mode(self) -> bool:
        # No Gemini key → run deterministic stub so the stack is testable offline.
        return not self.gemini_api_key


settings = Settings()
