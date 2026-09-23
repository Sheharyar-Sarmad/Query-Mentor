"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL, MySQL, SQLite } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { format } from "sql-formatter";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Dialect = "postgres" | "mysql" | "sqlite";

interface SqlBlockProps {
  sql: string;
  dialect?: Dialect;
  className?: string;
  showLineNumbers?: boolean;
}

function getDialectConfig(dialect: Dialect) {
  switch (dialect) {
    case "mysql":
      return MySQL;
    case "sqlite":
      return SQLite;
    default:
      return PostgreSQL;
  }
}

function prettySql(raw: string, dialect: Dialect): string {
  try {
    return format(raw, {
      language:
        dialect === "mysql"
          ? "mysql"
          : dialect === "sqlite"
            ? "sqlite"
            : "postgresql",
      keywordCase: "upper",
      indentStyle: "standard",
      tabWidth: 2,
    });
  } catch {
    // If formatting fails, fall back to the raw SQL
    return raw.trim();
  }
}

export function SqlBlock({
  sql: rawSql,
  dialect = "postgres",
  className,
  showLineNumbers = true,
}: SqlBlockProps) {
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  const formatted = React.useMemo(
    () => prettySql(rawSql, dialect),
    [rawSql, dialect],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const extensions = React.useMemo(
    () => [
      sql({ dialect: getDialectConfig(dialect), upperCaseKeywords: true }),
      EditorView.lineWrapping,
      EditorView.editable.of(false), // read-only
      EditorView.theme({
        "&": {
          fontSize: "13px",
          backgroundColor: "transparent",
        },
        ".cm-content": {
          fontFamily:
            "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: "12px 0",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid hsl(var(--border))",
          paddingRight: "6px",
        },
        ".cm-activeLine": { backgroundColor: "transparent" },
        ".cm-activeLineGutter": { backgroundColor: "transparent" },
        ".cm-cursor": { display: "none" },
      }),
    ],
    [dialect],
  );

  return (
    <div
      className={cn(
        "group relative w-full min-w-0 overflow-hidden rounded-lg border border-border bg-background/60",
        className,
      )}
    >
      {/* Copy button — floats over the top-right, out of the text flow */}
      <div className="absolute right-2 top-2 z-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-7 gap-1 bg-background/80 text-xs text-muted-foreground backdrop-blur hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </Button>
      </div>

      <CodeMirror
        value={formatted}
        theme={isDark ? oneDark : "light"}
        extensions={extensions}
        editable={false}
        readOnly
        basicSetup={{
          lineNumbers: showLineNumbers,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
          indentOnInput: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
        }}
      />
    </div>
  );
}