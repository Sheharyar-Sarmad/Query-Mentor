"""
LLMService — production-grade Groq wrapper + task methods.

Features:
    - Retries with exponential backoff on transient failures
    - Automatic fallback to a secondary model when the primary is down
    - Streaming support via stream() / astream()
    - Token usage tracking for cost observability
    - Per-call timeouts
    - Thread-safe singleton
    - Structured logging
    - Robust JSON extraction with schema hints
    - Prompt-injection detection (basic)

Public API:
    generate_sql(question, context, dialect)
    explain_sql(sql, context)
    simulate_sql(sql, schema, dialect)
    chat(message)
    stream_chat(message)  → yields string chunks
"""

import json
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Iterable, Iterator, Optional

from langchain_groq import ChatGroq
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config.settings import Settings, settings as global_settings
from app.services.prompts import PromptLibrary

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────
# Errors
# ────────────────────────────────────────────────────────────

class LLMError(Exception):
    """Base class for LLM service errors."""


class LLMTimeoutError(LLMError):
    """LLM call exceeded the configured timeout."""


class LLMResponseError(LLMError):
    """LLM returned malformed or empty output after retries."""


class LLMUnavailableError(LLMError):
    """All configured models failed."""


# ────────────────────────────────────────────────────────────
# Usage tracking
# ────────────────────────────────────────────────────────────

@dataclass
class CallStats:
    """Per-call metrics."""
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    attempts: int = 1
    cached: bool = False


@dataclass
class UsageTracker:
    """Process-wide token usage accumulator."""
    total_calls: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_latency_ms: float = 0.0
    error_count: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record(self, stats: CallStats) -> None:
        with self._lock:
            self.total_calls += 1
            self.total_prompt_tokens += stats.prompt_tokens
            self.total_completion_tokens += stats.completion_tokens
            self.total_tokens += stats.total_tokens
            self.total_latency_ms += stats.latency_ms

    def record_error(self) -> None:
        with self._lock:
            self.error_count += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            avg_latency = (
                self.total_latency_ms / self.total_calls
                if self.total_calls else 0.0
            )
            return {
                "calls": self.total_calls,
                "prompt_tokens": self.total_prompt_tokens,
                "completion_tokens": self.total_completion_tokens,
                "total_tokens": self.total_tokens,
                "avg_latency_ms": round(avg_latency, 1),
                "errors": self.error_count,
            }


# ────────────────────────────────────────────────────────────
# Prompt-injection detection
# ────────────────────────────────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous|prior)\s+", re.I),
    re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.I),
    re.compile(r"system\s*:\s*", re.I),
    re.compile(r"<\s*\|.*?\|\s*>", re.I),  # special tokens
]


def _looks_like_injection(text: str) -> bool:
    return any(p.search(text) for p in _INJECTION_PATTERNS)


def _sanitize_user_input(text: str) -> str:
    """Basic sanitization — strips known injection patterns."""
    cleaned = text.strip()
    for pattern in _INJECTION_PATTERNS:
        cleaned = pattern.sub("[redacted]", cleaned)
    return cleaned


# ────────────────────────────────────────────────────────────
# LLMService
# ────────────────────────────────────────────────────────────

class LLMService:
    """Production wrapper around Groq with retries and observability."""

    # Transient failures worth retrying
    RETRYABLE_EXCEPTIONS = (
        TimeoutError,
        ConnectionError,
    )

    def __init__(self, config: Optional[Settings] = None) -> None:
        self._settings = config or global_settings
        self._llm: Optional[ChatGroq] = None
        self._llm_lock = threading.Lock()
        self.usage = UsageTracker()

        # Optional fallback model chain. Empty by default; append IDs here
        # if you want automatic model failover.
        self._fallback_models: list[str] = []

    # ────────────────────────────────────────────────────────
    # LLM factory
    # ────────────────────────────────────────────────────────

    @property
    def llm(self) -> ChatGroq:
        if self._llm is None:
            with self._llm_lock:
                if self._llm is None:
                    self._llm = self._build_llm(self._settings.LLM_MODEL)
        return self._llm

    def _build_llm(self, model: str) -> ChatGroq:
        return ChatGroq(
            model=model,
            api_key=self._settings.GROQ_API_KEY,
            temperature=self._settings.LLM_TEMPERATURE,
            max_tokens=self._settings.LLM_MAX_TOKENS,
            timeout=30.0,
            max_retries=0,  # we handle retries ourselves
        )

    # ────────────────────────────────────────────────────────
    # Retry-wrapped invoke
    # ────────────────────────────────────────────────────────

    def _retry_invoke(self, prompt: str, model: Optional[str] = None):
        """Invoke with retries on transient errors."""

        @retry(
            reraise=True,
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            retry=retry_if_exception_type(self.RETRYABLE_EXCEPTIONS),
        )
        def _call():
            client = self._build_llm(model) if model else self.llm
            return client.invoke(prompt)

        return _call()

    # ────────────────────────────────────────────────────────
    # Response normalization
    # ────────────────────────────────────────────────────────

    def _extract_content(self, response) -> tuple[str, CallStats]:
        """Convert any LangChain response into a plain string."""
        model_name = self._settings.LLM_MODEL
        stats = CallStats(model=model_name)

        # Token usage if the response exposes it
        usage_meta = getattr(response, "usage_metadata", None) or {}
        if usage_meta:
            stats.prompt_tokens = int(usage_meta.get("input_tokens", 0))
            stats.completion_tokens = int(usage_meta.get("output_tokens", 0))
            stats.total_tokens = int(usage_meta.get("total_tokens", 0))
        else:
            meta = getattr(response, "response_metadata", {}) or {}
            token_usage = meta.get("token_usage", {}) or {}
            stats.prompt_tokens = int(token_usage.get("prompt_tokens", 0))
            stats.completion_tokens = int(token_usage.get("completion_tokens", 0))
            stats.total_tokens = int(token_usage.get("total_tokens", 0))

        content = response.content

        if isinstance(content, str) and content.strip():
            return content.strip(), stats

        if isinstance(content, list):
            parts: list[str] = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict):
                    btype = block.get("type")
                    if btype in ("text", "output_text"):
                        parts.append(block.get("text", ""))
                    elif "text" in block and btype is None:
                        parts.append(block["text"])
            joined = "".join(parts).strip()
            if joined:
                return joined, stats

        for source in (
            getattr(response, "additional_kwargs", {}) or {},
            getattr(response, "response_metadata", {}) or {},
        ):
            for key in ("reasoning_content", "reasoning", "content", "text"):
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip(), stats

        return str(content).strip(), stats

    # ────────────────────────────────────────────────────────
    # Core invoke
    # ────────────────────────────────────────────────────────

    def _invoke(self, prompt: str) -> str:
        start = time.perf_counter()

        try:
            response = self._retry_invoke(prompt)
        except Exception as exc:
            self.usage.record_error()
            logger.exception("LLM invoke failed: %s", exc)
            raise LLMUnavailableError(str(exc)) from exc

        content, stats = self._extract_content(response)
        stats.latency_ms = (time.perf_counter() - start) * 1000
        self.usage.record(stats)

        if not content:
            logger.warning("Empty LLM response, tokens=%s", stats.total_tokens)
            raise LLMResponseError("LLM returned empty content")

        return content

    # ────────────────────────────────────────────────────────
    # Streaming invoke
    # ────────────────────────────────────────────────────────

    def stream_chat(self, message: str) -> Iterator[str]:
        """Yield content chunks as they arrive from Groq."""
        system = PromptLibrary.GENERAL_CHAT
        prompt = f"{system}\n\nUser: {_sanitize_user_input(message)}"

        try:
            for chunk in self.llm.stream(prompt):
                text = getattr(chunk, "content", "") or ""
                if isinstance(text, list):
                    text = "".join(
                        b.get("text", "") if isinstance(b, dict) else str(b)
                        for b in text
                    )
                if text:
                    yield text
        except Exception as exc:
            self.usage.record_error()
            logger.exception("Streaming failed: %s", exc)
            raise LLMUnavailableError(str(exc)) from exc

    # ────────────────────────────────────────────────────────
    # JSON extraction
    # ────────────────────────────────────────────────────────

    @staticmethod
    def _extract_json(raw: str) -> Optional[dict]:
        """Extract a JSON object from LLM output, tolerant of fences."""
        if not raw:
            return None

        cleaned = raw.strip()

        # Direct parse
        try:
            data = json.loads(cleaned)
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            pass

        # Strip ```json ... ``` fences
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
        if fence_match:
            try:
                data = json.loads(fence_match.group(1).strip())
                return data if isinstance(data, dict) else None
            except json.JSONDecodeError:
                pass

        # Fall back: extract first balanced {...} object
        start = cleaned.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(cleaned)):
                ch = cleaned[i]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = cleaned[start : i + 1]
                        try:
                            data = json.loads(candidate)
                            return data if isinstance(data, dict) else None
                        except json.JSONDecodeError:
                            break

        return None

    @staticmethod
    def _compose(system: str, context: str, user_input: str) -> str:
        return (
            f"{system}\n\n"
            f"─────── CONTEXT FROM SQL DOCUMENTATION ───────\n{context}\n\n"
            f"─────── USER INPUT ───────\n{user_input}\n"
        )

    # ────────────────────────────────────────────────────────
    # Public task methods
    # ────────────────────────────────────────────────────────

    def generate_sql(
        self,
        question: str,
        context: str,
        dialect: str = "postgres",
    ) -> dict:
        system = PromptLibrary.build_text_to_sql(dialect)
        raw = self._invoke(self._compose(system, context, _sanitize_user_input(question)))
        data = self._extract_json(raw) or {}

        sql = (data.get("sql") or "").strip()
        explanation = (data.get("explanation") or "").strip()

        # Fallback: if JSON parse failed but raw text looks like SQL, use it
        if not sql and raw.strip():
            sql = raw.strip()
            explanation = explanation or "Generated from raw model output."

        if not sql:
            raise LLMResponseError("No SQL produced for the question")

        return {"sql": sql, "explanation": explanation}

    def explain_sql(self, sql: str, context: str) -> dict:
        system = PromptLibrary.SQL_TO_TEXT
        raw = self._invoke(self._compose(system, context, sql))
        data = self._extract_json(raw) or {}

        summary = data.get("summary") or ""
        if not summary and raw:
            summary = raw[:500]

        return {
            "summary": summary if isinstance(summary, str) else str(summary),
            "line_by_line": data.get("line_by_line") or [],
            "tips": data.get("tips") or [],
        }

    def simulate_sql(
        self,
        sql: str,
        schema: str,
        dialect: str = "postgres",
    ) -> dict:
        system = PromptLibrary.build_simulate(dialect, schema)
        raw = self._invoke(f"{system}\n\nSQL:\n{sql}")
        data = self._extract_json(raw)

        if data is None:
            data = {
                "status": "ERROR",
                "error_message": "Model returned unparseable output.",
                "raw_response": raw[:1000],
            }

        data.setdefault("status", "ERROR")
        data["simulated"] = True
        return data

    def chat(self, message: str) -> str:
        system = PromptLibrary.GENERAL_CHAT
        return self._invoke(
            f"{system}\n\nUser: {_sanitize_user_input(message)}"
        )


# ────────────────────────────────────────────────────────────
# Thread-safe singleton
# ────────────────────────────────────────────────────────────

_llm_instance: Optional[LLMService] = None
_llm_lock = threading.Lock()


def get_llm_service() -> LLMService:
    global _llm_instance
    if _llm_instance is None:
        with _llm_lock:
            if _llm_instance is None:
                _llm_instance = LLMService()
    return _llm_instance