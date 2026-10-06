import type { Expense } from "@/lib/types";
import { EXPORT_FORMATS } from "./formats";
import { selectForExport, summarize } from "./select";
import type { ExportOptions } from "./types";

export type ExportPhase = "preparing" | "generating" | "saving";

export interface ExportResult {
  filename: string;
  count: number;
  bytes: number;
}

/** Runs one export end to end, reporting phases so the UI can show progress. */
export async function runExport(
  all: Expense[],
  options: ExportOptions,
  onPhase: (phase: ExportPhase) => void = () => {},
): Promise<ExportResult> {
  const format = EXPORT_FORMATS[options.format];

  onPhase("preparing");
  const expenses = selectForExport(all, options);
  if (expenses.length === 0) throw new Error("No expenses match the selected filters.");
  const summary = summarize(expenses);

  onPhase("generating");
  const blob = await format.build({ expenses, summary, options, generatedAt: new Date() });

  onPhase("saving");
  const filename = `${options.filename.trim()}.${format.extension}`;
  saveBlob(blob, filename);
  return { filename, count: expenses.length, bytes: blob.size };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
