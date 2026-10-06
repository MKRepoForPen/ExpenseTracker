"use client";

import { useState } from "react";
import { DESTINATIONS, INTEGRATIONS } from "@/lib/cloud/integrations";
import { WEEKDAYS, computeNextRun, describeSchedule, relativeTime } from "@/lib/cloud/schedule";
import { TEMPLATES } from "@/lib/cloud/templates";
import type { ExportRequest, Frequency, IntegrationId, TemplateId } from "@/lib/cloud/types";
import { useCloud, type NewSchedule } from "./CloudProvider";
import { useNow } from "./CloudStatus";
import { ServiceTile, Toggle } from "./ui";

export type AutomationDraft = Pick<ExportRequest, "templateId" | "periodId" | "destination" | "target">;

const SCHEDULABLE = DESTINATIONS.filter((d) => d.kind !== "share");
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly"];

export function AutomationsTab({
  draft,
  onDraftConsumed,
}: {
  draft: AutomationDraft | null;
  onDraftConsumed: () => void;
}) {
  const { schedules, connections, updateSchedule, removeSchedule, runScheduleNow } = useCloud();
  const [creating, setCreating] = useState(false);
  useNow(30_000);

  const showForm = creating || draft !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Hands-free backups and reports</p>
          <p className="text-sm text-slate-600">
            Automations run in the background while Spendwise is open. Runs missed while it was closed catch up the next
            time you open it.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setCreating(true)} className="btn-primary shrink-0">
            + New automation
          </button>
        )}
      </div>

      {showForm && (
        <ScheduleForm
          key={draft ? JSON.stringify(draft) : "new"}
          draft={draft}
          onDone={() => {
            setCreating(false);
            onDraftConsumed();
          }}
        />
      )}

      {schedules.length === 0 && !showForm ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            ⏰
          </p>
          <p className="mt-2 font-medium text-slate-900">No automations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Try a weekly backup to Dropbox, or email your accountant a Monthly Summary on the 1st.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => {
            const integration = INTEGRATIONS[s.destination];
            const needsConnection = integration.requiresAuth && !connections[s.destination];
            return (
              <li
                key={s.id}
                className={`card flex flex-col gap-4 p-4 sm:flex-row sm:items-center ${s.enabled ? "" : "opacity-70"}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg ${TEMPLATES[s.templateId].accent}`}
                    aria-hidden
                  >
                    {TEMPLATES[s.templateId].icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{s.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span>{describeSchedule(s)}</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <ServiceTile integration={integration} size="sm" /> {integration.name}
                      </span>
                    </p>
                    {needsConnection && (
                      <p className="mt-1 text-xs text-amber-700">
                        ⚠ {integration.name} isn&apos;t connected, so runs will fail.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 sm:w-48 sm:flex-col sm:items-start sm:gap-0.5">
                  <span>
                    Next:{" "}
                    {s.enabled ? <strong className="text-slate-700">{relativeTime(s.nextRunAt)}</strong> : "paused"}
                  </span>
                  <span>Last: {s.lastRunAt ? relativeTime(s.lastRunAt) : "never"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={s.enabled}
                    onChange={(enabled) => updateSchedule(s.id, { enabled })}
                    label={`${s.enabled ? "Pause" : "Resume"} ${s.name}`}
                  />
                  <button onClick={() => runScheduleNow(s.id)} className="btn-secondary px-3 py-1.5 text-xs">
                    Run now
                  </button>
                  <button
                    onClick={() => removeSchedule(s.id)}
                    aria-label={`Delete ${s.name}`}
                    className="icon-btn hover:text-rose-600"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
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

function ScheduleForm({ draft, onDone }: { draft: AutomationDraft | null; onDone: () => void }) {
  const { addSchedule } = useCloud();
  const [templateId, setTemplateId] = useState<TemplateId>(draft?.templateId ?? "full-backup");
  const [periodId, setPeriodId] = useState(
    draft?.periodId ?? TEMPLATES[draft?.templateId ?? "full-backup"].periods[0].id,
  );
  const [destination, setDestination] = useState<IntegrationId>(
    draft && draft.destination !== "link" ? draft.destination : "dropbox",
  );
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [time, setTime] = useState("09:00");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [recipients, setRecipients] = useState(draft?.target?.recipients?.join(", ") ?? "");
  const [name, setName] = useState("");

  const template = TEMPLATES[templateId];
  const integration = INTEGRATIONS[destination];
  const parsedRecipients = recipients.split(/[\s,;]+/).filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
  const next = computeNextRun({ frequency, time, weekday, monthDay });
  const invalid = integration.kind === "message" && parsedRecipients.length === 0;

  const save = () => {
    if (invalid) return;
    const s: NewSchedule = {
      name: name.trim() || `${template.name} → ${integration.name}`,
      templateId,
      periodId,
      destination,
      target:
        integration.kind === "message"
          ? { recipients: parsedRecipients, subject: `${template.name} from Spendwise` }
          : integration.kind === "storage"
            ? { folder: draft?.target?.folder ?? "/Apps/Spendwise/Backups" }
            : draft?.target,
      frequency,
      time,
      weekday,
      monthDay,
      enabled: true,
    };
    addSchedule(s);
    onDone();
  };

  return (
    <div className="card animate-slide-up space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">New automation</h3>
        <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template">
          <select
            value={templateId}
            onChange={(e) => {
              const id = e.target.value as TemplateId;
              setTemplateId(id);
              setPeriodId(TEMPLATES[id].periods[0].id);
            }}
            className="input"
          >
            {Object.values(TEMPLATES).map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination">
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value as IntegrationId)}
            className="input"
          >
            {SCHEDULABLE.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        {template.periods.length > 1 && (
          <Field label="Period">
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="input">
              {template.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {integration.kind === "message" && (
          <Field label="Recipients">
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="accountant@example.com, me@example.com"
              className="input"
            />
          </Field>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Repeat</span>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              aria-pressed={frequency === f}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${frequency === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {frequency === "weekly" && (
          <Field label="On">
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="input">
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        )}
        {frequency === "monthly" && (
          <Field label="Day of month">
            <select value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))} className="input">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="At">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value || "09:00")} className="input" />
        </Field>
        <Field label="Name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${template.name} → ${integration.name}`}
            className="input"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {describeSchedule({ frequency, time, weekday, monthDay })} · first run{" "}
          <strong className="text-slate-900">
            {next.toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </strong>
        </p>
        <button onClick={save} disabled={invalid} className="btn-primary">
          Create automation
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
