"use client";

import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ApiRequestError, SqlToTextResponse } from "@/lib/types";

const EXAMPLE = `SELECT u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
GROUP BY u.email
HAVING COUNT(o.id) > 5;`;

export function ExplainTab() {
  const [sql, setSql] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SqlToTextResponse | null>(null);

  const run = async () => {
    const q = sql.trim();
    if (!q) {
      toast.error("Paste a SQL query first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await api.sqlToText({ sql: q });
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="space-y-4 p-5">
          <label className="text-sm font-medium text-slate-300">
            Paste SQL to explain
          </label>

          <Textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={EXAMPLE}
            rows={8}
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
              className="bg-emerald-500 hover:bg-emerald-400"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Explaining…
                </>
              ) : (
                <>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Explain SQL
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                cache: {result.cache}
              </Badge>
              {result.sources.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="border-emerald-800 bg-emerald-500/10 text-emerald-300"
                >
                  source: {s}
                </Badge>
              ))}
              <span className="ml-auto text-xs text-slate-500">
                {result.timings_ms.total_ms?.toFixed(0)} ms
              </span>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-300">
                Summary
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                {result.summary}
              </p>
            </div>

            {result.line_by_line.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-300">
                  Line by line
                </h3>
                <div className="space-y-3">
                  {result.line_by_line.map((l, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <pre className="overflow-x-auto text-xs text-slate-200">
                        <code>{l.line}</code>
                      </pre>
                      <p className="mt-2 text-sm text-slate-400">
                        {l.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.tips.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-300">
                  Tips
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-400">
                  {result.tips.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-400" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}