"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "./Modal";
import { ExpenseForm } from "./ExpenseForm";
import { useExpenses } from "./ExpensesProvider";
import { useToast } from "./ToastProvider";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/lib/types";

interface ExpenseDialogContextValue {
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
  requestDelete: (expense: Expense) => void;
}

const ExpenseDialogContext = createContext<ExpenseDialogContextValue | null>(null);

type DialogState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; expense: Expense };

/** Owns the add/edit modal and delete-with-undo flow so any page or the header can trigger them. */
export function ExpenseDialogProvider({ children }: { children: React.ReactNode }) {
  const { addExpense, updateExpense, deleteExpense, restoreExpense } = useExpenses();
  const { toast } = useToast();
  const [state, setState] = useState<DialogState>({ mode: "closed" });

  const close = useCallback(() => setState({ mode: "closed" }), []);
  const openAdd = useCallback(() => setState({ mode: "add" }), []);
  const openEdit = useCallback((expense: Expense) => setState({ mode: "edit", expense }), []);

  const requestDelete = useCallback(
    (expense: Expense) => {
      const removed = deleteExpense(expense.id);
      if (!removed) return;
      toast(`Deleted "${removed.description}"`, "info", {
        label: "Undo",
        onClick: () => {
          restoreExpense(removed);
          toast("Expense restored");
        },
      });
    },
    [deleteExpense, restoreExpense, toast],
  );

  return (
    <ExpenseDialogContext.Provider value={{ openAdd, openEdit, requestDelete }}>
      {children}
      <Modal open={state.mode !== "closed"} title={state.mode === "edit" ? "Edit expense" : "Add expense"} onClose={close}>
        {state.mode === "add" && (
          <ExpenseForm
            submitLabel="Add expense"
            onCancel={close}
            onSubmit={(input) => {
              addExpense(input);
              toast(`Added ${formatCurrency(input.amount)} for ${input.description}`);
              close();
            }}
          />
        )}
        {state.mode === "edit" && (
          <ExpenseForm
            key={state.expense.id}
            initial={state.expense}
            submitLabel="Save changes"
            onCancel={close}
            onSubmit={(input) => {
              updateExpense(state.expense.id, input);
              toast("Expense updated");
              close();
            }}
          />
        )}
      </Modal>
    </ExpenseDialogContext.Provider>
  );
}

export function useExpenseDialog(): ExpenseDialogContextValue {
  const ctx = useContext(ExpenseDialogContext);
  if (!ctx) throw new Error("useExpenseDialog must be used within ExpenseDialogProvider");
  return ctx;
}
