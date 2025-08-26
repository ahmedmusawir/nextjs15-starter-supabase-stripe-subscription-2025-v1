export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { Buffer } from "node:buffer";
import { generateReportPdfBuffer, type ReportRow } from "@/server/reports/pdf";
import { buildReportFilename, slugify } from "@/utils/slug";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createServerClient } from "@/utils/supabase/server";

type SavePayload = {
  tab: "commercial" | "updated" | "federal" | "summary";
  dateFrom: string | null; // YYYY-MM-DD | null
  dateTo: string | null;   // YYYY-MM-DD | null
  pbmName: string;
  rows: ReportRow[];
  // Optional escape hatch: if true, return direct download (no auth upload)
  noAuthDownload?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SavePayload;
    const { tab, dateFrom, dateTo, pbmName, rows, noAuthDownload } = body || ({} as SavePayload);
    if (!tab || !pbmName || !Array.isArray(rows)) {
      return jsonError(400, "Missing required fields: tab, pbmName, rows");
    }

    const folder = folderForTab(tab);
    const pbmSlug = slugify(pbmName);

    const title = `${labelForTab(tab)} Report`;
    const range = [dateFrom || undefined, dateTo || undefined].filter(Boolean).join(" to ");
    const subtitle = range ? `${pbmName} — ${range}` : `${pbmName}`;
    const pdf = await generateReportPdfBuffer(rows, {
      title,
      subtitle,
    });

    if (noAuthDownload) {
      // Explicitly requested a direct download (no auth / no upload)
      const filename = buildReportFilename({ folder, pbmSlug, from: dateFrom || 'na', to: dateTo || 'na' });
      return new Response(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Derive pharmacy slug from authenticated user
    const ssr = await createServerClient();
    const {
      data: { user },
      error: userErr,
    } = await ssr.auth.getUser();
    if (userErr || !user) return jsonError(401, "Not authenticated");

    const supa = createAdminClient();
    const pharmacySlug = await getPharmacySlugForUser(supa, user.id);
    if (!pharmacySlug) return jsonError(403, "No pharmacy slug found for current user");
    const bucket = "pharma_reports";
    const filename = buildReportFilename({ folder, pbmSlug, from: dateFrom || 'na', to: dateTo || 'na' });
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
      return "report_updatedcommercialdollars";
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

// Resolve the current user's pharmacy slug using known tables.
async function getPharmacySlugForUser(supa: ReturnType<typeof createAdminClient>, userId: string) {
  console.debug(`[getPharmacySlugForUser] Looking up slug for userId: ${userId}`);
  
  // 1) Check pharma_pharmacy_members to get pharmacy_id for the user
  {
    console.debug(`[getPharmacySlugForUser] Checking pharma_pharmacy_members...`);
    const { data, error } = await supa
      .from("pharma_pharmacy_members")
      .select("pharmacy_id")
      .eq("user_id", userId)
      .maybeSingle();
    console.debug(`[getPharmacySlugForUser] pharma_pharmacy_members result:`, { data, error });
    if (!error && data) {
      const pharmacyId = (data as any)?.pharmacy_id as string | number | null | undefined;
      if (pharmacyId) {
        console.debug(`[getPharmacySlugForUser] Found pharmacy_id in pharma_pharmacy_members: ${pharmacyId}, looking up in pharma_pharmacy_profile...`);
        const { data: pharm, error: pharmErr } = await supa
          .from("pharma_pharmacy_profile")
          .select("pharmacy_slug")
          .eq("pharmacy_id", pharmacyId)
          .maybeSingle();
        console.debug(`[getPharmacySlugForUser] pharma_pharmacy_profile result:`, { pharm, pharmErr });
        if (!pharmErr && (pharm as any)?.pharmacy_slug) {
          const foundSlug = (pharm as any).pharmacy_slug as string;
          console.debug(`[getPharmacySlugForUser] Found slug via pharmacy_id: ${foundSlug}`);
          return foundSlug;
        }
      }
    }
  }
  
  console.debug(`[getPharmacySlugForUser] No slug found for userId: ${userId}`);
  return null;
}
