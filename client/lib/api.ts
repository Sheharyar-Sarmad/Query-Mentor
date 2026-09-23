// ============================================================
// QueryMentor API client
// - axios for regular requests
// - fetch for SSE streaming (axios doesn't support it in browser)
// ============================================================

import axios, { AxiosError } from "axios";

import {
  ApiRequestError,
  ChatRequest,
  ChatResponse,
  HealthResponse,
  SimulateRequest,
  SimulateResponse,
  SqlToTextRequest,
  SqlToTextResponse,
  TextToSqlRequest,
  TextToSqlResponse,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL;

// ────────────────────────────────────────────────────────────
// axios instance
// ────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 90_000,
  headers: { "Content-Type": "application/json" },
});

// Normalize errors so every caller gets the same shape
client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const requestId =
      err.response?.headers?.["x-request-id"] ?? undefined;

    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;

    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => (d as { msg: string }).msg).join("; ")
          : err.message || "Request failed";

    return Promise.reject(new ApiRequestError(message, status, requestId));
  },
);

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export const api = {
  health: async (): Promise<HealthResponse> => {
    const res = await axios.get<HealthResponse>(
      `${BASE_URL.replace("/api/v1", "")}/health`,
      { timeout: 15_000 },
    );
    return res.data;
  },

  textToSql: async (body: TextToSqlRequest): Promise<TextToSqlResponse> => {
    const res = await client.post<TextToSqlResponse>("/text-to-sql", body);
    return res.data;
  },

  sqlToText: async (body: SqlToTextRequest): Promise<SqlToTextResponse> => {
    const res = await client.post<SqlToTextResponse>("/sql-to-text", body);
    return res.data;
  },

  simulate: async (body: SimulateRequest): Promise<SimulateResponse> => {
    const res = await client.post<SimulateResponse>("/simulate", body);
    return res.data;
  },

  chat: async (body: ChatRequest): Promise<ChatResponse> => {
    const res = await client.post<ChatResponse>("/chat", body);
    return res.data;
  },
};

// ────────────────────────────────────────────────────────────
// SSE streaming (uses fetch — axios can't stream in browsers)
// ────────────────────────────────────────────────────────────

export interface StreamHandlers {
  onMeta?: (data: { request_id: string; dialect?: string }) => void;
  onStatus?: (status: string) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: unknown) => void;
  onError?: (detail: string) => void;
  signal?: AbortSignal;
}

export async function streamPost<TBody>(
  path: string,
  body: TBody,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(`Stream failed with status ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      let eventName = "message";
      let dataStr = "";

      for (const line of raw.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr += line.slice(6);
      }

      if (!dataStr) continue;

      try {
        const parsed = JSON.parse(dataStr);
        switch (eventName) {
          case "meta":
            handlers.onMeta?.(parsed);
            break;
          case "status":
            handlers.onStatus?.(
              typeof parsed === "string" ? parsed : parsed.status,
            );
            break;
          case "token":
            handlers.onToken?.(
              typeof parsed === "string" ? parsed : parsed.text ?? "",
            );
            break;
          case "done":
            handlers.onDone?.(parsed);
            break;
          case "error":
            handlers.onError?.(parsed.detail ?? "unknown error");
            break;
        }
      } catch {
        /* skip malformed */
      }
    }
  }
}