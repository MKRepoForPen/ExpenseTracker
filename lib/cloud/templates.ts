import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import { formatMonthKey, monthKey, toISODate } from "@/lib/format";
import type { ExportTemplate, GeneratedFile, TemplateId } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => round2(n).toFixed(2);

function csvCell(value: string | number): string {
  const s = String(value);
  if (typeof value === "number") return s;
  // Neutralize spreadsheet formula injection (leaving signed numbers like "+12%" intact), then quote.
  const numeric = /^[+-]?\d+(\.\d+)?%?$/.test(s);
  const safe = !numeric && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function file(name: string, rows: (string | number)[][], records: number): GeneratedFile {
  return { name, mimeType: "text/csv;charset=utf-8", content: csv(rows), records };
}

/** Last `n` month keys ending with the current month, oldest first. */
function lastMonths(n: number, now: Date): string[] {
  return Array.from({ length: n }, (_, i) =>
    monthKey(toISODate(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1))),
  );
}

// Bills and transportation are the commonly deductible groups for the self-employed;
// everything else is listed as personal. This is a bookkeeping aid, not tax advice.
const TAX_GROUP: Record<Category, string> = {
  Bills: "Utilities & Services",
  Transportation: "Travel & Vehicle",
  Food: "Meals (review)",
  Shopping: "Supplies (review)",
  Entertainment: "Personal",
  Other: "Uncategorized",
};

const taxReport: ExportTemplate = {
  id: "tax-report",
  name: "Tax Report",
  tagline: "Year-end, accountant-ready",
  description: "Every transaction for the tax year with a tax grouping column and subtotals per group.",
  icon: "🧾",
  accent: "from-emerald-500 to-teal-600",
  formatLabel: "CSV",
  columns: ["Date", "Tax group", "Category", "Description", "Amount"],
  periods: [
    { id: "this-year", label: "This tax year" },
    { id: "last-year", label: "Last tax year" },
  ],
  generate(expenses, periodId, now = new Date()) {
    const year = now.getFullYear() - (periodId === "last-year" ? 1 : 0);
    const rows = expenses.filter((e) => e.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
    const groups = new Map<string, number>();
    for (const e of rows) groups.set(TAX_GROUP[e.category], (groups.get(TAX_GROUP[e.category]) ?? 0) + e.amount);
    const total = rows.reduce((s, e) => s + e.amount, 0);
    return file(
      `tax-report-${year}.csv`,
      [
        ["Date", "Tax group", "Category", "Description", "Amount"],
        ...rows.map((e) => [e.date, TAX_GROUP[e.category], e.category, e.description, money(e.amount)]),
        [],
        ["Subtotals by tax group"],
        ...[...groups.entries()].sort((a, b) => b[1] - a[1]).map(([g, t]) => ["", g, "", "", money(t)]),
        ["", "TOTAL", "", "", money(total)],
      ],
      rows.length,
    );
  },
};

const monthlySummary: ExportTemplate = {
  id: "monthly-summary",
  name: "Monthly Summary",
  tagline: "Month × category pivot",
  description: "One row per month, one column per category, with monthly totals. Perfect for budgeting sheets.",
  icon: "📅",
  accent: "from-blue-500 to-indigo-600",
  formatLabel: "CSV",
  columns: ["Month", ...CATEGORIES, "Total"],
  periods: [
    { id: "6", label: "Last 6 months" },
    { id: "12", label: "Last 12 months" },
  ],
  generate(expenses, periodId, now = new Date()) {
    const keys = lastMonths(Number(periodId) || 6, now);
    const grid = new Map(keys.map((k) => [k, new Map<Category, number>()]));
    let records = 0;
    for (const e of expenses) {
      const row = grid.get(monthKey(e.date));
      if (!row) continue;
      row.set(e.category, (row.get(e.category) ?? 0) + e.amount);
      records++;
    }
    const body = keys.map((k) => {
      const row = grid.get(k)!;
      const values = CATEGORIES.map((c) => row.get(c) ?? 0);
      return [formatMonthKey(k), ...values.map(money), money(values.reduce((a, b) => a + b, 0))];
    });
    const colTotals = CATEGORIES.map((c) => keys.reduce((s, k) => s + (grid.get(k)!.get(c) ?? 0), 0));
    return file(
      `monthly-summary-${keys[0]}-to-${keys[keys.length - 1]}.csv`,
      [
        ["Month", ...CATEGORIES, "Total"],
        ...body,
        ["Total", ...colTotals.map(money), money(colTotals.reduce((a, b) => a + b, 0))],
      ],
      records,
    );
  },
};

const categoryAnalysis: ExportTemplate = {
  id: "category-analysis",
  name: "Category Analysis",
  tagline: "Where the money goes",
  description: "Per-category totals, share, averages, largest purchase and a 3-month trend versus the prior 3 months.",
  icon: "📊",
  accent: "from-fuchsia-500 to-purple-600",
  formatLabel: "CSV",
  columns: ["Category", "Transactions", "Total", "Share", "Average", "Largest", "3-mo trend"],
  periods: [
    { id: "all", label: "All time" },
    { id: "90", label: "Last 90 days" },
  ],
  generate(expenses, periodId, now = new Date()) {
    const since = periodId === "90" ? toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)) : "";
    const scoped = expenses.filter((e) => e.date >= since);
    const total = scoped.reduce((s, e) => s + e.amount, 0);
    const recentStart = toISODate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
    const priorStart = toISODate(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));

    const rows = CATEGORIES.map((c) => {
      const items = scoped.filter((e) => e.category === c);
      const sum = items.reduce((s, e) => s + e.amount, 0);
      const recent = expenses
        .filter((e) => e.category === c && e.date >= recentStart)
        .reduce((s, e) => s + e.amount, 0);
      const prior = expenses
        .filter((e) => e.category === c && e.date >= priorStart && e.date < recentStart)
        .reduce((s, e) => s + e.amount, 0);
      const trend =
        prior > 0 ? `${recent >= prior ? "+" : ""}${(((recent - prior) / prior) * 100).toFixed(0)}%` : "n/a";
      return {
        sum,
        cells: [
          c,
          items.length,
          money(sum),
          total > 0 ? `${((sum / total) * 100).toFixed(1)}%` : "0%",
          items.length ? money(sum / items.length) : "0.00",
          items.length ? money(Math.max(...items.map((e) => e.amount))) : "0.00",
          trend,
        ] as (string | number)[],
      };
    }).sort((a, b) => b.sum - a.sum);

    return file(
      `category-analysis-${toISODate(now)}.csv`,
      [["Category", "Transactions", "Total", "Share", "Average", "Largest", "3-mo trend"], ...rows.map((r) => r.cells)],
      scoped.length,
    );
  },
};

const fullBackup: ExportTemplate = {
  id: "full-backup",
  name: "Full Backup",
  tagline: "Everything, restorable",
  description: "A complete JSON snapshot of every expense with metadata. Use it for backups and migrations.",
  icon: "🗄️",
  accent: "from-slate-600 to-slate-800",
  formatLabel: "JSON",
  columns: ["id", "date", "category", "amount", "description", "createdAt", "updatedAt"],
  periods: [{ id: "all", label: "All data" }],
  generate(expenses, _periodId, now = new Date()) {
    const doc = {
      app: "Spendwise",
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      count: expenses.length,
      expenses,
    };
    return {
      name: `spendwise-backup-${toISODate(now)}.json`,
      mimeType: "application/json",
      content: JSON.stringify(doc, null, 2),
      records: expenses.length,
    };
  },
};

export const TEMPLATES: Record<TemplateId, ExportTemplate> = {
  "tax-report": taxReport,
  "monthly-summary": monthlySummary,
  "category-analysis": categoryAnalysis,
  "full-backup": fullBackup,
};

export const TEMPLATE_LIST = [monthlySummary, categoryAnalysis, taxReport, fullBackup];

/** Parse generated CSV back into rows, for spreadsheet-style previews. */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = content.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
