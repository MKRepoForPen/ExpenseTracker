import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ExpensesProvider } from "@/components/ExpensesProvider";
import { ExpenseDialogProvider } from "@/components/ExpenseDialogProvider";
import { Header } from "@/components/Header";
import { CloudProvider } from "@/components/cloud/CloudProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Spendwise — Expense Tracker",
  description: "Track, filter, and analyze your personal expenses.",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <ExpensesProvider>
            <ExpenseDialogProvider>
              <CloudProvider>
                <Header />
                <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
              </CloudProvider>
            </ExpenseDialogProvider>
          </ExpensesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
