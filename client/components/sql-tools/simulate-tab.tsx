"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ApiRequestError, Dialect, SimulateResponse } from "@/lib/types";

const EXAMPLE = "SELECT status, COUNT(*) AS n FROM orders GROUP BY status;";

export function SimulateTab() {
  const [sql, setSql] = useState("");
  const [dialect] = useState<Dialect>("postgres");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulateResponse | null>(null);

  const run = async () => {
    const q = sql.trim();
    if (!q) {
      toast.error("Enter a SQL query first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await api.simulate({ sql: q, dialect });
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = result?.status === "SUCCESS";

  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="space-y-4 p-5">
          <label className="text-sm font-medium text-slate-300">
            Simulate a query
          </label>

          <Textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={EXAMPLE}
            rows={5}
            className="resize-none font-mono text-sm bg-slate-950/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
          />

          <div className="flex justify-between">
            <button
              onClick={() => setSql(EXAMPLE)}
              className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              Try example
            </button>

            <Button
              onClick={run}
              disabled={loading}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating…
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Simulate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            isSuccess
              ? "border-emerald-900/60 bg-emerald-950/10"
              : "border-red-900/60 bg-red-950/10"
          }
        >
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {isSuccess ? (
                <Badge className="border-emerald-800 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> SUCCESS
                </Badge>
              ) : (
                <Badge className="border-red-800 bg-red-500/10 text-red-300">
                  <AlertTriangle className="mr-1 h-3 w-3" /> ERROR
                </Badge>
              )}
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                simulated
              </Badge>
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                cache: {result.cache}
              </Badge>
              <span className="ml-auto text-xs text-slate-500">
                {result.timings_ms.total_ms?.toFixed(0)} ms
              </span>
            </div>

            {isSuccess && result.rows && result.rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-slate-400">
                    <tr>
                      {result.columns?.map((c) => (
                        <th
                          key={c}
                          className="px-3 py-2 text-left font-medium"
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
                        className="border-t border-slate-800 text-slate-200"
                      >
                        {result.columns?.map((c) => (
                          <td key={c} className="px-3 py-2">
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isSuccess && result.explanation && (
              <p className="text-sm leading-relaxed text-slate-400">
                {result.explanation}
              </p>
            )}

            {!isSuccess && (
              <div className="space-y-3">
                <div>
                  <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                    Error
                  </h3>
                  <pre className="overflow-x-auto rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-200">
                    <code>{result.error_message}</code>
                  </pre>
                </div>

                {result.why_it_failed && (
                  <div>
                    <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                      Why it failed
                    </h3>
                    <p className="text-sm text-slate-400">
                      {result.why_it_failed}
                    </p>
                  </div>
                )}

                {result.suggested_fix && (
                  <div>
                    <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                      Suggested fix
                    </h3>
                    <pre className="overflow-x-auto rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200">
                      <code>{result.suggested_fix}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}