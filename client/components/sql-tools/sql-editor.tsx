"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL, MySQL, SQLite } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type Dialect = "postgres" | "mysql" | "sqlite";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  dialect?: Dialect;
  placeholder?: string;
  minHeight?: string;
  onRun?: () => void;
  readOnly?: boolean;
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

export function SqlEditor({
  value,
  onChange,
  dialect = "postgres",
  placeholder = "SELECT * FROM users WHERE is_active = true;",
  minHeight = "180px",
  onRun,
  readOnly = false,
}: SqlEditorProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  // Ctrl/Cmd + Enter runs the query
  const runKeymap = React.useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun?.();
              return true;
            },
          },
        ]),
      ),
    [onRun],
  );

  const extensions = React.useMemo(
    () => [
      sql({
        dialect: getDialectConfig(dialect),
        upperCaseKeywords: true,
      }),
      EditorView.lineWrapping,
      runKeymap,
    ],
    [dialect, runKeymap],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background",
        "focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/40",
        "transition-colors",
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={isDark ? oneDark : "light"}
        extensions={extensions}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: 2,
        }}
        style={{
          fontSize: "14px",
          minHeight,
        }}
      />
    </div>
  );
}