"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/ExpenseForm";
import { DEMO_ACCOUNT, INTEGRATIONS } from "@/lib/cloud/integrations";
import type { IntegrationId } from "@/lib/cloud/types";
import { ServiceTile } from "./ui";

const SCOPES: Record<string, string[]> = {
  spreadsheet: [
    "Create spreadsheets in your account",
    "Update spreadsheets Spendwise created",
    "No access to your other files",
  ],
  storage: [
    "Create a Spendwise folder",
    "Upload and replace export files in it",
    "No access to files outside that folder",
  ],
};

/** A simulated OAuth consent step. Deliberately Spendwise-branded: we never mimic a provider's own sign-in page. */
export function ConnectDialog({
  integrationId,
  onDone,
}: {
  integrationId: IntegrationId;
  onDone: (ok: boolean) => void;
}) {
  const integration = INTEGRATIONS[integrationId];
  const [phase, setPhase] = useState<"consent" | "connecting">("consent");

  const allow = async () => {
    setPhase("connecting");
    await new Promise((r) => setTimeout(r, 1300));
    onDone(true);
  };

  return (
    <Modal open title={`Connect ${integration.name}`} onClose={() => phase === "consent" && onDone(false)} size="sm">
      {phase === "consent" ? (
        <div>
          <div className="mb-5 flex items-center justify-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              $
            </span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              ))}
            </span>
            <ServiceTile integration={integration} size="lg" />
          </div>
          <p className="text-center text-sm text-slate-600">
            Spendwise is requesting access to <strong className="text-slate-900">{integration.name}</strong> as{" "}
            <strong className="text-slate-900">{DEMO_ACCOUNT}</strong>.
          </p>
          <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {(SCOPES[integration.kind] ?? []).map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo mode: this connection is simulated. No account is accessed and no data leaves your browser.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button onClick={() => onDone(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={allow} className="btn-primary">
              Allow access
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center" aria-live="polite">
          <span className="text-brand-600">
            <Spinner />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-900">Connecting to {integration.name}…</p>
          <p className="mt-1 text-xs text-slate-500">Exchanging authorization tokens</p>
        </div>
      )}
    </Modal>
  );
}
