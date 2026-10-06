"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { INTEGRATIONS } from "@/lib/cloud/integrations";
import { relativeTime } from "@/lib/cloud/schedule";
import { TEMPLATES } from "@/lib/cloud/templates";
import type { Job } from "@/lib/cloud/types";
import { useCloud } from "./CloudProvider";
import { ProgressBar, ServiceTile, StatusPill } from "./ui";

/** "Synced · 2 min ago" pill, shown only when a live-synced sheet exists. */
export function SyncIndicator() {
  const { connections, syncing } = useCloud();
  const sheets = connections["google-sheets"];
  useNow(30_000);
  if (!sheets?.liveSheet) return null;
  return (
    <Link
      href="/hub?tab=connections"
      className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 md:inline-flex"
      title={`Live sync to "${sheets.liveSheet.name}" in Google Sheets`}
    >
      {syncing ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" aria-hidden />
          Syncing…
        </>
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-emerald-600"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Synced {sheets.lastSyncAt ? relativeTime(sheets.lastSyncAt) : ""}
        </>
      )}
    </Link>
  );
}

/** Header button + popover listing running and recent background exports. */
export function ActivityTray() {
  const { jobs, history, retryJob } = useCloud();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useNow(15_000);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const items: Job[] = [...jobs, ...history.filter((h) => !jobs.some((j) => j.id === h.id))].slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={
          active.length ? `${active.length} export${active.length === 1 ? "" : "s"} running` : "Export activity"
        }
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className={active.length ? "animate-[spin_2.5s_linear_infinite]" : ""}
        >
          {active.length ? <path d="M21 12a9 9 0 1 1-6.2-8.6M21 4v5h-5" /> : <path d="M3 12h4l3-8 4 16 3-8h4" />}
        </svg>
        {active.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {active.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-40 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Activity</p>
            <span className="text-xs text-slate-500">
              {active.length ? `${active.length} running` : "All caught up"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No exports yet. They&apos;ll run in the background and show up here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((j) => (
                <JobRow key={j.id} job={j} onRetry={() => retryJob(j)} />
              ))}
            </ul>
          )}
          <Link
            href="/hub?tab=activity"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50"
          >
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onRetry }: { job: Job; onRetry: () => void }) {
  const integration = INTEGRATIONS[job.request.destination];
  const template = TEMPLATES[job.request.templateId];
  const live = job.status === "queued" || job.status === "running";
  return (
    <li className="flex gap-3 px-4 py-3">
      <ServiceTile integration={integration} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{template.name}</p>
          <StatusPill status={job.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {live
            ? job.step
            : job.status === "failed"
              ? job.error
              : `${integration.name} · ${relativeTime(job.finishedAt ?? job.startedAt)}`}
          {job.request.trigger === "schedule" && " · scheduled"}
        </p>
        {live && (
          <div className="mt-2">
            <ProgressBar value={job.progress} />
          </div>
        )}
        {job.status === "failed" && (
          <button onClick={onRetry} className="mt-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
            Retry
          </button>
        )}
      </div>
    </li>
  );
}

/** Re-render periodically so relative timestamps stay fresh. */
export function useNow(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
