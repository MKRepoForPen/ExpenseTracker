import { monthlyTotals, sum, totalsByCategory } from "@/lib/analytics";
import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import type { TemplateId } from "./types";

/**
 * A share link is self-contained: the snapshot is compressed into the URL fragment,
 * which browsers never send to a server. No backend, nothing uploaded.
 */
export interface ShareSnapshot {
  v: 1;
  title: string;
  template: TemplateId;
  createdAt: string;
  expiresAt: string | null;
  owner: string | null;
  total: number;
  count: number;
  byCategory: [Category, number][];
  monthly: [string, number][];
  /** [date, categoryIndex, amount, description?] — compact on purpose. */
  rows?: [string, number, number, string?][];
}

export interface SnapshotOptions {
  title: string;
  template: TemplateId;
  expiresInDays: number | null;
  owner: string | null;
  includeTransactions: boolean;
  includeDescriptions: boolean;
}

export function buildSnapshot(expenses: Expense[], o: SnapshotOptions, now = new Date()): ShareSnapshot {
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  return {
    v: 1,
    title: o.title.trim() || "Spending snapshot",
    template: o.template,
    createdAt: now.toISOString(),
    expiresAt: o.expiresInDays ? new Date(now.getTime() + o.expiresInDays * 86400000).toISOString() : null,
    owner: o.owner?.trim() || null,
    total: sum(expenses),
    count: expenses.length,
    byCategory: totalsByCategory(expenses).map((r) => [r.category, r.total]),
    monthly: monthlyTotals(expenses, 6).map((m) => [m.label, m.total]),
    rows: o.includeTransactions
      ? sorted.map((e) => {
          const row: [string, number, number, string?] = [e.date, CATEGORIES.indexOf(e.category), e.amount];
          if (o.includeDescriptions) row.push(e.description);
          return row;
        })
      : undefined,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeSnapshot(snapshot: ShareSnapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeSnapshot(token: string): Promise<ShareSnapshot> {
  const bytes = await pipe(fromBase64Url(token), new DecompressionStream("deflate-raw"));
  const p = JSON.parse(new TextDecoder().decode(bytes));
  if (p?.v !== 1 || typeof p.total !== "number" || !Array.isArray(p.byCategory) || !Array.isArray(p.monthly)) {
    throw new Error("This link isn't a valid Spendwise snapshot.");
  }
  // Links are user-editable input: keep only well-formed entries.
  const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  return {
    ...p,
    title: String(p.title ?? "Spending snapshot").slice(0, 80),
    owner: p.owner ? String(p.owner).slice(0, 40) : null,
    byCategory: p.byCategory.filter((r: unknown[]) => CATEGORIES.includes(r?.[0] as Category) && isNum(r[1])),
    monthly: p.monthly.filter((r: unknown[]) => typeof r?.[0] === "string" && isNum(r[1])),
    rows: Array.isArray(p.rows)
      ? p.rows.filter(
          (r: unknown[]) =>
            typeof r?.[0] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && CATEGORIES[r[1] as number] && isNum(r[2]),
        )
      : undefined,
  } as ShareSnapshot;
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/shared#d=${token}`;
}

/** Beyond ~2,300 characters QR codes get too dense to scan reliably on phones. */
export const QR_SAFE_LENGTH = 2300;
