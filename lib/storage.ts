import { CATEGORIES, type Expense } from "./types";

const STORAGE_KEY = "expense-tracker:expenses:v1";

function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.amount === "number" &&
    Number.isFinite(v.amount) &&
    typeof v.category === "string" &&
    (CATEGORIES as readonly string[]).includes(v.category) &&
    typeof v.description === "string"
  );
}

export function loadExpenses(): Expense[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Stored expense data is corrupted.");
  return parsed.filter(isExpense);
}

export function saveExpenses(expenses: Expense[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
