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
      <PageHeader title="Dashboard" subtitle="An overview of your spending" />
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
