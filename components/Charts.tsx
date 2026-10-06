"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthlyTotals, sum, totalsByCategory } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_STYLES, type Expense } from "@/lib/types";

const SERIES_COLOR = "#2a78d6";

export function MonthlyTrendChart({ expenses }: { expenses: Expense[] }) {
  const data = useMemo(() => monthlyTotals(expenses, 6), [expenses]);
  const hasData = data.some((d) => d.total > 0);

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Monthly spending</h2>
        <p className="text-sm text-slate-500">Last 6 months</p>
      </header>
      {hasData ? (
        <div className="h-64" role="img" aria-label={`Monthly spending: ${data.map((d) => `${d.label} ${formatCurrency(d.total)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200">
                      <p className="font-medium text-slate-900">{label}</p>
                      <p className="tabular-nums text-slate-600">{formatCurrency(Number(payload[0].value))}</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="total" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty />
      )}
    </section>
  );
}

/** Horizontal bars, direct-labeled with name and amount so identity never relies on color alone. */
export function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const rows = useMemo(() => totalsByCategory(expenses), [expenses]);
  const total = sum(expenses);
  const max = rows[0]?.total ?? 0;

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Spending by category</h2>
        <p className="text-sm text-slate-500">All time</p>
      </header>
      {rows.length ? (
        <ul className="space-y-3.5">
          {rows.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0;
            return (
              <li key={r.category} title={`${r.category}: ${formatCurrency(r.total)} (${pct.toFixed(1)}%)`}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span aria-hidden>{CATEGORY_STYLES[r.category].icon}</span>
                    {r.category}
                  </span>
                  <span className="tabular-nums text-slate-900">
                    {formatCurrency(r.total)}
                    <span className="ml-2 text-slate-500">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${max > 0 ? (r.total / max) * 100 : 0}%`, backgroundColor: CATEGORY_STYLES[r.category].color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ChartEmpty />
      )}
    </section>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
      Add some expenses to see this chart.
    </div>
  );
}
