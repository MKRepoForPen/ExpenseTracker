"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { useExpenses } from "@/components/ExpensesProvider";
import { Spinner } from "@/components/ExpenseForm";
import { useToast } from "@/components/ToastProvider";
import { QR_SAFE_LENGTH, buildSnapshot, encodeSnapshot, shareUrl } from "@/lib/cloud/share";
import { TEMPLATES } from "@/lib/cloud/templates";
import type { TemplateId } from "@/lib/cloud/types";
import { generateId } from "@/lib/storage";
import { useCloud } from "./CloudProvider";
import { Toggle } from "./ui";

const EXPIRY = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Never" },
];

export function ShareLinkPanel({ templateId }: { templateId: TemplateId }) {
  const { expenses } = useExpenses();
  const { addShare } = useCloud();
  const { toast } = useToast();

  const [title, setTitle] = useState(`${TEMPLATES[templateId].name} snapshot`);
  const [owner, setOwner] = useState("");
  const [expiry, setExpiry] = useState(7);
  const [includeTransactions, setIncludeTransactions] = useState(false);
  const [includeDescriptions, setIncludeDescriptions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; qr: string | null } | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      const snapshot = buildSnapshot(expenses, {
        title,
        template: templateId,
        expiresInDays: expiry || null,
        owner,
        includeTransactions,
        includeDescriptions: includeTransactions && includeDescriptions,
      });
      const url = shareUrl(await encodeSnapshot(snapshot));
      const qr =
        url.length <= QR_SAFE_LENGTH
          ? await QRCode.toString(url, {
              type: "svg",
              errorCorrectionLevel: "L",
              margin: 1,
              color: { dark: "#0f172a", light: "#ffffff" },
            })
          : null;
      setResult({ url, qr });
      addShare({
        id: generateId(),
        url,
        title: snapshot.title,
        templateId,
        includesTransactions: includeTransactions,
        createdAt: snapshot.createdAt,
        expiresAt: snapshot.expiresAt,
      });
    } catch {
      toast("Couldn't create the link in this browser.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result!.url);
      toast("Link copied to clipboard");
    } catch {
      toast("Copy failed. Select the link and copy it manually.", "error");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url: result!.url });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  if (result) {
    return (
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center">
          {result.qr ? (
            <div
              className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="QR code for the share link"
              // Generated locally by the qrcode library from our own URL.
              dangerouslySetInnerHTML={{ __html: result.qr }}
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
              Too much data for a scannable QR code. Share the link, or leave out transactions.
            </div>
          )}
          {result.qr && <span className="mt-2 text-xs text-slate-500">Scan to open on a phone</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your link is ready</p>
            <p className="text-xs text-slate-500">
              Read-only · {expiry ? `expires in ${EXPIRY.find((e) => e.days === expiry)?.label}` : "never expires"} ·{" "}
              {result.url.length.toLocaleString()} characters
            </p>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.target.select()}
              className="input min-w-0 flex-1 font-mono text-xs"
              aria-label="Share link"
            />
            <button onClick={copy} className="btn-primary shrink-0">
              Copy
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Open preview ↗
            </a>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button onClick={nativeShare} className="btn-secondary">
                Share…
              </button>
            )}
            <button onClick={() => setResult(null)} className="btn-secondary">
              New link
            </button>
          </div>
          <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
            🔒 The data lives inside the link (after the <code>#</code>, which browsers never send to a server). Anyone
            with the link can view it until it expires.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Shared by (optional)</span>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            maxLength={40}
            placeholder="Your name"
            className="input"
          />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Link expires</span>
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY.map((e) => (
            <button
              key={e.days}
              type="button"
              onClick={() => setExpiry(e.days)}
              className={`chip ${expiry === e.days ? "chip-active" : ""}`}
              aria-pressed={expiry === e.days}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        <Row title="Include transactions" hint="Off: viewers only see totals and charts.">
          <Toggle checked={includeTransactions} onChange={setIncludeTransactions} label="Include transactions" />
        </Row>
        <Row title="Include descriptions" hint="Descriptions can reveal where you shop. Off by default.">
          <Toggle
            checked={includeTransactions && includeDescriptions}
            onChange={(v) => includeTransactions && setIncludeDescriptions(v)}
            label="Include descriptions"
          />
        </Row>
      </div>
      <div className="flex justify-end">
        <button onClick={create} disabled={busy || expenses.length === 0} className="btn-primary">
          {busy && <Spinner />}
          Create share link
        </button>
      </div>
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      {children}
    </div>
  );
}
