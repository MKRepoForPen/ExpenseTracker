"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useExpenses } from "@/components/ExpensesProvider";
import { useToast } from "@/components/ToastProvider";
import { generateId } from "@/lib/storage";
import { DEMO_ACCOUNT, INTEGRATIONS } from "@/lib/cloud/integrations";
import { computeNextRun } from "@/lib/cloud/schedule";
import { TEMPLATES } from "@/lib/cloud/templates";
import type {
  Connection,
  ExportRequest,
  GeneratedFile,
  HistoryEntry,
  IntegrationId,
  Job,
  Schedule,
  ShareRecord,
} from "@/lib/cloud/types";
import { ConnectDialog } from "./ConnectDialog";

const STORAGE_KEY = "expense-tracker:cloud:v1";
const MAX_HISTORY = 50;
const MAX_STORED_FILES = 10;
const MAX_STORED_FILE_CHARS = 60_000;

interface PersistedState {
  connections: Partial<Record<IntegrationId, Connection>>;
  history: HistoryEntry[];
  schedules: Schedule[];
  shares: ShareRecord[];
}

const EMPTY: PersistedState = { connections: {}, history: [], schedules: [], shares: [] };

export type NewSchedule = Omit<Schedule, "id" | "createdAt" | "nextRunAt" | "lastRunAt">;

interface CloudContextValue extends PersistedState {
  ready: boolean;
  jobs: Job[];
  syncing: boolean;
  requestConnect: (id: IntegrationId) => Promise<boolean>;
  disconnect: (id: IntegrationId) => void;
  startExport: (request: ExportRequest) => string;
  retryJob: (job: Job) => void;
  downloadAgain: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  addSchedule: (s: NewSchedule) => void;
  updateSchedule: (id: string, patch: Partial<NewSchedule>) => void;
  removeSchedule: (id: string) => void;
  runScheduleNow: (id: string) => void;
  addShare: (share: ShareRecord) => void;
  removeShare: (id: string) => void;
  stopLiveSync: () => void;
}

const CloudContext = createContext<CloudContextValue | null>(null);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Jittered latency so simulated network steps don't feel robotic. */
const latency = (base: number) => sleep(base * (0.75 + Math.random() * 0.5));

export function saveFile(file: GeneratedFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const { expenses, isLoading } = useExpenses();
  const { toast } = useToast();
  const [state, setState] = useState<PersistedState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [connectRequest, setConnectRequest] = useState<{ id: IntegrationId; resolve: (ok: boolean) => void } | null>(
    null,
  );

  // Refs let long-running jobs and timers read current data without re-subscribing.
  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- persistence -----------------------------------------------------------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* start fresh if corrupted */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota exceeded: history files are the first thing to drop */
      setState((s) => ({ ...s, history: s.history.map(({ file: _f, ...rest }) => rest) }));
    }
  }, [state, ready]);

  // --- connections -----------------------------------------------------------
  const requestConnect = useCallback((id: IntegrationId) => {
    if (stateRef.current.connections[id]) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setConnectRequest({ id, resolve }));
  }, []);

  const finishConnect = useCallback(
    (ok: boolean) => {
      if (!connectRequest) return;
      const { id, resolve } = connectRequest;
      if (ok) {
        const quota = INTEGRATIONS[id].quotaGb ?? 15;
        setState((s) => ({
          ...s,
          connections: {
            ...s.connections,
            [id]: {
              account: DEMO_ACCOUNT,
              connectedAt: new Date().toISOString(),
              usedMb: Math.round(quota * 1024 * 0.18),
            },
          },
        }));
        toast(`${INTEGRATIONS[id].name} connected`);
      }
      setConnectRequest(null);
      resolve(ok);
    },
    [connectRequest, toast],
  );

  const disconnect = useCallback(
    (id: IntegrationId) => {
      setState((s) => {
        const { [id]: _removed, ...rest } = s.connections;
        return { ...s, connections: rest };
      });
      toast(`${INTEGRATIONS[id].name} disconnected`, "info");
    },
    [toast],
  );

  const stopLiveSync = useCallback(() => {
    setState((s) => {
      const c = s.connections["google-sheets"];
      if (!c) return s;
      return { ...s, connections: { ...s.connections, "google-sheets": { ...c, liveSheet: undefined } } };
    });
  }, []);

  // --- jobs ------------------------------------------------------------------
  const patchJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const finishJob = useCallback((job: Job, file?: GeneratedFile) => {
    const done = { ...job, finishedAt: new Date().toISOString() };
    setJobs((js) => js.map((j) => (j.id === job.id ? done : j)));
    setState((s) => {
      const entry: HistoryEntry = {
        ...done,
        file: file && file.content.length <= MAX_STORED_FILE_CHARS ? file : undefined,
      };
      let kept = 0;
      const history = [entry, ...s.history].slice(0, MAX_HISTORY).map((h) => {
        if (!h.file) return h;
        kept++;
        return kept > MAX_STORED_FILES ? { ...h, file: undefined } : h;
      });
      return { ...s, history };
    });
    // Completed jobs linger in the tray briefly, then live on in history.
    setTimeout(() => setJobs((js) => js.filter((j) => j.id !== job.id)), 6000);
  }, []);

  const execute = useCallback(
    async (job: Job) => {
      const { request } = job;
      const integration = INTEGRATIONS[request.destination];
      const template = TEMPLATES[request.templateId];
      const step = (s: string, progress: number) => {
        job = { ...job, status: "running", step: s, progress };
        patchJob(job.id, { status: "running", step: s, progress });
      };

      try {
        await latency(350);
        step(`Generating ${template.name}`, 12);
        const file = template.generate(expensesRef.current, request.periodId);
        await latency(500);
        job = { ...job, fileName: file.name, bytes: new Blob([file.content]).size, records: file.records };
        patchJob(job.id, { fileName: job.fileName, bytes: job.bytes, records: job.records });

        if (integration.requiresAuth && !stateRef.current.connections[integration.id]) {
          throw new Error(`${integration.name} is disconnected. Reconnect it and retry.`);
        }
        if (integration.kind !== "local" && typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("You're offline. Retry when your connection is back.");
        }

        switch (integration.kind) {
          case "local":
            step("Saving to this device", 80);
            await latency(250);
            saveFile(file);
            break;
          case "message": {
            const n = request.target?.recipients?.length ?? 1;
            step("Composing message", 45);
            await latency(600);
            step(`Sending to ${n} recipient${n === 1 ? "" : "s"}`, 75);
            await latency(900);
            break;
          }
          case "spreadsheet": {
            step("Connecting to Google Sheets", 35);
            await latency(600);
            step(`Writing ${file.records} rows`, 60);
            await latency(900);
            step("Applying formatting", 88);
            await latency(500);
            if (request.target?.liveSync) {
              setState((s) => {
                const c = s.connections["google-sheets"];
                if (!c) return s;
                return {
                  ...s,
                  connections: {
                    ...s.connections,
                    "google-sheets": {
                      ...c,
                      lastSyncAt: new Date().toISOString(),
                      liveSheet: {
                        name: request.target?.sheetName || template.name,
                        templateId: request.templateId,
                        periodId: request.periodId,
                      },
                    },
                  },
                };
              });
            }
            break;
          }
          case "storage": {
            const chunks = 5;
            for (let i = 1; i <= chunks; i++) {
              step(`Uploading to ${integration.name}`, 25 + Math.round((i / chunks) * 65));
              await latency(260);
            }
            step("Verifying upload", 95);
            await latency(300);
            setState((s) => {
              const c = s.connections[integration.id];
              if (!c) return s;
              const usedMb = c.usedMb + (job.bytes ?? 0) / 1_000_000;
              return {
                ...s,
                connections: {
                  ...s.connections,
                  [integration.id]: { ...c, usedMb, lastSyncAt: new Date().toISOString() },
                },
              };
            });
            break;
          }
          case "share":
            step("Packaging snapshot", 80);
            await latency(300);
            break;
        }

        job = { ...job, status: "completed", step: "Done", progress: 100 };
        finishJob(job, file);
        if (request.trigger === "schedule") toast(`Scheduled export finished: ${file.name}`);
      } catch (e) {
        job = { ...job, status: "failed", error: e instanceof Error ? e.message : "Export failed." };
        finishJob(job);
        toast(job.error!, "error");
      }
    },
    [patchJob, finishJob, toast],
  );

  const startExport = useCallback(
    (request: ExportRequest) => {
      const job: Job = {
        id: generateId(),
        request: { trigger: "manual", ...request },
        status: "queued",
        step: "Queued",
        progress: 4,
        startedAt: new Date().toISOString(),
      };
      setJobs((js) => [job, ...js]);
      void execute(job);
      return job.id;
    },
    [execute],
  );

  const retryJob = useCallback((job: Job) => startExport(job.request), [startExport]);

  const downloadAgain = useCallback(
    (entry: HistoryEntry) => {
      if (entry.file) saveFile(entry.file);
      else startExport({ ...entry.request, destination: "download", trigger: "manual" });
    },
    [startExport],
  );

  const clearHistory = useCallback(() => setState((s) => ({ ...s, history: [] })), []);

  // --- schedules -------------------------------------------------------------
  const addSchedule = useCallback((s: NewSchedule) => {
    const schedule: Schedule = {
      ...s,
      id: generateId(),
      createdAt: new Date().toISOString(),
      nextRunAt: computeNextRun(s).toISOString(),
    };
    setState((st) => ({ ...st, schedules: [schedule, ...st.schedules] }));
  }, []);

  const updateSchedule = useCallback((id: string, patch: Partial<NewSchedule>) => {
    setState((st) => ({
      ...st,
      schedules: st.schedules.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        return { ...next, nextRunAt: computeNextRun(next).toISOString() };
      }),
    }));
  }, []);

  const removeSchedule = useCallback((id: string) => {
    setState((st) => ({ ...st, schedules: st.schedules.filter((s) => s.id !== id) }));
  }, []);

  const runSchedule = useCallback(
    (s: Schedule) => {
      startExport({
        templateId: s.templateId,
        periodId: s.periodId,
        destination: s.destination,
        target: s.target,
        trigger: "schedule",
        scheduleId: s.id,
      });
      const now = new Date();
      setState((st) => ({
        ...st,
        schedules: st.schedules.map((x) =>
          x.id === s.id ? { ...x, lastRunAt: now.toISOString(), nextRunAt: computeNextRun(x, now).toISOString() } : x,
        ),
      }));
    },
    [startExport],
  );

  const runScheduleNow = useCallback(
    (id: string) => {
      const s = stateRef.current.schedules.find((x) => x.id === id);
      if (s) runSchedule(s);
    },
    [runSchedule],
  );

  // The scheduler runs while the app is open; runs missed while closed catch up once on next visit.
  // `fired` keys each due slot so a slot can't run twice before state catches up (e.g. StrictMode).
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || isLoading) return;
    const tick = () => {
      const now = Date.now();
      for (const s of stateRef.current.schedules) {
        const slot = `${s.id}@${s.nextRunAt}`;
        if (s.enabled && new Date(s.nextRunAt).getTime() <= now && !fired.current.has(slot)) {
          fired.current.add(slot);
          runSchedule(s);
        }
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [ready, isLoading, runSchedule]);

  // --- live sync -------------------------------------------------------------
  const liveSheet = state.connections["google-sheets"]?.liveSheet;
  const lastSyncedExpenses = useRef<typeof expenses | null>(null);
  useEffect(() => {
    if (isLoading || !ready) return;
    if (!liveSheet || lastSyncedExpenses.current === null) {
      lastSyncedExpenses.current = expenses;
      return;
    }
    if (lastSyncedExpenses.current === expenses) return;
    lastSyncedExpenses.current = expenses;
    setSyncing(true);
    const t = setTimeout(async () => {
      await latency(900);
      setSyncing(false);
      setState((s) => {
        const c = s.connections["google-sheets"];
        return c
          ? { ...s, connections: { ...s.connections, "google-sheets": { ...c, lastSyncAt: new Date().toISOString() } } }
          : s;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [expenses, liveSheet, isLoading, ready]);

  // --- shares ----------------------------------------------------------------
  const addShare = useCallback((share: ShareRecord) => setState((s) => ({ ...s, shares: [share, ...s.shares] })), []);
  const removeShare = useCallback(
    (id: string) => setState((s) => ({ ...s, shares: s.shares.filter((x) => x.id !== id) })),
    [],
  );

  const value = useMemo<CloudContextValue>(
    () => ({
      ...state,
      ready,
      jobs,
      syncing,
      requestConnect,
      disconnect,
      startExport,
      retryJob,
      downloadAgain,
      clearHistory,
      addSchedule,
      updateSchedule,
      removeSchedule,
      runScheduleNow,
      addShare,
      removeShare,
      stopLiveSync,
    }),
    [
      state,
      ready,
      jobs,
      syncing,
      requestConnect,
      disconnect,
      startExport,
      retryJob,
      downloadAgain,
      clearHistory,
      addSchedule,
      updateSchedule,
      removeSchedule,
      runScheduleNow,
      addShare,
      removeShare,
      stopLiveSync,
    ],
  );

  return (
    <CloudContext.Provider value={value}>
      {children}
      {connectRequest && <ConnectDialog integrationId={connectRequest.id} onDone={finishConnect} />}
    </CloudContext.Provider>
  );
}

export function useCloud(): CloudContextValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used within CloudProvider");
  return ctx;
}
