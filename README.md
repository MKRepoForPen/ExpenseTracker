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
- **Expenses** (`/expenses`): search, filter by category and date range (with quick presets), see a running total of the filtered results, edit, delete with undo, export to CSV, and clear all.
- **Share & Export hub** (`/hub`):
  - **Templates**: Tax Report, Monthly Summary (month × category pivot), Category Analysis (share, averages, 3-month trend) and Full Backup (JSON).
  - **Destinations**: download, email, share link + QR code, Google Sheets (with live sync), Google Drive, Dropbox and OneDrive. Email and the cloud services are **simulated** (demo sign-in, no data leaves the browser); downloads and share links are real.
  - **Background jobs**: exports run as jobs with progress in the header's Activity tray; failures can be retried.
  - **Automations**: daily/weekly/monthly exports. They run while the app is open, and runs missed while it was closed catch up on the next visit.
  - **Activity history** with re-download of recent files, **connections** with storage usage and sync status, and a list of **shared links**.
- **Shared snapshots** (`/shared#d=…`): read-only reports that open from a link. The data is compressed into the URL fragment, which is never sent to a server; links can expire, and transactions and descriptions are opt-in.
- **Add expense**: the button in the header works on every page. The form validates amount, description, category and date.
- **Persistence**: saved to `localStorage` under the key `expense-tracker:expenses:v1` and kept in sync across open tabs.

## Project structure

```
app/            Routes: layout, dashboard (page.tsx), expenses/page.tsx, error boundary
components/     UI and state providers (expenses, toasts, add/edit dialog)
lib/            Types, storage, formatting, analytics, CSV export
lib/cloud/      Export templates, integrations catalog, schedule math, share-link codec
components/cloud/  Cloud provider (jobs, scheduler, sync), hub tabs, composer, share panel
```
