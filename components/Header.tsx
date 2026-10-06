"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExpenseDialog } from "./ExpenseDialogProvider";
import { ActivityTray, SyncIndicator } from "./cloud/CloudStatus";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home" },
  { href: "/expenses", label: "Expenses", short: "Expenses" },
  { href: "/hub", label: "Share & Export", short: "Share" },
];

export function Header() {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialog();
  const viewingShare = pathname.startsWith("/shared");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <span className="hidden sm:inline">Spendwise</span>
        </Link>
        {viewingShare ? (
          <span className="ml-auto text-sm text-slate-500">Read-only shared snapshot</span>
        ) : (
          <>
            <nav className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-lg px-2 py-2 text-sm sm:px-3 font-medium transition-colors ${
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className="sm:hidden">{item.short}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <SyncIndicator />
              <ActivityTray />
              <button onClick={openAdd} aria-label="Add expense" className="btn-primary px-3 sm:px-4">
                <span aria-hidden className="text-base leading-none">
                  +
                </span>
                <span className="hidden sm:inline">Add expense</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
