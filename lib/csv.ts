import type { Expense } from "./types";

function escapeCell(value: string): string {
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function expensesToCSV(expenses: Expense[]): string {
  const header = ["Date", "Category", "Amount", "Description"];
  const rows = expenses.map((e) =>
    [e.date, e.category, e.amount.toFixed(2), escapeCell(e.description)].join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}

export function downloadCSV(expenses: Expense[], filename = "expenses.csv"): void {
  const blob = new Blob(["﻿" + expensesToCSV(expenses)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
