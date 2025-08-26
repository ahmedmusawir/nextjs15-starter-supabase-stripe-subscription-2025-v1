export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { Buffer } from "node:buffer";
import { generateReportPdfBuffer, type ReportRow } from "@/server/reports/pdf";
import { buildReportFilename, slugify } from "@/utils/slug";
import { createAdminClient } from "@/utils/supabase/admin";

type SavePayload = {
  tab: "commercial" | "updated" | "federal" | "summary";
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  pbmName: string;
  rows: ReportRow[];
  pharmacySlug?: string; // if omitted, we return the PDF download instead of uploading
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SavePayload;
    const { tab, dateFrom, dateTo, pbmName, rows, pharmacySlug } = body || ({} as SavePayload);
    if (!tab || !dateFrom || !dateTo || !pbmName || !Array.isArray(rows)) {
      return jsonError(400, "Missing required fields: tab, dateFrom, dateTo, pbmName, rows");
    }

    const folder = folderForTab(tab);
    const pbmSlug = slugify(pbmName);

    const title = `${labelForTab(tab)} Report`;
    const subtitle = `${pbmName} — ${dateFrom} to ${dateTo}`;
    const pdf = await generateReportPdfBuffer(rows, {
      title,
      subtitle,
    });

    if (!pharmacySlug) {
      // No tenant provided; return the file directly for download
      const filename = buildReportFilename({ folder, pbmSlug, from: dateFrom, to: dateTo });
      return new Response(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const supa = createAdminClient();
    const bucket = "pharma_reports";
    const filename = buildReportFilename({ folder, pbmSlug, from: dateFrom, to: dateTo });
    const storagePath = `${pharmacySlug}/${folder}/${filename}`;

    const { error: uploadErr } = await supa.storage.from(bucket).upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) return jsonError(500, `Upload failed: ${uploadErr.message}`);

    const { data: signed, error: signErr } = await supa.storage.from(bucket).createSignedUrl(storagePath, 60 * 60);
    if (signErr) return jsonError(500, `Signed URL failed: ${signErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, pdfPath: storagePath, signedUrl: signed?.signedUrl || null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return jsonError(500, err?.message || "Internal error");
  }
}

function folderForTab(tab: SavePayload["tab"]) {
  switch (tab) {
    case "commercial":
      return "report_commercialdollars";
    case "updated":
      return "report_updatedpayments";
    case "federal":
      return "report_federaldollars";
    case "summary":
      return "report_summary";
    default:
      return "reports";
  }
}

function labelForTab(tab: SavePayload["tab"]) {
  switch (tab) {
    case "commercial":
      return "Commercial Dollars";
    case "updated":
      return "Updated Commercial Payments";
    case "federal":
      return "Federal Dollars";
    case "summary":
      return "Summary";
    default:
      return "Report";
  }
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
