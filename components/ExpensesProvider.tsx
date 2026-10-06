"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { generateId, loadExpenses, saveExpenses } from "@/lib/storage";
import { toISODate } from "@/lib/format";
import type { Expense, ExpenseInput } from "@/lib/types";

interface ExpensesContextValue {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  addExpense: (input: ExpenseInput) => Expense;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => Expense | undefined;
  restoreExpense: (expense: Expense) => void;
  loadSampleData: () => void;
  clearAll: () => void;
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      setExpenses(loadExpenses());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load saved expenses.");
    } finally {
      hydrated.current = true;
      setIsLoading(false);
    }
  }, []);

  // Persist only once loading has committed, so the initial empty state never overwrites saved data.
  // (A ref flipped inside the load effect isn't enough: both effects run in the same commit.)
  useEffect(() => {
    if (isLoading || !hydrated.current) return;
    try {
      saveExpenses(expenses);
      setError(null);
    } catch {
      setError("Could not save changes. Your browser storage may be full or disabled.");
    }
  }, [expenses, isLoading]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("expense-tracker:")) return;
      try {
        setExpenses(loadExpenses());
      } catch {
        /* ignore malformed cross-tab writes */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  const addExpense = useCallback((input: ExpenseInput) => {
    const now = new Date().toISOString();
    const expense: Expense = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    setExpenses((prev) => [expense, ...prev]);
    return expense;
  }, []);

  const updateExpense = useCallback((id: string, input: ExpenseInput) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e)),
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    const removed = expensesRef.current.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    return removed;
  }, []);

  const restoreExpense = useCallback((expense: Expense) => {
    setExpenses((prev) => (prev.some((e) => e.id === expense.id) ? prev : [expense, ...prev]));
  }, []);

  const loadSampleData = useCallback(() => {
    setExpenses((prev) => [...buildSampleData(), ...prev]);
  }, []);

  const clearAll = useCallback(() => setExpenses([]), []);

  const value = useMemo(
    () => ({
      expenses,
      isLoading,
      error,
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpense,
      loadSampleData,
      clearAll,
    }),
    [expenses, isLoading, error, addExpense, updateExpense, deleteExpense, restoreExpense, loadSampleData, clearAll],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesContextValue {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpensesProvider");
  return ctx;
}

const SAMPLE_TEMPLATES: [ExpenseInput["category"], string, number, number][] = [
  ["Food", "Groceries", 40, 140],
  ["Food", "Lunch with coworkers", 12, 35],
  ["Food", "Coffee", 4, 8],
  ["Transportation", "Gas", 35, 70],
  ["Transportation", "Rideshare", 12, 40],
  ["Entertainment", "Movie tickets", 15, 40],
  ["Entertainment", "Streaming subscription", 10, 20],
  ["Shopping", "New shoes", 50, 150],
  ["Shopping", "Household supplies", 15, 60],
  ["Bills", "Electricity bill", 60, 140],
  ["Bills", "Internet", 60, 80],
  ["Other", "Gift for a friend", 20, 80],
];

function buildSampleData(): Expense[] {
  const now = new Date();
  const ts = now.toISOString();
  return Array.from({ length: 45 }, (_, i) => {
    const [category, description, min, max] = SAMPLE_TEMPLATES[i % SAMPLE_TEMPLATES.length];
    // Keep a handful in the current month so "This month" has data.
    const daysAgo = Math.floor(Math.random() * (i < 6 ? now.getDate() : 170));
    const date = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo));
    const amount = Math.round((min + Math.random() * (max - min)) * 100) / 100;
    return { id: generateId(), date, amount, category, description, createdAt: ts, updatedAt: ts };
  });
}
