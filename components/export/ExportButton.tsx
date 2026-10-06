"use client";

import { useExportCenter } from "./ExportCenter";
import type { ExportSeed } from "./useExportState";

/** Opens the export drawer, optionally pre-filled with the current page's filters. */
export function ExportButton({ seed }: { seed?: ExportSeed }) {
  const { openExport } = useExportCenter();
  return (
    <button onClick={() => openExport(seed)} className="btn-secondary">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      Export…
    </button>
  );
}
