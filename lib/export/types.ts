import type { Category, Expense } from "@/lib/types";

export type ExportFormatId = "csv" | "json" | "pdf";

export type SortOrder = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface ExportOptions {
  format: ExportFormatId;
  startDate: string;
  endDate: string;
  categories: Category[];
  sort: SortOrder;
  /** Base name without extension. */
  filename: string;
}

export interface ExportSummary {
  count: number;
  total: number;
  average: number;
  earliest: string | null;
  latest: string | null;
  byCategory: { category: Category; count: number; total: number }[];
}

/** Everything a format needs to render a file; formats never re-filter. */
export interface ExportPayload {
  expenses: Expense[];
  summary: ExportSummary;
  options: ExportOptions;
  generatedAt: Date;
}

export interface ExportFormat {
  id: ExportFormatId;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
  /** Builders may be async so heavy dependencies (PDF) load on demand. */
  build: (payload: ExportPayload) => Promise<Blob>;
}
