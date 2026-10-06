"use client";

import { useReducer } from "react";
import { toISODate, todayISO } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/types";
import type { ExportFormatId, ExportOptions, SortOrder } from "@/lib/export/types";

export interface ExportSeed {
  startDate?: string;
  endDate?: string;
  categories?: Category[];
}

interface State extends ExportOptions {
  /** Once the user types a name we stop auto-suggesting one from the date range. */
  filenameEdited: boolean;
}

type Action =
  | { type: "format"; format: ExportFormatId }
  | { type: "range"; startDate: string; endDate: string }
  | { type: "toggleCategory"; category: Category }
  | { type: "setCategories"; categories: Category[] }
  | { type: "sort"; sort: SortOrder }
  | { type: "filename"; filename: string }
  | { type: "reset"; seed?: ExportSeed };

const PREFS_KEY = "expense-tracker:export-prefs:v1";

function suggestFilename(startDate: string, endDate: string): string {
  if (startDate && endDate) return `expenses_${startDate}_to_${endDate}`;
  if (startDate) return `expenses_since_${startDate}`;
  if (endDate) return `expenses_through_${endDate}`;
  return `expenses_${todayISO()}`;
}

function loadPrefs(): Pick<ExportOptions, "format" | "sort"> {
  const fallback = { format: "csv" as const, sort: "date-desc" as const };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      format: ["csv", "json", "pdf"].includes(p.format) ? p.format : fallback.format,
      sort: ["date-desc", "date-asc", "amount-desc", "amount-asc"].includes(p.sort) ? p.sort : fallback.sort,
    };
  } catch {
    return fallback;
  }
}

export function savePrefs(o: Pick<ExportOptions, "format" | "sort">) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ format: o.format, sort: o.sort }));
  } catch {
    /* preferences are a convenience only */
  }
}

function init(seed?: ExportSeed): State {
  const startDate = seed?.startDate ?? "";
  const endDate = seed?.endDate ?? "";
  return {
    ...loadPrefs(),
    startDate,
    endDate,
    categories: seed?.categories?.length ? seed.categories : [...CATEGORIES],
    filename: suggestFilename(startDate, endDate),
    filenameEdited: false,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "format":
      return { ...state, format: action.format };
    case "range": {
      const next = { ...state, startDate: action.startDate, endDate: action.endDate };
      return state.filenameEdited ? next : { ...next, filename: suggestFilename(action.startDate, action.endDate) };
    }
    case "toggleCategory": {
      const has = state.categories.includes(action.category);
      const categories = has
        ? state.categories.filter((c) => c !== action.category)
        : CATEGORIES.filter((c) => c === action.category || state.categories.includes(c));
      return { ...state, categories };
    }
    case "setCategories":
      return { ...state, categories: action.categories };
    case "sort":
      return { ...state, sort: action.sort };
    case "filename":
      return { ...state, filename: action.filename, filenameEdited: true };
    case "reset":
      return init(action.seed);
  }
}

export function useExportState(seed?: ExportSeed) {
  return useReducer(reducer, seed, init);
}

export const DATE_PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: "all", label: "All time", range: () => ["", ""] },
  {
    id: "this-month",
    label: "This month",
    range: () => {
      const n = new Date();
      return [toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), todayISO()];
    },
  },
  {
    id: "last-month",
    label: "Last month",
    range: () => {
      const n = new Date();
      return [toISODate(new Date(n.getFullYear(), n.getMonth() - 1, 1)), toISODate(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
  {
    id: "90-days",
    label: "Last 90 days",
    range: () => {
      const n = new Date();
      return [toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 89)), todayISO()];
    },
  },
  {
    id: "ytd",
    label: "Year to date",
    range: () => [toISODate(new Date(new Date().getFullYear(), 0, 1)), todayISO()],
  },
];
