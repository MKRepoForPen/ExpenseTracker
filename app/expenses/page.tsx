"use client";

import { useMemo, useState } from "react";
import { useExpenses } from "@/components/ExpensesProvider";
import { useToast } from "@/components/ToastProvider";
import { ExpenseFiltersBar } from "@/components/ExpenseFiltersBar";
import { ExpenseList } from "@/components/ExpenseList";
import { Modal } from "@/components/Modal";
import { EmptyState, ListSkeleton, PageHeader, StorageErrorBanner } from "@/components/PageStates";
import { filterExpenses, sortByDateDesc, sum } from "@/lib/analytics";
import { downloadCSV } from "@/lib/csv";
import { formatCurrency, todayISO } from "@/lib/format";
import { EMPTY_FILTERS, type ExpenseFilters } from "@/lib/types";

export default function ExpensesPage() {
  const { expenses, isLoading, clearAll } = useExpenses();
  const { toast } = useToast();
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = useMemo(() => sortByDateDesc(filterExpenses(expenses, filters)), [expenses, filters]);

  if (isLoading) return <ListSkeleton />;

  const handleExport = () => {
    if (visible.length === 0) {
      toast("Nothing to export with the current filters", "error");
      return;
    }
    try {
      downloadCSV(visible, `expenses-${todayISO()}.csv`);
      toast(`Exported ${visible.length} expense${visible.length === 1 ? "" : "s"} to CSV`);
    } catch {
      toast("Export failed. Please try again.", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Search, filter, edit and export your expenses"
        actions={
          expenses.length > 0 && (
            <>
              <button onClick={handleExport} className="btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                Export CSV
              </button>
              <button onClick={() => setConfirmClear(true)} className="btn-secondary text-rose-600 hover:bg-rose-50">
                Clear all
              </button>
            </>
          )
        }
      />
      <StorageErrorBanner />

      {expenses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <ExpenseFiltersBar filters={filters} onChange={setFilters} />

          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm">
              <span className="text-slate-500">
                Showing <strong className="font-semibold text-slate-900">{visible.length}</strong> of {expenses.length}
              </span>
              <span className="text-slate-500">
                Total: <strong className="font-semibold tabular-nums text-slate-900">{formatCurrency(sum(visible))}</strong>
              </span>
            </header>
            {visible.length > 0 ? (
              <ExpenseList expenses={visible} />
            ) : (
              <div className="px-6 py-14 text-center">
                <p className="font-medium text-slate-900">No matching expenses</p>
                <p className="mt-1 text-sm text-slate-500">Try adjusting your search or filters.</p>
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-secondary mt-4">
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <Modal open={confirmClear} title="Delete all expenses?" onClose={() => setConfirmClear(false)} size="sm">
        <p className="text-sm text-slate-600">
          This permanently removes all {expenses.length} expenses from this browser. Consider exporting a CSV first.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => setConfirmClear(false)} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => {
              clearAll();
              setConfirmClear(false);
              toast("All expenses deleted", "info");
            }}
            className="btn-primary bg-rose-600 hover:bg-rose-700"
          >
            Delete all
          </button>
        </div>
      </Modal>
    </>
  );
}
