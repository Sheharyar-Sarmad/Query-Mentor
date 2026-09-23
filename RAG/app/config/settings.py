from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# app/config/settings.py → parent.parent.parent = RAG/
BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── App metadata ───────────────────────────────────
    APP_NAME: str = "QueryMentor"
    APP_DESCRIPTION: str = (
        "FastAPI backend for QueryMentor — a RAG-powered SQL learning assistant "
        "that translates between natural language and SQL, grounded in uploaded "
        "documentation via Pinecone and streamed from Groq."
    )
    APP_PHASE: Literal["development", "production"] = "development"
    APP_VERSION: str = "1.0.0"
    APP_BASE_ROUTE_PREFIX: str = "/api/v1"

    AUTHOR_NAME: str = "Sheharyar Sarmad"
    AUTHOR_EMAIL: str = "developersheharyar2010@gmail.com"

    # ─── Secrets (required) ─────────────────────────────
    GROQ_API_KEY: str
    PINECONE_API_KEY: str

    # ─── Pinecone ───────────────────────────────────────
    PINECONE_INDEX_NAME: str = "querymentor"
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"

    # ─── LLM ────────────────────────────────────────────
    LLM_MODEL: str = "openai/gpt-oss-120b"
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 2048

    # ─── Embeddings ─────────────────────────────────────
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384

    # ─── RAG tuning ─────────────────────────────────────
    RETRIEVER_K: int = 5
    RETRIEVER_FETCH_K: int = 15
    RETRIEVER_LAMBDA: float = 0.5
    CHUNK_SIZE: int = 900
    CHUNK_OVERLAP: int = 120

    # ─── Cache tuning ───────────────────────────────────
    CACHE_DIR: str = "cache"
    CACHE_L1_MAXSIZE: int = 512
    CACHE_L1_TTL: int = 3600          # 1 hour
    CACHE_L2_TTL: int = 604800        # 7 days
    CACHE_L3_TTL: int = 604800        # 7 days
    CACHE_SEMANTIC_THRESHOLD: float = 0.92

    # ─── Rate limit ─────────────────────────────────────
    RATE_LIMIT_MAX: int = 30
    RATE_LIMIT_WINDOW: int = 60

    @property
    def is_production(self) -> bool:
        return self.APP_PHASE == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_PHASE == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()