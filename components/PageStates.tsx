"use client";

import { useExpenses } from "./ExpensesProvider";
import { useExpenseDialog } from "./ExpenseDialogProvider";
import { useToast } from "./ToastProvider";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StorageErrorBanner() {
  const { error } = useExpenses();
  if (!error) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <strong className="font-semibold">Storage problem:</strong> {error}
    </div>
  );
}

export function EmptyState() {
  const { openAdd } = useExpenseDialog();
  const { loadSampleData } = useExpenses();
  const { toast } = useToast();
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>
        💸
      </div>
      <h2 className="text-lg font-semibold text-slate-900">No expenses yet</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Start tracking where your money goes. Add your first expense, or load sample data to explore the app.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button onClick={openAdd} className="btn-primary">
          Add your first expense
        </button>
        <button
          onClick={() => {
            loadSampleData();
            toast("Loaded 45 sample expenses");
          }}
          className="btn-secondary"
        >
          Load sample data
        </button>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-6 h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="skeleton h-80 lg:col-span-3" />
        <div className="skeleton h-80 lg:col-span-2" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-28" />
      <div className="card space-y-3 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-10" />
        ))}
      </div>
    </div>
  );
}
