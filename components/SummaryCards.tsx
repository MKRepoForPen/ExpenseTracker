"use client";

import { useMemo } from "react";
import { currentMonthKey, previousMonthKey, sum, totalsByCategory } from "@/lib/analytics";
import { formatCurrency, monthKey } from "@/lib/format";
import { CATEGORY_STYLES, type Expense } from "@/lib/types";

export function SummaryCards({ expenses }: { expenses: Expense[] }) {
  const stats = useMemo(() => {
    const thisKey = currentMonthKey();
    const prevKey = previousMonthKey();
    const thisMonth = expenses.filter((e) => monthKey(e.date) === thisKey);
    const lastMonth = expenses.filter((e) => monthKey(e.date) === prevKey);
    const thisTotal = sum(thisMonth);
    const lastTotal = sum(lastMonth);
    const change = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : null;
    const top = totalsByCategory(expenses)[0];
    const total = sum(expenses);
    return {
      total,
      count: expenses.length,
      average: expenses.length ? total / expenses.length : 0,
      thisTotal,
      thisCount: thisMonth.length,
      change,
      top,
      topShare: top && total > 0 ? (top.total / total) * 100 : 0,
    };
  }, [expenses]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total spending" value={formatCurrency(stats.total)} hint={`${stats.count} expenses`} />
      <Card
        label="This month"
        value={formatCurrency(stats.thisTotal)}
        hint={
          stats.change === null ? (
            `${stats.thisCount} expenses`
          ) : (
            <span className={stats.change > 0 ? "text-rose-600" : "text-emerald-600"}>
              {stats.change > 0 ? "▲" : "▼"} {Math.abs(stats.change).toFixed(0)}% vs last month
            </span>
          )
        }
      />
      <Card label="Average expense" value={formatCurrency(stats.average)} hint="per transaction" />
      <Card
        label="Top category"
        value={
          stats.top ? (
            <span className="flex items-center gap-2">
              <span aria-hidden>{CATEGORY_STYLES[stats.top.category].icon}</span>
              {stats.top.category}
            </span>
          ) : (
            "—"
          )
        }
        hint={stats.top ? `${formatCurrency(stats.top.total)} · ${stats.topShare.toFixed(0)}% of total` : "No data yet"}
      />
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: React.ReactNode; hint: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}
