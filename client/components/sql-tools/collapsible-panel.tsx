"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning";
}

const variantClasses = {
  default: "border-border",
  success: "border-emerald-500/40",
  error: "border-red-500/40",
  warning: "border-amber-500/40",
};

export function CollapsiblePanel({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  actions,
  children,
  variant = "default",
}: CollapsiblePanelProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card/40 backdrop-blur",
        variantClasses[variant],
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          "cursor-pointer select-none",
          "hover:bg-muted/40 transition-colors",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          {icon}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            {subtitle && (
              <div className="truncate text-xs text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-border p-4">{children}</div>
      )}
    </div>
  );
}