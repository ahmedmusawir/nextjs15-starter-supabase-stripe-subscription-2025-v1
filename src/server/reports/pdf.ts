// Use the standalone build which bundles the standard fonts and avoids fs reads
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { Buffer } from "node:buffer";

export type ReportRow = {
  script?: string;
  date?: string | null;
  ndc?: string | null;
  drugName?: string | null;
  qty?: number | null;
  expected?: number | undefined;
  paid?: number | null;
  owed?: number | undefined;
  method?: string | null;
  pbmName?: string | null;
};

export type PdfBuildOptions = {
  title: string;
  subtitle?: string;
  columns?: Array<{ key: keyof ReportRow; label: string; width?: number }>;
  maxRowsPerFile?: number; // for splitting
};

// Generate a single PDF buffer. For now we keep it simple; splitting can be added later.
export async function generateReportPdfBuffer(
  rows: ReportRow[],
  opts: PdfBuildOptions
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: true, margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (c: Buffer) => chunks.push(c));

  // Header
  doc.fontSize(18).text(opts.title, { align: "left" });
  if (opts.subtitle) {
    doc.moveDown(0.2).fontSize(11).text(opts.subtitle, { align: "left" });
  }
  doc.moveDown(0.6);

  // Table header
  const columns =
    opts.columns || [
      { key: "date", label: "Date", width: 80 },
      { key: "script", label: "Script", width: 70 },
      { key: "ndc", label: "NDC", width: 90 },
      { key: "drugName", label: "Drug", width: 180 },
      { key: "qty", label: "Qty", width: 40 },
      { key: "expected", label: "Expected", width: 80 },
      { key: "paid", label: "Paid", width: 70 },
      { key: "owed", label: "Owed", width: 70 },
      { key: "method", label: "Method", width: 60 },
    ];

  doc.fontSize(10);
  const widths: number[] = columns.map((c) => c.width ?? 80);
  drawRow(doc, columns.map((c) => c.label), widths);
  drawHr(doc);

  const formatCurrency = (v: any) =>
    typeof v === "number" ? `$${v.toFixed(2)}` : v === undefined ? "" : String(v ?? "");

  for (const r of rows) {
    const vals = columns.map((c) => {
      const v: any = (r as any)[c.key];
      if (c.key === "expected" || c.key === "paid" || c.key === "owed") return formatCurrency(v);
      return v ?? "";
    });
    drawRow(doc, vals, widths);
  }

  doc.end();

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks as unknown as readonly Uint8Array[])));
    doc.on("error", (err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

function drawRow(doc: any, values: any[], widths?: number[]) {
  const padX = 4;
  let x = doc.page.margins.left;
  const y = doc.y;
  values.forEach((v, i) => {
    const w = (widths && widths[i]) || 80;
    doc.text(String(v ?? ""), x + padX, y, { width: w - padX * 2, continued: false });
    x += w;
  });
  doc.moveDown(0.4);
}

function drawHr(doc: any) {
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke("#999");
  doc.moveDown(0.4);
}
