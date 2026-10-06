"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useExpenses } from "@/components/ExpensesProvider";
import { SummaryCards } from "@/components/SummaryCards";
import { CategoryBreakdown, MonthlyTrendChart } from "@/components/Charts";
import { ExpenseList } from "@/components/ExpenseList";
import { DashboardSkeleton, EmptyState, PageHeader, StorageErrorBanner } from "@/components/PageStates";
import { sortByDateDesc } from "@/lib/analytics";

export default function DashboardPage() {
  const { expenses, isLoading } = useExpenses();
  const recent = useMemo(() => sortByDateDesc(expenses).slice(0, 5), [expenses]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="An overview of your spending"
        actions={
          expenses.length > 0 && (
            <Link href="/hub" className="btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
              </svg>
              Share & export
            </Link>
          )
        }
      />
      <StorageErrorBanner />
      {expenses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <SummaryCards expenses={expenses} />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <MonthlyTrendChart expenses={expenses} />
            </div>
            <div className="lg:col-span-2">
              <CategoryBreakdown expenses={expenses} />
            </div>
          </div>
          <section className="card overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Recent expenses</h2>
              <Link href="/expenses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                View all →
              </Link>
            </header>
            <ExpenseList expenses={recent} compact />
          </section>
        </div>
      )}
    </>
  );
}
