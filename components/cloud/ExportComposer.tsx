"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useExpenses } from "@/components/ExpensesProvider";
import { useToast } from "@/components/ToastProvider";
import { DESTINATIONS, INTEGRATIONS } from "@/lib/cloud/integrations";
import { TEMPLATES, parseCsv } from "@/lib/cloud/templates";
import type { ExportRequest, IntegrationId, TemplateId } from "@/lib/cloud/types";
import { formatCurrency } from "@/lib/format";
import { sum } from "@/lib/analytics";
import { useCloud } from "./CloudProvider";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { ServiceTile, Toggle, formatBytes } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ComposerSeed {
  templateId: TemplateId;
  destination?: IntegrationId;
}

export function ExportComposer({
  seed,
  onClose,
  onAutomate,
}: {
  seed: ComposerSeed;
  onClose: () => void;
  onAutomate: (req: Pick<ExportRequest, "templateId" | "periodId" | "destination" | "target">) => void;
}) {
  const { expenses } = useExpenses();
  const { connections, requestConnect, startExport } = useCloud();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState<TemplateId>(seed.templateId);
  const template = TEMPLATES[templateId];
  const [periodId, setPeriodId] = useState(template.periods[0].id);
  const [destination, setDestination] = useState<IntegrationId>(seed.destination ?? "download");
  const integration = INTEGRATIONS[destination];
  const connected = !integration.requiresAuth || !!connections[destination];

  // Destination-specific state
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Hi, here's my latest spending report from Spendwise.");
  const [inlineSummary, setInlineSummary] = useState(true);
  const [folder, setFolder] = useState("/Apps/Spendwise/Exports");
  const [sheetName, setSheetName] = useState("");
  const [liveSync, setLiveSync] = useState(true);

  const file = useMemo(() => template.generate(expenses, periodId), [template, expenses, periodId]);
  const bytes = useMemo(() => new Blob([file.content]).size, [file]);

  const changeTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setPeriodId(TEMPLATES[id].periods[0].id);
  };

  const addRecipient = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    const valid = parts.filter((p) => EMAIL_RE.test(p) && !recipients.includes(p));
    if (valid.length) setRecipients((r) => [...r, ...valid].slice(0, 10));
    setRecipientDraft(parts.filter((p) => !EMAIL_RE.test(p)).join(" "));
  };

  const target: ExportRequest["target"] =
    integration.kind === "message"
      ? { recipients, subject: subject || `${template.name} from Spendwise` }
      : integration.kind === "spreadsheet"
        ? { sheetName: sheetName || `Spendwise · ${template.name}`, liveSync }
        : integration.kind === "storage"
          ? { folder }
          : undefined;

  const problem =
    file.records === 0 && templateId !== "full-backup"
      ? "No expenses fall in this period."
      : !connected
        ? `Connect ${integration.name} to continue.`
        : integration.kind === "message" && recipients.length === 0
          ? "Add at least one recipient."
          : null;

  const submit = () => {
    if (problem) return;
    startExport({ templateId, periodId, destination, target });
    toast(
      integration.kind === "local"
        ? `Preparing ${file.name}…`
        : `Export to ${integration.name} started. Track it in Activity.`,
      "info",
    );
    onClose();
  };

  return (
    <Modal open title="Share & export" onClose={onClose} size="lg">
      <div className="space-y-6">
        {/* Template */}
        <section>
          <Label>Template</Label>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${template.accent}`}
              aria-hidden
            >
              {template.icon}
            </span>
            <select
              aria-label="Template"
              value={templateId}
              onChange={(e) => changeTemplate(e.target.value as TemplateId)}
              className="input sm:flex-1"
            >
              {Object.values(TEMPLATES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.tagline}
                </option>
              ))}
            </select>
            {template.periods.length > 1 && (
              <select
                aria-label="Period"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
                className="input sm:w-44"
              >
                {template.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {file.name} · {file.records.toLocaleString()} records · {formatBytes(bytes)}
          </p>
        </section>

        {/* Destination */}
        <section>
          <Label>Send to</Label>
          <div role="radiogroup" aria-label="Destination" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DESTINATIONS.map((d) => {
              const selected = d.id === destination;
              const isConnected = !d.requiresAuth || !!connections[d.id];
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDestination(d.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    selected
                      ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <ServiceTile integration={d} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{d.name}</span>
                    {d.requiresAuth && (
                      <span className={`block text-[11px] ${isConnected ? "text-emerald-600" : "text-slate-400"}`}>
                        {isConnected ? "● Connected" : "Not connected"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Destination details */}
        <section className="rounded-2xl bg-slate-50 p-4">
          {!connected ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <ServiceTile integration={integration} size="lg" />
              <p className="max-w-sm text-sm text-slate-600">{integration.description}</p>
              <button onClick={() => requestConnect(destination)} className="btn-primary">
                Connect {integration.name}
              </button>
            </div>
          ) : integration.kind === "local" ? (
            <p className="text-sm text-slate-600">
              The file is generated on your device and saved to your downloads folder. Nothing is uploaded.
            </p>
          ) : integration.kind === "message" ? (
            <EmailPanel
              recipients={recipients}
              draft={recipientDraft}
              setDraft={setRecipientDraft}
              addRecipient={addRecipient}
              removeRecipient={(r) => setRecipients((rs) => rs.filter((x) => x !== r))}
              subject={subject}
              subjectPlaceholder={`${template.name} from Spendwise`}
              setSubject={setSubject}
              message={message}
              setMessage={setMessage}
              inlineSummary={inlineSummary}
              setInlineSummary={setInlineSummary}
              attachment={`${file.name} (${formatBytes(bytes)})`}
              summaryLine={`${expenses.length} expenses · ${formatCurrency(sum(expenses))} total`}
            />
          ) : integration.kind === "share" ? (
            <ShareLinkPanel templateId={templateId} />
          ) : integration.kind === "spreadsheet" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Spreadsheet name">
                  <input
                    value={sheetName}
                    placeholder={`Spendwise · ${template.name}`}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="input"
                  />
                </Field>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm">
                    <span className="block font-medium text-slate-900">Keep in sync</span>
                    <span className="block text-xs text-slate-500">Update the sheet whenever expenses change</span>
                  </span>
                  <Toggle checked={liveSync} onChange={setLiveSync} label="Keep spreadsheet in sync" />
                </div>
              </div>
              {file.mimeType.startsWith("text/csv") && <SheetPreview csv={file.content} />}
            </div>
          ) : (
            <StoragePanel id={destination} folder={folder} setFolder={setFolder} fileName={file.name} />
          )}
        </section>
      </div>

      {integration.kind !== "share" && (
        <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-6 flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onAutomate({ templateId, periodId, destination, target })}
            className="text-left text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ⟳ Automate this export…
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {problem && <span className="text-sm text-amber-700">{problem}</span>}
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={submit} disabled={!!problem} className="btn-primary">
              {integration.kind === "local" ? "Download" : integration.kind === "message" ? "Send" : "Export"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function EmailPanel(p: {
  recipients: string[];
  draft: string;
  setDraft: (v: string) => void;
  addRecipient: (raw: string) => void;
  removeRecipient: (r: string) => void;
  subject: string;
  subjectPlaceholder: string;
  setSubject: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  inlineSummary: boolean;
  setInlineSummary: (v: boolean) => void;
  attachment: string;
  summaryLine: string;
}) {
  return (
    <div className="space-y-3">
      <Field label="To">
        <div className="input flex flex-wrap items-center gap-1.5 py-1.5">
          {p.recipients.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
            >
              {r}
              <button
                type="button"
                onClick={() => p.removeRecipient(r)}
                aria-label={`Remove ${r}`}
                className="text-brand-400 hover:text-brand-700"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={p.draft}
            onChange={(e) => p.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (["Enter", ",", " ", "Tab"].includes(e.key) && p.draft.trim()) {
                e.preventDefault();
                p.addRecipient(p.draft);
              } else if (e.key === "Backspace" && !p.draft && p.recipients.length) {
                p.removeRecipient(p.recipients[p.recipients.length - 1]);
              }
            }}
            onBlur={() => p.draft.trim() && p.addRecipient(p.draft)}
            placeholder={p.recipients.length ? "" : "accountant@example.com"}
            aria-label="Add recipient"
            className="min-w-[10rem] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
          />
        </div>
        {p.draft.trim() && !EMAIL_RE.test(p.draft.trim()) && (
          <span className="mt-1 block text-xs text-amber-700">Press Enter to add a valid email address.</span>
        )}
      </Field>
      <Field label="Subject">
        <input
          value={p.subject}
          placeholder={p.subjectPlaceholder}
          onChange={(e) => p.setSubject(e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Message">
        <textarea
          value={p.message}
          onChange={(e) => p.setMessage(e.target.value)}
          rows={3}
          className="input resize-none"
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
          📎 {p.attachment}
        </span>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Inline summary
          <Toggle checked={p.inlineSummary} onChange={p.setInlineSummary} label="Include inline summary" />
        </label>
      </div>
      {p.inlineSummary && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          Email body preview: <span className="text-slate-700">{p.message}</span> —{" "}
          <strong className="text-slate-700">{p.summaryLine}</strong>
        </p>
      )}
      <p className="text-xs text-slate-400">Demo mode: delivery is simulated and no email is actually sent.</p>
    </div>
  );
}

function StoragePanel({
  id,
  folder,
  setFolder,
  fileName,
}: {
  id: IntegrationId;
  folder: string;
  setFolder: (v: string) => void;
  fileName: string;
}) {
  const { connections } = useCloud();
  const c = connections[id]!;
  const quotaMb = (INTEGRATIONS[id].quotaGb ?? 15) * 1024;
  const pct = Math.min(100, (c.usedMb / quotaMb) * 100);
  return (
    <div className="space-y-4">
      <Field label="Folder">
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="input font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      <p className="text-xs text-slate-500">
        Saves as <span className="font-mono text-slate-700">{`${folder.replace(/\/$/, "")}/${fileName}`}</span>
      </p>
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{c.account}</span>
          <span>
            {(c.usedMb / 1024).toFixed(2)} GB of {INTEGRATIONS[id].quotaGb} GB used
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Spreadsheet-style preview of the first rows, as they'd land in the sheet. */
export function SheetPreview({ csv, maxRows = 6 }: { csv: string; maxRows?: number }) {
  const rows = useMemo(() => parseCsv(csv).slice(0, maxRows + 1), [csv, maxRows]);
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white text-xs">
      <table className="border-collapse font-mono">
        <thead>
          <tr className="bg-slate-100 text-slate-500">
            <th className="w-8 border border-slate-200" />
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="min-w-[5rem] border border-slate-200 px-2 py-0.5 font-normal">
                {String.fromCharCode(65 + i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td className="border border-slate-200 bg-slate-100 px-1 text-center text-slate-500">{ri + 1}</td>
              {Array.from({ length: cols }, (_, ci) => (
                <td
                  key={ci}
                  className={`max-w-[10rem] truncate border border-slate-200 px-2 py-1 ${ri === 0 ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-700"}`}
                >
                  {r[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
