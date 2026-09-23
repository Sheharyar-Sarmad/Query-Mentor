"""
FastAPI dependency providers — inject services into route handlers.
"""

from app.services.cache import CacheManager, get_cache_manager
from app.services.llm import LLMService, get_llm_service
from app.services.retriever import RetrieverService, get_retriever_service


def cache_dep() -> CacheManager:
    return get_cache_manager()


def retriever_dep() -> RetrieverService:
    return get_retriever_service()


def llm_dep() -> LLMService:
    return get_llm_service()