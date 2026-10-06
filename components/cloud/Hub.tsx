"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useExpenses } from "@/components/ExpensesProvider";
import { useToast } from "@/components/ToastProvider";
import { COMING_SOON, CLOUD_SERVICES, INTEGRATIONS } from "@/lib/cloud/integrations";
import { relativeTime } from "@/lib/cloud/schedule";
import { TEMPLATES, TEMPLATE_LIST } from "@/lib/cloud/templates";
import type { HistoryEntry, IntegrationId, TemplateId } from "@/lib/cloud/types";
import { AutomationsTab, type AutomationDraft } from "./AutomationsTab";
import { useCloud } from "./CloudProvider";
import { useNow } from "./CloudStatus";
import { ExportComposer, type ComposerSeed } from "./ExportComposer";
import { ServiceTile, StatusPill, formatBytes } from "./ui";

const TABS = [
  { id: "templates", label: "Templates" },
  { id: "activity", label: "Activity" },
  { id: "automations", label: "Automations" },
  { id: "connections", label: "Connections" },
  { id: "links", label: "Shared links" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Hub() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: TabId = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "templates") as TabId;
  const setTab = (id: TabId) => router.replace(`/hub?tab=${id}`, { scroll: false });

  const cloud = useCloud();
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const [automationDraft, setAutomationDraft] = useState<AutomationDraft | null>(null);
  useNow(30_000);

  const counts: Partial<Record<TabId, number>> = {
    activity: cloud.jobs.filter((j) => j.status === "running" || j.status === "queued").length || undefined,
    automations: cloud.schedules.filter((s) => s.enabled).length || undefined,
    connections: CLOUD_SERVICES.filter((s) => cloud.connections[s.id]).length || undefined,
    links: cloud.shares.length || undefined,
  };

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-100/80">Share & Export</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Your spending data, wherever you work
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Send polished reports to your inbox, accountant or spreadsheet, keep automatic backups in the cloud, and
              share read-only snapshots with a link.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center sm:gap-6">
            <Stat label="Connected" value={CLOUD_SERVICES.filter((s) => cloud.connections[s.id]).length} />
            <Stat label="Automations" value={cloud.schedules.filter((s) => s.enabled).length} />
            <Stat label="Exports" value={cloud.history.filter((h) => h.status === "completed").length} />
          </dl>
        </div>
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <nav role="tablist" className="inline-flex min-w-full gap-1 border-b border-slate-200 sm:min-w-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {counts[t.id] !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === "templates" && <TemplatesTab onOpen={setComposer} />}
      {tab === "activity" && <ActivityTab />}
      {tab === "automations" && (
        <AutomationsTab draft={automationDraft} onDraftConsumed={() => setAutomationDraft(null)} />
      )}
      {tab === "connections" && <ConnectionsTab />}
      {tab === "links" && (
        <LinksTab onCreate={() => setComposer({ templateId: "monthly-summary", destination: "link" })} />
      )}

      {composer && (
        <ExportComposer
          seed={composer}
          onClose={() => setComposer(null)}
          onAutomate={(draft) => {
            setComposer(null);
            setAutomationDraft(draft);
            setTab("automations");
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] uppercase tracking-wide text-slate-300">{label}</dt>
    </div>
  );
}

// --- Templates --------------------------------------------------------------

const QUICK: IntegrationId[] = ["download", "email", "google-sheets", "link"];

function TemplatesTab({ onOpen }: { onOpen: (seed: ComposerSeed) => void }) {
  const { expenses } = useExpenses();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {TEMPLATE_LIST.map((t) => {
        const preview = t.generate(expenses, t.periods[0].id);
        return (
          <article key={t.id} className="card group flex flex-col overflow-hidden transition hover:shadow-md">
            <div className={`flex items-start justify-between bg-gradient-to-br p-5 text-white ${t.accent}`}>
              <div>
                <span className="text-3xl" aria-hidden>
                  {t.icon}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{t.name}</h3>
                <p className="text-sm text-white/80">{t.tagline}</p>
              </div>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{t.formatLabel}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm text-slate-600">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.columns.slice(0, 6).map((c) => (
                  <span key={c} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                    {c}
                  </span>
                ))}
                {t.columns.length > 6 && (
                  <span className="px-1 text-[11px] text-slate-400">+{t.columns.length - 6}</span>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t.periods[0].label}: {preview.records.toLocaleString()} records ·{" "}
                {formatBytes(new Blob([preview.content]).size)}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <div className="flex gap-1.5">
                  {QUICK.map((id) => (
                    <button
                      key={id}
                      onClick={() => onOpen({ templateId: t.id, destination: id })}
                      title={`Send to ${INTEGRATIONS[id].name}`}
                      aria-label={`${t.name}: send to ${INTEGRATIONS[id].name}`}
                      className="rounded-xl transition hover:-translate-y-0.5 hover:shadow"
                    >
                      <ServiceTile integration={INTEGRATIONS[id]} size="sm" />
                    </button>
                  ))}
                </div>
                <button onClick={() => onOpen({ templateId: t.id })} className="btn-primary px-3 py-2">
                  Use template
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// --- Activity ---------------------------------------------------------------

type ActivityFilter = "all" | "completed" | "failed" | "scheduled";

function ActivityTab() {
  const { jobs, history, downloadAgain, retryJob, clearHistory } = useCloud();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const rows: HistoryEntry[] = useMemo(() => {
    // In-flight jobs first; once a job lands in history, use that entry (it carries the saved file).
    const merged = [...jobs.filter((j) => !history.some((h) => h.id === j.id)), ...history];
    return merged.filter((r) =>
      filter === "all" ? true : filter === "scheduled" ? r.request.trigger === "schedule" : r.status === filter,
    );
  }, [jobs, history, filter]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex gap-1.5">
          {(["all", "completed", "failed", "scheduled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`chip capitalize ${filter === f ? "chip-active" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <button onClick={clearHistory} className="text-xs font-medium text-slate-500 hover:text-rose-600">
            Clear history
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-slate-500">
          No exports here yet. Pick a template to run your first one.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const integration = INTEGRATIONS[r.request.destination];
            const template = TEMPLATES[r.request.templateId];
            const live = r.status === "running" || r.status === "queued";
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ServiceTile integration={integration} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {template.name} <span className="font-normal text-slate-400">→</span> {integration.name}
                      {r.request.target?.recipients?.length ? (
                        <span className="font-normal text-slate-500"> · {r.request.target.recipients.join(", ")}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {live
                        ? r.step
                        : r.status === "failed"
                          ? r.error
                          : [
                              r.fileName,
                              r.records !== undefined && `${r.records} records`,
                              r.bytes && formatBytes(r.bytes),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 sm:w-[22rem] sm:justify-end">
                  {r.request.trigger === "schedule" && (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">⟳ Scheduled</span>
                  )}
                  <time dateTime={r.startedAt} title={new Date(r.startedAt).toLocaleString()}>
                    {relativeTime(r.startedAt)}
                  </time>
                  <StatusPill status={r.status} />
                  {r.status === "completed" && (
                    <button
                      onClick={() => downloadAgain(r)}
                      className="font-semibold text-brand-600 hover:text-brand-700"
                      title={r.file ? "Download the original file" : "Regenerate with current data"}
                    >
                      {r.file ? "Download" : "Re-run"}
                    </button>
                  )}
                  {r.status === "failed" && (
                    <button onClick={() => retryJob(r)} className="font-semibold text-brand-600 hover:text-brand-700">
                      Retry
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Connections ------------------------------------------------------------

function ConnectionsTab() {
  const { connections, requestConnect, disconnect, stopLiveSync, syncing } = useCloud();
  const { toast } = useToast();
  const [waitlist, setWaitlist] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {CLOUD_SERVICES.map((s) => {
          const c = connections[s.id];
          const quotaMb = (s.quotaGb ?? 0) * 1024;
          return (
            <div key={s.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <ServiceTile integration={s} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{s.name}</h3>
                    {c ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> Connected
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {c ? `${c.account} · connected ${relativeTime(c.connectedAt)}` : s.description}
                  </p>
                </div>
              </div>

              {c && s.kind === "storage" && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Storage</span>
                    <span>
                      {(c.usedMb / 1024).toFixed(2)} of {s.quotaGb} GB
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-500"
                      style={{ width: `${Math.min(100, (c.usedMb / quotaMb) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Last upload: {c.lastSyncAt ? relativeTime(c.lastSyncAt) : "none yet"}
                  </p>
                </div>
              )}

              {c && s.kind === "spreadsheet" && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  {c.liveSheet ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">📗 {c.liveSheet.name}</p>
                        <p className="text-xs text-slate-500">
                          {syncing
                            ? "Syncing changes…"
                            : `Live sync on · last synced ${c.lastSyncAt ? relativeTime(c.lastSyncAt) : "never"}`}
                        </p>
                      </div>
                      <button
                        onClick={stopLiveSync}
                        className="shrink-0 text-xs font-medium text-slate-500 hover:text-rose-600"
                      >
                        Stop syncing
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No live-synced sheet. Export a template to Google Sheets with “Keep in sync” on.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-auto flex justify-end pt-4">
                {c ? (
                  <button onClick={() => disconnect(s.id)} className="btn-secondary px-3 py-1.5 text-xs text-rose-600">
                    Disconnect
                  </button>
                ) : (
                  <button onClick={() => requestConnect(s.id)} className="btn-primary px-3 py-1.5 text-xs">
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Coming soon</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {COMING_SOON.map((s) => {
            const joined = waitlist.includes(s.name);
            return (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4"
              >
                <ServiceTile integration={s} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.blurb}</p>
                </div>
                <button
                  onClick={() => {
                    setWaitlist((w) => [...w, s.name]);
                    toast(`We'll let you know when ${s.name} is ready`, "info");
                  }}
                  disabled={joined}
                  className="shrink-0 text-xs font-semibold text-brand-600 disabled:text-emerald-600"
                >
                  {joined ? "✓ Notified" : "Notify me"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Shared links -----------------------------------------------------------

function LinksTab({ onCreate }: { onCreate: () => void }) {
  const { shares, removeShare } = useCloud();
  const { toast } = useToast();

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Copy failed", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Links are self-contained snapshots: the data is compressed into the link itself, so there&apos;s no server
          copy to revoke. Use short expiry times for anything sensitive.
        </p>
        <button onClick={onCreate} className="btn-primary shrink-0">
          + New share link
        </button>
      </div>
      {shares.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-slate-500">No shared links yet.</div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {shares.map((s) => {
            const expired = s.expiresAt !== null && new Date(s.expiresAt) < new Date();
            return (
              <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-base ${TEMPLATES[s.templateId as TemplateId].accent}`}
                    aria-hidden
                  >
                    {TEMPLATES[s.templateId as TemplateId].icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      Created {relativeTime(s.createdAt)} ·{" "}
                      {s.includesTransactions ? "with transactions" : "totals only"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${expired ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {expired ? "Expired" : s.expiresAt ? `Expires ${relativeTime(s.expiresAt)}` : "No expiry"}
                  </span>
                  {!expired && (
                    <>
                      <button onClick={() => copy(s.url)} className="font-semibold text-brand-600 hover:text-brand-700">
                        Copy
                      </button>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Open ↗
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => removeShare(s.id)}
                    className="text-slate-400 hover:text-rose-600"
                    title="Remove from this list"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
