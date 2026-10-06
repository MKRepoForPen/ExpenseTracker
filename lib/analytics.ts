import { CATEGORIES, type Category, type Expense, type ExpenseFilters } from "./types";
import { formatMonthKey, monthKey, toISODate } from "./format";

export function filterExpenses(expenses: Expense[], f: ExpenseFilters): Expense[] {
  const q = f.search.trim().toLowerCase();
  return expenses.filter((e) => {
    if (f.category !== "All" && e.category !== f.category) return false;
    if (f.startDate && e.date < f.startDate) return false;
    if (f.endDate && e.date > f.endDate) return false;
    if (q && !e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortByDateDesc(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function sum(expenses: Expense[]): number {
  return Math.round(expenses.reduce((acc, e) => acc + e.amount, 0) * 100) / 100;
}

export function totalsByCategory(expenses: Expense[]): { category: Category; total: number }[] {
  const map = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return CATEGORIES.map((category) => ({ category, total: Math.round((map.get(category) ?? 0) * 100) / 100 }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Totals for the last `months` calendar months, oldest first, including empty months. */
export function monthlyTotals(expenses: Expense[], months = 6): { key: string; label: string; total: number }[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(monthKey(toISODate(new Date(now.getFullYear(), now.getMonth() - i, 1))));
  }
  const map = new Map(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    const k = monthKey(e.date);
    if (map.has(k)) map.set(k, map.get(k)! + e.amount);
  }
  return keys.map((key) => ({ key, label: formatMonthKey(key), total: Math.round(map.get(key)! * 100) / 100 }));
}

export function currentMonthKey(): string {
  return monthKey(toISODate(new Date()));
}

export function previousMonthKey(): string {
  const now = new Date();
  return monthKey(toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
}
