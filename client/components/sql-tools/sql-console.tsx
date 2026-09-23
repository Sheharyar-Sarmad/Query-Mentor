"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Copy,
  Loader2,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Table2,
  Trash2, // Added Trash2
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  ApiRequestError,
  Dialect,
  SimulateResponse,
  SqlToTextResponse,
} from "@/lib/types";

import { CollapsiblePanel } from "./collapsible-panel";
import { SqlEditor } from "./sql-editor";

const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
];

const DEFAULT_SQL = `SELECT
  u.email,
  COUNT(o.order_id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
GROUP BY u.email
HAVING COUNT(o.order_id) > 5;`;

type ActionMode = "simulate" | "explain" | null;

export function SqlConsole() {
  const [sql, setSql] = React.useState(DEFAULT_SQL);
  const [dialect, setDialect] = React.useState<Dialect>("postgres");
  const [loading, setLoading] = React.useState<ActionMode>(null);
  const [simulateResult, setSimulateResult] =
    React.useState<SimulateResponse | null>(null);
  const [explainResult, setExplainResult] =
    React.useState<SqlToTextResponse | null>(null);

  const run = async (mode: Exclude<ActionMode, null>) => {
    const q = sql.trim();
    if (!q) {
      toast.error("Write a SQL query first.");
      return;
    }

    setLoading(mode);
    
    // Only clear the result for the specific action being re-run
    if (mode === "simulate") setSimulateResult(null);
    else setExplainResult(null);

    try {
      if (mode === "simulate") {
        const res = await api.simulate({ sql: q, dialect });
        setSimulateResult(res);
      } else {
        const res = await api.sqlToText({ sql: q });
        setExplainResult(res);
      }
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(sql);
    toast.success("SQL copied");
  };

  const clearResults = () => {
    setSimulateResult(null);
    setExplainResult(null);
    toast.success("Results cleared");
  };

  const reset = () => {
    setSql(DEFAULT_SQL);
    clearResults();
  };

  return (
    // 1. Bulletproof root container
    <div className="w-full min-w-0 max-w-full space-y-4">
      {/* ── Console header ──────────────────────────────────── */}
      {/* Added w-full min-w-0 to prevent flex stretching */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background">
            <Table2 className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              SQL Console
            </h2>
            <p className="text-xs text-muted-foreground">
              Write a query, then Simulate or Explain it
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={dialect}
            onValueChange={(value) => setDialect(value as Dialect)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIALECTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            className="h-8 gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────── */}
      {/* 2. Wrap the editor in a constrained container. 
          If SqlEditor has its own wrapper, ensure it also has min-w-0. */}
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <SqlEditor
          value={sql}
          onChange={setSql}
          dialect={dialect}
          minHeight="200px"
          onRun={() => run("simulate")}
        />
      </div>

      {/* ── Action bar ──────────────────────────────────────── */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘/Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{" "}
          to simulate
        </span>

        <div className="flex items-center gap-2">
          {(simulateResult || explainResult) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearResults}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Results
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => run("explain")}
            disabled={loading !== null}
            className="gap-1.5"
          >
            {loading === "explain" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookOpen className="h-3.5 w-3.5" />
            )}
            Explain
          </Button>

          <Button
            size="sm"
            onClick={() => run("simulate")}
            disabled={loading !== null}
            className="gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400"
          >
            {loading === "simulate" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            Simulate
          </Button>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────── */}
      {/* 3. Both results render here simultaneously if they exist */}
      <div className="w-full min-w-0 space-y-4 pt-2">
        {simulateResult && (
          <div className="w-full min-w-0">
            <SimulateOutput result={simulateResult} />
          </div>
        )}
        {explainResult && (
          <div className="w-full min-w-0">
            <ExplainOutput result={explainResult} />
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Simulate output
// ────────────────────────────────────────────────────────────

function SimulateOutput({ result }: { result: SimulateResponse }) {
  const isSuccess = result.status === "SUCCESS";

  return (
    // Added w-full min-w-0 to the CollapsiblePanel wrapper
    <div className="w-full min-w-0">
      <CollapsiblePanel
        title={isSuccess ? "Simulation result" : "Execution error"}
        subtitle={
          isSuccess
            ? `${result.row_count_estimate ?? 0} row${
                (result.row_count_estimate ?? 0) === 1 ? "" : "s"
              } returned`
            : result.error_message ?? "Query failed"
        }
        icon={
          isSuccess ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )
        }
        variant={isSuccess ? "success" : "error"}
        actions={
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-border text-muted-foreground text-[10px]"
            >
              {result.dialect}
            </Badge>
            <Badge
              variant="outline"
              className="border-border text-muted-foreground text-[10px]"
            >
              cache: {result.cache}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {result.timings_ms.total_ms?.toFixed(0)} ms
            </span>
          </div>
        }
      >
        {isSuccess ? (
          <div className="w-full min-w-0 space-y-4">
            {result.rows && result.rows.length > 0 ? (
              // Ensure the table wrapper allows horizontal scrolling internally
              <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {result.columns?.map((c) => (
                        <th
                          key={c}
                          className="border-b border-border px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        {result.columns?.map((c) => (
                          <td
                            key={c}
                            className="px-3 py-1.5 font-mono text-xs whitespace-nowrap"
                          >
                            {row[c] === null || row[c] === undefined ? (
                              <span className="text-muted-foreground italic">
                                NULL
                              </span>
                            ) : typeof row[c] === "number" ? (
                              <span className="text-indigo-500 dark:text-indigo-400">
                                {String(row[c])}
                              </span>
                            ) : typeof row[c] === "boolean" ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                {String(row[c])}
                              </span>
                            ) : (
                              <span>{String(row[c])}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No rows returned.
              </p>
            )}

            {result.explanation && (
              <div className="w-full min-w-0">
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  What happened
                </h4>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {result.explanation}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full min-w-0 space-y-4">
            <div className="w-full min-w-0">
              <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Error
              </h4>
              <pre className="w-full overflow-x-auto rounded-lg border border-red-500/40 bg-red-500/5 p-3 font-mono text-xs text-red-600 dark:text-red-300">
                <code>{result.error_message}</code>
              </pre>
            </div>

            {result.why_it_failed && (
              <div className="w-full min-w-0">
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Why it failed
                </h4>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {result.why_it_failed}
                </p>
              </div>
            )}

            {result.suggested_fix && (
              <div className="w-full min-w-0">
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Suggested fix
                </h4>
                <pre className="w-full overflow-x-auto rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 font-mono text-xs text-emerald-600 dark:text-emerald-300">
                  <code>{result.suggested_fix}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Explain output
// ────────────────────────────────────────────────────────────

function ExplainOutput({ result }: { result: SqlToTextResponse }) {
  return (
    // Added w-full min-w-0 to the CollapsiblePanel wrapper
    <div className="w-full min-w-0">
      <CollapsiblePanel
        title="Query explanation"
        subtitle={result.summary}
        icon={<Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />}
        actions={
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-border text-muted-foreground text-[10px]"
            >
              cache: {result.cache}
            </Badge>
            {result.sources.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[10px]"
              >
                {s}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground">
              {result.timings_ms.total_ms?.toFixed(0)} ms
            </span>
          </div>
        }
      >
        <div className="w-full min-w-0 space-y-5">
          <div className="w-full min-w-0">
            <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Summary
            </h4>
            <p className="text-sm leading-relaxed text-foreground/90">
              {result.summary}
            </p>
          </div>

          {result.line_by_line.length > 0 && (
            <div className="w-full min-w-0">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Line by line
              </h4>
              <div className="w-full min-w-0 space-y-2">
                {result.line_by_line.map((l, i) => (
                  <div
                    key={i}
                    className="w-full min-w-0 rounded-lg border border-border bg-background/60 p-3"
                  >
                    {l.line && (
                      <pre className="mb-2 w-full overflow-x-auto rounded border border-border bg-muted/40 p-2 font-mono text-xs text-accent">
                        <code>{l.line}</code>
                      </pre>
                    )}
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {l.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tips.length > 0 && (
            <div className="w-full min-w-0">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tips
              </h4>
              <ul className="space-y-1.5">
                {result.tips.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-foreground/80"
                  >
                    <Zap className="mt-1 h-3 w-3 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}