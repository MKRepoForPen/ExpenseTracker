"use client";

import type { Integration, JobStatus } from "@/lib/cloud/types";

export function ServiceTile({
  integration,
  size = "md",
}: {
  integration: Pick<Integration, "monogram" | "tile">;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-7 w-7 text-[10px] rounded-lg",
    md: "h-9 w-9 text-xs rounded-xl",
    lg: "h-11 w-11 text-sm rounded-xl",
  }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold tracking-tight ${dims} ${integration.tile}`}
      aria-hidden
    >
      {integration.monogram}
    </span>
  );
}

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: "bg-slate-100 text-slate-600",
  running: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "running"
            ? "animate-pulse bg-blue-500"
            : status === "completed"
              ? "bg-emerald-500"
              : status === "failed"
                ? "bg-rose-500"
                : "bg-slate-400"
        }`}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "emerald" | "rose" }) {
  const color = { brand: "bg-brand-600", emerald: "bg-emerald-500", rose: "bg-rose-500" }[tone];
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
        checked ? "bg-brand-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
