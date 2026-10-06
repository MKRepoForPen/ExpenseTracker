import { CATEGORIES, type Expense } from "@/lib/types";
import type { ExportOptions, ExportSummary, SortOrder } from "./types";

const SORTERS: Record<SortOrder, (a: Expense, b: Expense) => number> = {
  "date-desc": (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  "date-asc": (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  "amount-desc": (a, b) => b.amount - a.amount,
  "amount-asc": (a, b) => a.amount - b.amount,
};

/** Apply the dialog's filters and sort. Pure, so the preview and the file always agree. */
export function selectForExport(expenses: Expense[], o: Pick<ExportOptions, "startDate" | "endDate" | "categories" | "sort">) {
  const allowed = new Set(o.categories);
  return expenses
    .filter(
      (e) =>
        allowed.has(e.category) && (!o.startDate || e.date >= o.startDate) && (!o.endDate || e.date <= o.endDate),
    )
    .sort(SORTERS[o.sort]);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(expenses: Expense[]): ExportSummary {
  let total = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  const byCat = new Map(CATEGORIES.map((c) => [c, { category: c, count: 0, total: 0 }]));

  for (const e of expenses) {
    total += e.amount;
    if (!earliest || e.date < earliest) earliest = e.date;
    if (!latest || e.date > latest) latest = e.date;
    const row = byCat.get(e.category)!;
    row.count++;
    row.total += e.amount;
  }

  return {
    count: expenses.length,
    total: round2(total),
    average: expenses.length ? round2(total / expenses.length) : 0,
    earliest,
    latest,
    byCategory: [...byCat.values()]
      .filter((r) => r.count > 0)
      .map((r) => ({ ...r, total: round2(r.total) }))
      .sort((a, b) => b.total - a.total),
  };
}

const ILLEGAL_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/;

export function validateFilename(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a file name.";
  if (trimmed.length > 100) return "Keep the name under 100 characters.";
  if (ILLEGAL_FILENAME.test(trimmed)) return 'Remove characters like < > : " / \\ | ? *';
  if (/^\.+$/.test(trimmed)) return "Enter a valid file name.";
  return null;
}
