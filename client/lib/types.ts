// ============================================================
// Types matching the backend Pydantic models
// ============================================================

export type Dialect = "postgres" | "mysql" | "sqlite";
export type CacheSource = "L1" | "L2" | "L3" | "miss";

export interface TimingsMs {
  cache_ms?: number;
  retrieve_ms?: number;
  llm_ms?: number;
  total_ms?: number;
}

export interface TextToSqlRequest {
  question: string;
  dialect: Dialect;
}

export interface TextToSqlResponse {
  sql: string;
  explanation: string;
  sources: string[];
  dialect: Dialect;
  cache: CacheSource;
  request_id: string;
  timings_ms: TimingsMs;
}

export interface SqlToTextRequest {
  sql: string;
}

export interface LineExplanation {
  line: string;
  explanation: string;
}

export interface SqlToTextResponse {
  summary: string;
  line_by_line: LineExplanation[];
  tips: string[];
  sources: string[];
  cache: CacheSource;
  request_id: string;
  timings_ms: TimingsMs;
}

export interface SimulateRequest {
  sql: string;
  dialect: Dialect;
}

export interface SimulateResponse {
  status: "SUCCESS" | "ERROR";
  simulated: boolean;
  columns?: string[] | null;
  rows?: Record<string, unknown>[] | null;
  row_count_estimate?: number | null;
  explanation?: string | null;
  error_message?: string | null;
  why_it_failed?: string | null;
  suggested_fix?: string | null;
  dialect: Dialect;
  cache: CacheSource;
  request_id: string;
  timings_ms: TimingsMs;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
  cache: CacheSource;
  request_id: string;
  timings_ms: TimingsMs;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  phase: string;
  checks: {
    cache: { status: string; l1_size?: number; l2_entries?: number; l3_entries?: number };
    retriever: { status: string; vector_count?: number; namespace_count?: number };
    llm: { status: string; model?: string; calls?: number; errors?: number };
  };
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc: (string | number)[] }>;
  request_id?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}