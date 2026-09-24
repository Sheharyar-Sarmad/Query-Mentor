# QueryMentor — Backend (RAG)

FastAPI backend powering QueryMentor's RAG pipeline, caching, and SQL tooling.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11.11-3776AB?style=flat-square&logo=python)](https://www.python.org)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=flat-square)](https://www.langchain.com)
[![Groq](https://img.shields.io/badge/LLM-Groq-7c3aed?style=flat-square)](https://groq.com)
[![Pinecone](https://img.shields.io/badge/VectorDB-Pinecone-2dd4bf?style=flat-square)](https://www.pinecone.io)

---

> ⚠️ **Python 3.11 required.** Python 3.12+ will **not** work — `langchain-pinecone` 0.2.x requires `<3.13` and only builds cleanly against 3.11 in this project. The pinned version is in `.python-version` (`3.11.11`).

---

## 📦 Stack

| Layer | Tech |
|---|---|
| Framework | FastAPI 0.115 |
| Server | Uvicorn |
| Language | Python 3.11.11 (hard requirement) |
| Orchestration | LangChain 0.3 |
| LLM | Groq — `llama-3.3-70b-versatile` |
| Vector DB | Pinecone |
| Embeddings | FastEmbed (ONNX) |
| Caching | cachetools + SQLite + semantic cache (3-tier) |
| PDF Parsing | pypdf |
| Package Manager | uv |

---

## 🚀 Setup

```bash
# Install dependencies
uv sync

# Configure environment
cp .env.example .env
# fill in GROQ_API_KEY, PINECONE_API_KEY, etc. — see below

# Run the dev server
uv run uvicorn app.main:app --reload --port 8000

# Ingest the SQL reference PDF into Pinecone
curl -X POST http://localhost:8000/api/v1/admin/ingest
```

Server runs at `http://localhost:8000`.

---

## 📁 Structure

```text
RAG/
├── app/
│   ├── main.py              # Server class + ASGI app
│   ├── config/settings.py
│   ├── routes/               # 4 API routers
│   ├── services/              # cache, ingestion, llm, retriever
│   └── data/sql_reference.pdf
├── cache/                    # SQLite cache
├── server.py
├── pyproject.toml
├── requirements.txt
└── .python-version           # 3.11.11
```

---

## ⚙️ Environment Variables

`.env`:

| Variable | Example | Description |
|---|---|---|
| `APP_NAME` | `QueryMentor` | Application name |
| `APP_PHASE` | `development` \| `production` | Runtime phase |
| `APP_VERSION` | `0.1.0` | App version string |
| `GROQ_API_KEY` | — | **Required.** Groq API key |
| `PINECONE_API_KEY` | — | **Required.** Pinecone API key |
| `PINECONE_INDEX_NAME` | `querymentor` | Pinecone index name |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Groq model used for reasoning |
| `RATE_LIMIT_MAX` | `30` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60` | Rate limit window (seconds) |
| `PYTHON_VERSION` | `3.11.11` | Pinned Python version |

---

## 🔌 API Endpoints

Base path: `/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Deep health check (cache, retriever, LLM) |
| `POST` | `/text-to-sql` | English → SQL |
| `POST` | `/sql-to-text` | SQL → English |
| `POST` | `/simulate` | Simulate query execution |
| `POST` | `/chat` | General SQL chat (SSE stream) |
| `GET` | `/admin/cache/stats` | Cache statistics |
| `POST` | `/admin/cache/clear` | Clear all caches |
| `GET` | `/admin/llm/stats` | LLM usage stats |
| `GET` | `/admin/retriever/health` | Retriever status |
| `POST` | `/admin/ingest` | Re-ingest SQL reference PDF |

SSE event types (on `/chat`): `meta`, `status`, `token`, `done`, `error`.

---

## 📄 Example Request

```bash
curl -X POST http://localhost:8000/api/v1/text-to-sql \
  -H "Content-Type: application/json" \
  -d '{
        "query": "Show me the top 5 customers by total order value"
      }'
```

---

## ☁️ Deployment (Render)

1. Create a new **Web Service** on Render, pointing at this repo.
2. Set the **Root Directory** to `RAG`.
3. Set the **Build Command** to `uv sync`.
4. Set the **Start Command** to `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Add all required environment variables (see above), and set `PYTHON_VERSION=3.11.11` explicitly so Render provisions the correct interpreter.
6. Deploy, then hit `GET /health` to confirm cache, retriever, and LLM are all reporting healthy.

---

## 🔗 Links

| Resource | URL |
|---|---|
| Monorepo | https://github.com/Sheharyar-Sarmad/Query-Mentor |
| Client README | [../client/README.md](../client/README.md) |
| Issues | https://github.com/Sheharyar-Sarmad/Query-Mentor/issues |
| ai-zero-to-hero | https://github.com/Sheharyar-Sarmad/ai-zero-to-hero |
| Author | https://github.com/Sheharyar-Sarmad |
| LinkedIn | https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/ |