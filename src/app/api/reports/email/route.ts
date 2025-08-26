export const runtime = "nodejs";
import { NextRequest } from "next/server";
import MailComposer from "mailcomposer";
import { createAdminClient } from "@/utils/supabase/admin";
import { Buffer } from "node:buffer";

type EmailPayload = {
  tab: "commercial" | "updated" | "federal" | "summary";
  dateFrom: string | null;
  dateTo: string | null;
  pbmName: string;
  pdfPaths?: string[]; // e.g., ["frank_pharmacy/report_commercialdollars/...pdf"] without bucket
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EmailPayload;
    const { tab, dateFrom, dateTo, pbmName } = body || {} as EmailPayload;
    if (!pbmName) {
      return jsonError(400, "Missing pbmName");
    }

    // Fetch PBM email from DB
    const supa = createAdminClient();
    const { data: pbmRows, error: pbmErr } = await supa
      .from("pharma_pbm_info")
      .select("email")
      .eq("pbm_name", pbmName)
      .limit(1);
    if (pbmErr) return jsonError(500, `PBM lookup failed: ${pbmErr.message}`);
    const pbmEmail = Array.isArray(pbmRows) && pbmRows.length > 0 ? (pbmRows[0] as any).email as string : undefined;
    if (!pbmEmail) return jsonError(404, `No email found for PBM: ${pbmName}`);

    // Compose subject/body (parity with desktop style)
    const range = [dateFrom, dateTo].filter(Boolean).join(" to ");
    const subject = `${pbmName} ${labelForTab(tab)} Report${range ? ` ${range}` : ""}`.trim();
    const textBody = `Hello ${pbmName},\n\nPlease find attached the ${labelForTab(tab)} report${range ? ` for ${range}` : ""}.\n\nThank you,\nCyber Pharma`;

    // Collect attachments from Storage (if provided)
    const bucket = "pharma_reports";
    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    if (Array.isArray(body.pdfPaths)) {
      for (const relPath of body.pdfPaths) {
        // relPath should start with "<pharmacy_slug>/...pdf" or include report folder already
        const path = relPath.startsWith("/") ? relPath.slice(1) : relPath;
        const { data, error } = await supa.storage.from(bucket).download(path);
        if (error) return jsonError(500, `Failed to download ${path}: ${error.message}`);
        const arrBuf = await data.arrayBuffer();
        const buff = Buffer.from(arrBuf);
        const filename = path.split("/").pop() || "report.pdf";
        attachments.push({ filename, content: buff, contentType: "application/pdf" });
      }
    }

    // Build EML for user's desktop email client
    const mail = new MailComposer({
      from: "noreply@cyberpharma.local", // envelope only; user will send from their client
      to: pbmEmail,
      subject,
      text: textBody,
      attachments,
    });

    const emlBuffer: Buffer = await new Promise((resolve, reject) => {
      mail.compile().build((err, message) => (err ? reject(err) : resolve(message)));
    });

    const fileName = `${sanitizeFile(subject)}.eml`;
    return new Response(emlBuffer, {
      status: 200,
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return jsonError(500, err?.message || "Internal error");
  }
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function labelForTab(tab: EmailPayload["tab"]) {
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

function sanitizeFile(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}
