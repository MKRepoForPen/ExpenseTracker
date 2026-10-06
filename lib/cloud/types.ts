import type { Expense } from "@/lib/types";

export type TemplateId = "tax-report" | "monthly-summary" | "category-analysis" | "full-backup";

export interface GeneratedFile {
  name: string;
  mimeType: string;
  content: string;
  records: number;
}

export interface TemplatePeriod {
  id: string;
  label: string;
}

export interface ExportTemplate {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  /** Tailwind classes for the template's accent tile. */
  accent: string;
  formatLabel: string;
  columns: string[];
  periods: TemplatePeriod[];
  generate: (expenses: Expense[], periodId: string, now?: Date) => GeneratedFile;
}

export type IntegrationId = "download" | "email" | "link" | "google-sheets" | "google-drive" | "dropbox" | "onedrive";

export type IntegrationKind = "local" | "message" | "share" | "spreadsheet" | "storage";

export interface Integration {
  id: IntegrationId;
  name: string;
  kind: IntegrationKind;
  description: string;
  /** Needs a (simulated) OAuth connection before use. */
  requiresAuth: boolean;
  /** Monogram tile; we deliberately don't reproduce third-party logos. */
  monogram: string;
  tile: string;
  quotaGb?: number;
}

export interface Connection {
  account: string;
  connectedAt: string;
  lastSyncAt?: string;
  usedMb: number;
  /** Google Sheets only: a spreadsheet kept in sync with live data. */
  liveSheet?: { name: string; templateId: TemplateId; periodId: string };
}

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobTrigger = "manual" | "schedule" | "sync";

export interface ExportRequest {
  templateId: TemplateId;
  periodId: string;
  destination: IntegrationId;
  trigger?: JobTrigger;
  scheduleId?: string;
  /** Destination-specific details, e.g. recipients or folder. */
  target?: { recipients?: string[]; subject?: string; folder?: string; sheetName?: string; liveSync?: boolean };
}

export interface Job {
  id: string;
  request: ExportRequest;
  status: JobStatus;
  step: string;
  progress: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  fileName?: string;
  bytes?: number;
  records?: number;
}

export interface HistoryEntry extends Job {
  /** Small files are kept so they can be downloaded again. */
  file?: GeneratedFile;
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface Schedule {
  id: string;
  name: string;
  templateId: TemplateId;
  periodId: string;
  destination: IntegrationId;
  target?: ExportRequest["target"];
  frequency: Frequency;
  /** "HH:MM", local time. */
  time: string;
  /** 0 = Sunday, used when weekly. */
  weekday: number;
  /** 1-28, used when monthly. */
  monthDay: number;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt: string;
}

export interface ShareRecord {
  id: string;
  url: string;
  title: string;
  templateId: TemplateId;
  includesTransactions: boolean;
  createdAt: string;
  expiresAt: string | null;
}
