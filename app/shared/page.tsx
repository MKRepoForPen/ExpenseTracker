"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeSnapshot, type ShareSnapshot } from "@/lib/cloud/share";
import { TEMPLATES } from "@/lib/cloud/templates";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIES, CATEGORY_STYLES } from "@/lib/types";
import { CategoryBadge } from "@/components/ExpenseList";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "expired"; at: string }
  | { kind: "ok"; snap: ShareSnapshot };

/** Read-only viewer for self-contained share links (data lives in the URL fragment). */
export default function SharedPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const load = () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("d");
      if (!token)
        return setState({ kind: "error", message: "This link is missing its data. Ask the sender for a new one." });
      decodeSnapshot(token)
        .then((snap) =>
          snap.expiresAt && new Date(snap.expiresAt) < new Date()
            ? setState({ kind: "expired", at: snap.expiresAt })
            : setState({ kind: "ok", snap }),
        )
        .catch(() =>
          setState({ kind: "error", message: "This link is damaged or incomplete. Check that you copied all of it." }),
        );
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  if (state.kind === "loading") return <div className="skeleton mx-auto h-96 max-w-3xl" aria-busy="true" />;
  if (state.kind !== "ok") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-3xl" aria-hidden>
          {state.kind === "expired" ? "⌛" : "🔗"}
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">
          {state.kind === "expired" ? "This link has expired" : "Can't open this link"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {state.kind === "expired"
            ? `It stopped working on ${new Date(state.at).toLocaleDateString()}. Ask the sender to share a fresh one.`
            : state.message}
        </p>
      </div>
    );
  }

  const { snap } = state;
  const maxCat = Math.max(...snap.byCategory.map(([, v]) => v), 0);
  const maxMonth = Math.max(...snap.monthly.map(([, v]) => v), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="card overflow-hidden">
        <div
          className={`bg-gradient-to-br p-6 text-white ${TEMPLATES[snap.template]?.accent ?? "from-brand-600 to-brand-700"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Shared snapshot · read-only</p>
          <h1 className="mt-1 text-2xl font-semibold">{snap.title}</h1>
          <p className="mt-1 text-sm text-white/80">
            {snap.owner ? `Shared by ${snap.owner} · ` : ""}
            {new Date(snap.createdAt).toLocaleDateString("en-US", { dateStyle: "long" })}
            {snap.expiresAt && ` · expires ${new Date(snap.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="p-5">
            <dt className="text-sm text-slate-500">Total spending</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatCurrency(snap.total)}</dd>
          </div>
          <div className="p-5">
            <dt className="text-sm text-slate-500">Transactions</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{snap.count.toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">By category</h2>
          <ul className="space-y-3">
            {snap.byCategory.map(([c, v]) => (
              <li key={c}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">
                    {CATEGORY_STYLES[c].icon} {c}
                  </span>
                  <span className="tabular-nums text-slate-900">{formatCurrency(v)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${maxCat ? (v / maxCat) * 100 : 0}%`, backgroundColor: CATEGORY_STYLES[c].color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Last 6 months</h2>
          <div className="flex h-44 items-end gap-2">
            {snap.monthly.map(([label, v]) => (
              <div
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${label}: ${formatCurrency(v)}`}
              >
                <span className="text-[10px] tabular-nums text-slate-500">{v ? `$${Math.round(v)}` : ""}</span>
                <div
                  className="w-full rounded-t bg-[#2a78d6]"
                  style={{ height: `${maxMonth ? (v / maxMonth) * 120 : 0}px` }}
                />
                <span className="text-[11px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {snap.rows && (
        <section className="card overflow-hidden">
          <h2 className="px-5 py-4 font-semibold text-slate-900">Transactions</h2>
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {snap.rows.map(([date, ci, amount, desc], i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">{formatDate(date)}</td>
                    <td className="px-5 py-2.5">
                      <CategoryBadge category={CATEGORIES[ci] ?? "Other"} />
                    </td>
                    <td className="hidden px-5 py-2.5 text-slate-700 sm:table-cell">
                      {desc ?? <span className="text-slate-400">Hidden</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-center text-xs text-slate-500">
        This snapshot was generated with Spendwise. Its data is stored inside the link itself.{" "}
        <Link href="/" className="font-medium text-brand-600 hover:text-brand-700">
          Track your own spending →
        </Link>
      </p>
    </div>
  );
}
