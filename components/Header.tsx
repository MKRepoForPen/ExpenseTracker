"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExpenseDialog } from "./ExpenseDialogProvider";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
];

export function Header() {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialog();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <span className="hidden sm:inline">Spendwise</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={openAdd} className="btn-primary ml-auto">
          <span aria-hidden className="text-base leading-none">+</span>
          <span>
            Add<span className="hidden sm:inline"> expense</span>
          </span>
        </button>
      </div>
    </header>
  );
}
