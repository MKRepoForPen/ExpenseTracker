import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_STYLES } from "@/lib/types";
import type { ExportFormat, ExportFormatId, ExportPayload } from "./types";

function csvCell(value: string): string {
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const csv: ExportFormat = {
  id: "csv",
  label: "CSV",
  extension: "csv",
  mimeType: "text/csv;charset=utf-8",
  description: "Spreadsheet-ready. Opens in Excel, Numbers and Google Sheets.",
  async build({ expenses }) {
    const lines = [
      "Date,Category,Amount,Description",
      ...expenses.map((e) => [e.date, e.category, e.amount.toFixed(2), csvCell(e.description)].join(",")),
    ];
    // BOM so Excel detects UTF-8.
    return new Blob(["﻿" + lines.join("\r\n")], { type: this.mimeType });
  },
};

const json: ExportFormat = {
  id: "json",
  label: "JSON",
  extension: "json",
  mimeType: "application/json",
  description: "Structured data with metadata. Ideal for backups and developers.",
  async build({ expenses, summary, options, generatedAt }) {
    const doc = {
      meta: {
        app: "Spendwise",
        schemaVersion: 1,
        exportedAt: generatedAt.toISOString(),
        filters: {
          startDate: options.startDate || null,
          endDate: options.endDate || null,
          categories: options.categories,
          sort: options.sort,
        },
      },
      summary,
      expenses: expenses.map(({ id, date, category, amount, description, createdAt, updatedAt }) => ({
        id,
        date,
        category,
        amount,
        description,
        createdAt,
        updatedAt,
      })),
    };
    return new Blob([JSON.stringify(doc, null, 2)], { type: this.mimeType });
  },
};

const pdf: ExportFormat = {
  id: "pdf",
  label: "PDF",
  extension: "pdf",
  mimeType: "application/pdf",
  description: "A formatted report with totals and a category breakdown. Ready to print or share.",
  async build(payload) {
    // Loaded on demand: keeps ~100 kB of PDF code out of the main bundle.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    return buildPdf(payload, jsPDF, autoTable);
  },
};

export const EXPORT_FORMATS: Record<ExportFormatId, ExportFormat> = { csv, json, pdf };
export const EXPORT_FORMAT_LIST = [csv, json, pdf];

// --- PDF report -------------------------------------------------------------

const INK = [15, 23, 42] as const; // slate-900
const MUTED = [100, 116, 139] as const; // slate-500
const BRAND = [79, 70, 229] as const; // brand-600

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** autoTable's columnStyles skip head/foot rows; right-align those to sit over their numbers. */
function alignNumericHeaders(columns: number[]) {
  return (data: { section: string; column: { index: number }; cell: { styles: { halign: unknown } } }) => {
    if (data.section !== "body" && columns.includes(data.column.index)) data.cell.styles.halign = "right";
  };
}

function describeRange(start: string, end: string): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Through ${formatDate(end)}`;
  return "All dates";
}

function buildPdf(
  { expenses, summary, options, generatedAt }: ExportPayload,
  JsPDF: typeof import("jspdf").jsPDF,
  autoTable: typeof import("jspdf-autotable").default,
): Blob {
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...INK);
  doc.text("Expense Report", margin, 56);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
  doc.text(`Generated ${generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`, margin, 74);
  doc.text("Spendwise", pageW - margin, 56, { align: "right" });

  // Filter line
  const allCats = options.categories.length === Object.keys(CATEGORY_STYLES).length;
  doc.setFontSize(9);
  doc.text(
    `Period: ${describeRange(options.startDate, options.endDate)}    Categories: ${allCats ? "All" : options.categories.join(", ")}`,
    margin,
    92,
    { maxWidth: pageW - margin * 2 },
  );

  // Stat tiles
  const tiles: [string, string][] = [
    ["Total spent", formatCurrency(summary.total)],
    ["Transactions", String(summary.count)],
    ["Average", formatCurrency(summary.average)],
    ["Date span", summary.earliest ? `${formatDate(summary.earliest)} – ${formatDate(summary.latest!)}` : "—"],
  ];
  const gap = 10;
  const tileW = (pageW - margin * 2 - gap * 3) / 4;
  const tileY = 110;
  tiles.forEach(([label, value], i) => {
    const x = margin + i * (tileW + gap);
    doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240);
    doc.roundedRect(x, tileY, tileW, 52, 6, 6, "FD");
    doc.setFontSize(8).setTextColor(...MUTED).text(label.toUpperCase(), x + 10, tileY + 18);
    doc.setFont("helvetica", "bold").setFontSize(i === 3 ? 8.5 : 13).setTextColor(...INK);
    doc.text(value, x + 10, tileY + 38, { maxWidth: tileW - 16 });
    doc.setFont("helvetica", "normal");
  });

  // Category breakdown
  autoTable(doc, {
    startY: tileY + 76,
    margin: { left: margin, right: margin },
    head: [["Category", "Transactions", "Total", "Share"]],
    body: summary.byCategory.map((r) => [
      r.category,
      String(r.count),
      formatCurrency(r.total),
      summary.total > 0 ? `${((r.total / summary.total) * 100).toFixed(1)}%` : "0%",
    ]),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 6, textColor: [...INK] },
    headStyles: { textColor: [...MUTED], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellPadding: { top: 6, right: 6, bottom: 6, left: 18 } },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: alignNumericHeaders([1, 2, 3]),
    didDrawCell: (data) => {
      // Category color swatch, matching the in-app chart.
      if (data.section === "body" && data.column.index === 0) {
        const cat = summary.byCategory[data.row.index]?.category;
        if (!cat) return;
        doc.setFillColor(...hexToRgb(CATEGORY_STYLES[cat].color));
        doc.circle(data.cell.x + 8, data.cell.y + data.cell.height / 2, 3, "F");
      }
    },
  });

  // Transactions
  // jspdf-autotable records where the last table ended on the doc instance.
  const afterBreakdown = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
  doc.text("Transactions", margin, afterBreakdown + 32);

  autoTable(doc, {
    startY: afterBreakdown + 42,
    margin: { left: margin, right: margin, bottom: 48 },
    head: [["Date", "Category", "Description", "Amount"]],
    body: expenses.map((e) => [formatDate(e.date), e.category, e.description, formatCurrency(e.amount)]),
    foot: [["", "", "Total", formatCurrency(summary.total)]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5, textColor: [...INK], overflow: "linebreak" },
    headStyles: { fillColor: [...BRAND], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [...INK], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 90 }, 3: { halign: "right", cellWidth: 80 } },
    showFoot: "lastPage",
    didParseCell: alignNumericHeaders([3]),
  });

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }

  return doc.output("blob");
}
