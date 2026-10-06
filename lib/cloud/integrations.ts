import type { Integration, IntegrationId } from "./types";

export const INTEGRATIONS: Record<IntegrationId, Integration> = {
  download: {
    id: "download",
    name: "This device",
    kind: "local",
    description: "Save the file straight to your downloads folder.",
    requiresAuth: false,
    monogram: "↓",
    tile: "bg-slate-800 text-white",
  },
  email: {
    id: "email",
    name: "Email",
    kind: "message",
    description: "Send the report as an attachment with an inline summary.",
    requiresAuth: false,
    monogram: "@",
    tile: "bg-rose-500 text-white",
  },
  link: {
    id: "link",
    name: "Share link",
    kind: "share",
    description: "A read-only link and QR code. The data travels inside the link itself.",
    requiresAuth: false,
    monogram: "⌁",
    tile: "bg-brand-600 text-white",
  },
  "google-sheets": {
    id: "google-sheets",
    name: "Google Sheets",
    kind: "spreadsheet",
    description: "Create a spreadsheet, or keep one live-synced as you add expenses.",
    requiresAuth: true,
    monogram: "GS",
    tile: "bg-emerald-600 text-white",
  },
  "google-drive": {
    id: "google-drive",
    name: "Google Drive",
    kind: "storage",
    description: "Upload exports into a Drive folder.",
    requiresAuth: true,
    monogram: "GD",
    tile: "bg-amber-500 text-white",
    quotaGb: 15,
  },
  dropbox: {
    id: "dropbox",
    name: "Dropbox",
    kind: "storage",
    description: "Drop exports into your Apps folder.",
    requiresAuth: true,
    monogram: "DB",
    tile: "bg-sky-600 text-white",
    quotaGb: 2,
  },
  onedrive: {
    id: "onedrive",
    name: "OneDrive",
    kind: "storage",
    description: "Store exports alongside your Office documents.",
    requiresAuth: true,
    monogram: "OD",
    tile: "bg-blue-700 text-white",
    quotaGb: 5,
  },
};

export const DESTINATIONS = Object.values(INTEGRATIONS);
export const CLOUD_SERVICES = DESTINATIONS.filter((i) => i.requiresAuth);

export const DEMO_ACCOUNT = "you@example.com";

/** Integrations we show as "coming soon" to suggest the roadmap. */
export const COMING_SOON = [
  { name: "Slack", blurb: "Weekly spending digest in a channel", monogram: "SL", tile: "bg-purple-600 text-white" },
  { name: "Notion", blurb: "Sync expenses into a Notion database", monogram: "N", tile: "bg-slate-900 text-white" },
  { name: "Zapier", blurb: "Trigger 6,000+ apps on new expenses", monogram: "Z", tile: "bg-orange-500 text-white" },
];
