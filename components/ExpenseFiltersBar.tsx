"use client";

import { CATEGORIES, EMPTY_FILTERS, type ExpenseFilters } from "@/lib/types";
import { toISODate, todayISO } from "@/lib/format";

interface Props {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "This month",
    range: () => {
      const n = new Date();
      return [toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), todayISO()];
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const n = new Date();
      return [toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), todayISO()];
    },
  },
  {
    label: "This year",
    range: () => [toISODate(new Date(new Date().getFullYear(), 0, 1)), todayISO()],
  },
];

export function ExpenseFiltersBar({ filters, onChange }: Props) {
  const set = <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) => onChange({ ...filters, [key]: value });
  const isActive =
    filters.search !== "" || filters.category !== "All" || filters.startDate !== "" || filters.endDate !== "";
  const rangeInvalid = filters.startDate && filters.endDate && filters.startDate > filters.endDate;

  return (
    <div className="card space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            aria-label="Search expenses"
            placeholder="Search descriptions…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) => set("category", e.target.value as ExpenseFilters["category"])}
          className="input md:col-span-3"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2 md:col-span-4">
          <input
            type="date"
            aria-label="Start date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => set("startDate", e.target.value)}
            className="input"
          />
          <input
            type="date"
            aria-label="End date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => set("endDate", e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const [start, end] = p.range();
          const selected = filters.startDate === start && filters.endDate === end;
          return (
            <button
              key={p.label}
              onClick={() => onChange({ ...filters, startDate: start, endDate: end })}
              className={`chip ${selected ? "chip-active" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        {isActive && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="ml-auto text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear filters
          </button>
        )}
      </div>
      {rangeInvalid && <p className="text-sm text-rose-600">Start date is after end date — no expenses will match.</p>}
    </div>
  );
}
