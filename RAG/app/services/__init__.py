"""
QueryMentor service layer — OOP API.

Each service is a class; use the module-level getters for singletons.
"""

from app.services.cache import CacheManager, get_cache_manager
from app.services.retriever import RetrieverService, get_retriever_service
from app.services.llm import LLMService, get_llm_service
from app.services.ingestion import IngestionService
from app.services.prompts import PromptLibrary

__all__ = [
    "CacheManager",
    "get_cache_manager",
    "RetrieverService",
    "get_retriever_service",
    "LLMService",
    "get_llm_service",
    "IngestionService",
    "PromptLibrary",
]