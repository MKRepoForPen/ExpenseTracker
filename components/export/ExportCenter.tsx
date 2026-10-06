"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { Spinner } from "@/components/ExpenseForm";
import { CategoryBadge } from "@/components/ExpenseList";
import { useExpenses } from "@/components/ExpensesProvider";
import { useToast } from "@/components/ToastProvider";
import { EXPORT_FORMATS, EXPORT_FORMAT_LIST } from "@/lib/export/formats";
import { formatBytes, runExport, type ExportPhase, type ExportResult } from "@/lib/export/run";
import { selectForExport, summarize, validateFilename } from "@/lib/export/select";
import type { ExportFormatId, SortOrder } from "@/lib/export/types";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { CATEGORIES, CATEGORY_STYLES, type Expense } from "@/lib/types";
import { DATE_PRESETS, savePrefs, useExportState, type ExportSeed } from "./useExportState";

// --- Provider ---------------------------------------------------------------

interface ExportCenterValue {
  openExport: (seed?: ExportSeed) => void;
}

const ExportCenterContext = createContext<ExportCenterValue | null>(null);

export function ExportCenterProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ id: number; seed?: ExportSeed } | null>(null);
  const nextId = useRef(1);

  const openExport = useCallback((seed?: ExportSeed) => setSession({ id: nextId.current++, seed }), []);
  const close = useCallback(() => setSession(null), []);

  return (
    <ExportCenterContext.Provider value={{ openExport }}>
      {children}
      {/* Keyed per opening so each session starts from fresh (seeded) state. */}
      {session && <ExportPanel key={session.id} seed={session.seed} onClose={close} />}
    </ExportCenterContext.Provider>
  );
}

export function useExportCenter(): ExportCenterValue {
  const ctx = useContext(ExportCenterContext);
  if (!ctx) throw new Error("useExportCenter must be used within ExportCenterProvider");
  return ctx;
}

// --- Panel ------------------------------------------------------------------

type Status =
  | { kind: "idle" }
  | { kind: "running"; phase: ExportPhase }
  | { kind: "done"; result: ExportResult }
  | { kind: "error"; message: string };

const PHASE_LABEL: Record<ExportPhase, string> = {
  preparing: "Preparing data…",
  generating: "Generating file…",
  saving: "Starting download…",
};

const SORT_LABEL: Record<SortOrder, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Largest amount first",
  "amount-asc": "Smallest amount first",
};

const PREVIEW_ROWS = 8;

function ExportPanel({ seed, onClose }: { seed?: ExportSeed; onClose: () => void }) {
  const { expenses } = useExpenses();
  const { toast } = useToast();
  const [state, dispatch] = useExportState(seed);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [filenameTouched, setFilenameTouched] = useState(false);

  const selected = useMemo(() => selectForExport(expenses, state), [expenses, state]);
  const summary = useMemo(() => summarize(selected), [selected]);

  // Per-category counts within the date range, so chips show what each toggle adds.
  const categoryCounts = useMemo(() => {
    const inRange = selectForExport(expenses, { ...state, categories: [...CATEGORIES] });
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
    for (const e of inRange) counts[e.category]++;
    return counts;
  }, [expenses, state]);

  const format = EXPORT_FORMATS[state.format];
  const filenameError = validateFilename(state.filename);
  const rangeError =
    state.startDate && state.endDate && state.startDate > state.endDate ? "Start date is after end date." : null;
  const blocker = filenameError ?? rangeError ?? (selected.length === 0 ? "No expenses match these filters." : null);
  const running = status.kind === "running";

  const handleExport = useCallback(async () => {
    setFilenameTouched(true);
    if (blocker || running) return;
    savePrefs(state);
    try {
      // Hold the progress UI briefly so fast exports don't just flicker.
      const [result] = await Promise.all([
        runExport(expenses, state, (phase) => setStatus({ kind: "running", phase })),
        new Promise((r) => setTimeout(r, 450)),
      ]);
      setStatus({ kind: "done", result });
      toast(`Exported ${result.count} record${result.count === 1 ? "" : "s"} to ${result.filename}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed.";
      setStatus({ kind: "error", message });
      toast(message, "error");
    }
  }, [blocker, running, state, expenses, toast]);

  // Ctrl/Cmd + Enter exports from anywhere in the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && status.kind !== "done") {
        e.preventDefault();
        handleExport();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleExport, status.kind]);

  const footer = (
    <ExportFooter
      status={status}
      count={summary.count}
      total={summary.total}
      formatLabel={format.label}
      blocker={blocker}
      onExport={handleExport}
      onClose={onClose}
      onAgain={() => setStatus({ kind: "idle" })}
    />
  );

  return (
    <Drawer
      open
      onClose={onClose}
      locked={running}
      title="Export expenses"
      description="Choose a format, narrow the data, and review before downloading."
      footer={footer}
    >
      {status.kind === "done" ? (
        <SuccessState result={status.result} />
      ) : (
        <div className="space-y-7">
          <fieldset disabled={running} className="space-y-7 disabled:opacity-60">
            <Section step={1} title="Format">
              <div role="radiogroup" aria-label="Export format" className="grid gap-2 sm:grid-cols-3">
                {EXPORT_FORMAT_LIST.map((f) => (
                  <FormatCard
                    key={f.id}
                    id={f.id}
                    label={f.label}
                    description={f.description}
                    selected={state.format === f.id}
                    onSelect={() => dispatch({ type: "format", format: f.id })}
                  />
                ))}
              </div>
            </Section>

            <Section step={2} title="Date range">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((p) => {
                  const [s, e] = p.range();
                  const active = state.startDate === s && state.endDate === e;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => dispatch({ type: "range", startDate: s, endDate: e })}
                      className={`chip ${active ? "chip-active" : ""}`}
                      aria-pressed={active}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Start date</span>
                  <input
                    type="date"
                    value={state.startDate}
                    max={state.endDate || todayISO()}
                    onChange={(e) => dispatch({ type: "range", startDate: e.target.value, endDate: state.endDate })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">End date</span>
                  <input
                    type="date"
                    value={state.endDate}
                    min={state.startDate || undefined}
                    onChange={(e) => dispatch({ type: "range", startDate: state.startDate, endDate: e.target.value })}
                    className="input"
                  />
                </label>
              </div>
              {rangeError && <p className="mt-2 text-sm text-rose-600">{rangeError}</p>}
            </Section>

            <Section
              step={3}
              title="Categories"
              aside={
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "setCategories", categories: [...CATEGORIES] })}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "setCategories", categories: [] })}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const checked = state.categories.includes(c);
                  return (
                    <label
                      key={c}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                        checked ? "border-brand-500 bg-brand-50/60" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => dispatch({ type: "toggleCategory", category: c })}
                        className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                      />
                      <span aria-hidden>{CATEGORY_STYLES[c].icon}</span>
                      <span className="flex-1 font-medium text-slate-700">{c}</span>
                      <span className="tabular-nums text-xs text-slate-400">{categoryCounts[c]}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section step={4} title="File">
              <div className="grid gap-3 sm:grid-cols-5">
                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-500">File name</span>
                  <div className="flex">
                    <input
                      type="text"
                      value={state.filename}
                      spellCheck={false}
                      onChange={(e) => dispatch({ type: "filename", filename: e.target.value })}
                      onBlur={() => setFilenameTouched(true)}
                      aria-invalid={!!(filenameTouched && filenameError)}
                      className={`input rounded-r-none ${filenameTouched && filenameError ? "border-rose-400" : ""}`}
                    />
                    <span className="inline-flex items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                      .{format.extension}
                    </span>
                  </div>
                  {filenameTouched && filenameError && <p className="mt-1.5 text-sm text-rose-600">{filenameError}</p>}
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Sort rows</span>
                  <select
                    value={state.sort}
                    onChange={(e) => dispatch({ type: "sort", sort: e.target.value as SortOrder })}
                    className="input"
                  >
                    {Object.entries(SORT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Section>
          </fieldset>

          <Section step={5} title="Review">
            <SummaryStrip
              count={summary.count}
              total={summary.total}
              earliest={summary.earliest}
              latest={summary.latest}
            />
            <Preview expenses={selected} formatId={state.format} />
          </Section>
        </div>
      )}
    </Drawer>
  );
}

// --- Pieces -----------------------------------------------------------------

function Section({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            {step}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const FORMAT_ICON: Record<ExportFormatId, React.ReactNode> = {
  csv: <path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16" />,
  json: <path d="M8 4c-2 0-2 2-2 4s-2 4-2 4 2 0 2 4 0 4 2 4M16 4c2 0 2 2 2 4s2 4 2 4-2 0-2 4 0 4-2 4" />,
  pdf: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />,
};

function FormatCard({
  id,
  label,
  description,
  selected,
  onSelect,
}: {
  id: ExportFormatId;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative flex items-start gap-3 rounded-xl border p-3 text-left transition sm:flex-col sm:gap-0 sm:p-3.5 ${
        selected
          ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:mb-2 ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden
        >
          {FORMAT_ICON[id]}
        </svg>
      </span>
      <span className="pr-6 sm:pr-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span>
      </span>
      {selected && (
        <span
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white"
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

function SummaryStrip({
  count,
  total,
  earliest,
  latest,
}: {
  count: number;
  total: number;
  earliest: string | null;
  latest: string | null;
}) {
  const items = [
    { label: "Records", value: count.toLocaleString() },
    { label: "Total", value: formatCurrency(total) },
    { label: "Date span", value: earliest && latest ? `${formatDate(earliest)} – ${formatDate(latest)}` : "—" },
  ];
  return (
    <dl className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
      {items.map((i, idx) => (
        <div key={i.label} className={`bg-white px-4 py-3 ${idx === 2 ? "col-span-2 sm:col-span-1" : ""}`}>
          <dt className="text-xs font-medium text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900" aria-live="polite">
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Preview({ expenses, formatId }: { expenses: Expense[]; formatId: ExportFormatId }) {
  const [view, setView] = useState<"table" | "raw">("table");
  const canRaw = formatId !== "pdf";
  const activeView = canRaw ? view : "table";
  const raw = useRawPreview(expenses, formatId, activeView === "raw");

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
        Nothing to export. Widen the date range or select more categories.
      </div>
    );
  }

  const rows = expenses.slice(0, PREVIEW_ROWS);
  const more = expenses.length - rows.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-medium text-slate-500">
          Preview · first {rows.length} of {expenses.length}
        </span>
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-medium" role="tablist">
          {(["table", "raw"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={activeView === v}
              disabled={v === "raw" && !canRaw}
              title={v === "raw" && !canRaw ? "Raw preview isn't available for PDF" : undefined}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                activeView === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "table" ? "Table" : "Raw"}
            </button>
          ))}
        </div>
      </div>

      {activeView === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">
                    <CategoryBadge category={e.category} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-slate-700">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {more > 0 && (
            <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-center text-xs text-slate-500">
              + {more.toLocaleString()} more record{more === 1 ? "" : "s"} in the export
            </p>
          )}
        </div>
      ) : (
        <pre className="max-h-72 overflow-auto bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
          {raw ?? "Rendering…"}
        </pre>
      )}
    </div>
  );
}

/** Renders the real formatter's output for a few rows, so "Raw" shows exactly what the file contains. */
function useRawPreview(expenses: Expense[], formatId: ExportFormatId, enabled: boolean): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || formatId === "pdf") return;
    let cancelled = false;
    const sample = expenses.slice(0, 4);
    EXPORT_FORMATS[formatId]
      .build({
        expenses: sample,
        summary: summarize(sample),
        options: {
          format: formatId,
          startDate: "",
          endDate: "",
          categories: [...CATEGORIES],
          sort: "date-desc",
          filename: "",
        },
        generatedAt: new Date(),
      })
      .then((b) => b.text())
      .then((t) => {
        if (cancelled) return;
        const clean = t.replace(/^﻿/, "");
        setText(expenses.length > sample.length ? `${clean}\n… ${expenses.length - sample.length} more` : clean);
      });
    return () => {
      cancelled = true;
    };
  }, [expenses, formatId, enabled]);
  return enabled ? text : null;
}

function ExportFooter({
  status,
  count,
  total,
  formatLabel,
  blocker,
  onExport,
  onClose,
  onAgain,
}: {
  status: Status;
  count: number;
  total: number;
  formatLabel: string;
  blocker: string | null;
  onExport: () => void;
  onClose: () => void;
  onAgain: () => void;
}) {
  if (status.kind === "done") {
    return (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onAgain} className="btn-secondary">
          Export another
        </button>
        <button type="button" onClick={onClose} className="btn-primary">
          Done
        </button>
      </div>
    );
  }

  const running = status.kind === "running";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm" aria-live="polite">
        {running ? (
          <span className="font-medium text-brand-700">{PHASE_LABEL[status.phase]}</span>
        ) : status.kind === "error" ? (
          <span className="text-rose-600">{status.message}</span>
        ) : blocker ? (
          <span className="text-amber-700">{blocker}</span>
        ) : (
          <span className="text-slate-600">
            <strong className="font-semibold text-slate-900">{count.toLocaleString()}</strong> record
            {count === 1 ? "" : "s"} ·{" "}
            <strong className="font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</strong>
          </span>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={onClose} disabled={running} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={running || !!blocker}
          className="btn-primary min-w-[10rem]"
          title="Ctrl/⌘ + Enter"
        >
          {running ? (
            <>
              <Spinner /> Exporting…
            </>
          ) : (
            <>
              Export {formatLabel}
              <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">
                Ctrl ↵
              </kbd>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SuccessState({ result }: { result: ExportResult }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
        aria-hidden
      >
        ✓
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Export complete</h3>
      <p className="mt-1 text-sm text-slate-500">Your download should start automatically.</p>
      <dl className="mt-6 w-full max-w-sm divide-y divide-slate-100 rounded-xl border border-slate-200 text-left text-sm">
        {[
          ["File", result.filename],
          ["Records", result.count.toLocaleString()],
          ["Size", formatBytes(result.bytes)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
