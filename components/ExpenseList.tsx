"use client";

import { useExpenseDialog } from "./ExpenseDialogProvider";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_STYLES, type Expense } from "@/lib/types";

export function CategoryBadge({ category }: { category: Expense["category"] }) {
  const s = CATEGORY_STYLES[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span aria-hidden>{s.icon}</span>
      {category}
    </span>
  );
}

export function ExpenseList({ expenses, compact = false }: { expenses: Expense[]; compact?: boolean }) {
  const { openEdit, requestDelete } = useExpenseDialog();

  return (
    <>
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Description</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
            {!compact && <th className="w-24 px-5 py-3"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {expenses.map((e) => (
            <tr key={e.id} className="group transition-colors hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(e.date)}</td>
              <td className="max-w-xs truncate px-5 py-3 font-medium text-slate-900">{e.description}</td>
              <td className="px-5 py-3">
                <CategoryBadge category={e.category} />
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                {formatCurrency(e.amount)}
              </td>
              {!compact && (
                <td className="px-5 py-3">
                  <RowActions onEdit={() => openEdit(e)} onDelete={() => requestDelete(e)} label={e.description} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg" aria-hidden>
              {CATEGORY_STYLES[e.category].icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{e.description}</p>
              <p className="text-xs text-slate-500">
                {formatDate(e.date)} · {e.category}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(e.amount)}</span>
              {!compact && <RowActions onEdit={() => openEdit(e)} onDelete={() => requestDelete(e)} label={e.description} />}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <button onClick={onEdit} aria-label={`Edit ${label}`} className="icon-btn hover:text-brand-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button onClick={onDelete} aria-label={`Delete ${label}`} className="icon-btn hover:text-rose-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  );
}
