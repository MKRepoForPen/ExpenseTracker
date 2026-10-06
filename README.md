# Spendwise — Expense Tracker

A personal expense tracker built with Next.js 14 (App Router), TypeScript, Tailwind CSS and Recharts. Data is stored in your browser's `localStorage`.

## Getting started

Requires Node.js 18.17 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Production build:

```bash
npm run build
npm start
```

## Features

- **Dashboard** (`/`): summary cards (total, this month vs. last month, average, top category), a 6-month spending chart, a category breakdown, and recent expenses.
- **Expenses** (`/expenses`): search, filter by category and date range (with quick presets), see a running total of the filtered results, edit, delete with undo, and clear all.
- **Export** (dashboard and Expenses page): a slide-over panel with CSV, JSON and PDF formats, date range presets, category selection with live counts, sort order, a custom file name, a summary and preview of exactly what will be exported (table or raw file output), and progress/success states. Opened from the Expenses page, it starts from that page's filters. `Ctrl/⌘ + Enter` exports.
- **Add expense**: the button in the header works on every page. The form validates amount, description, category and date.
- **Persistence**: saved to `localStorage` under the key `expense-tracker:expenses:v1` and kept in sync across open tabs.

## Project structure

```
app/            Routes: layout, dashboard (page.tsx), expenses/page.tsx, error boundary
components/     UI and state providers (expenses, toasts, add/edit dialog)
lib/            Types, storage, formatting, analytics
lib/export/     Export engine: filtering/summary, format registry (CSV, JSON, PDF), download
```
