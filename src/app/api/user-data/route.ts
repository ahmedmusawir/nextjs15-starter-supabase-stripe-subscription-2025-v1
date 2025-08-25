// src/app/api/user-data/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Limit which sort keys we allow directly from DB
const ALLOWED_SORT_KEYS = new Set<
  | "date_dispensed"
  | "qty"
  | "total_paid"
  | "new_paid"
  | "script"
  | "drug_ndc"
  | "drug_name"
  | "bin"
>();

type Row = {
  script: string;
  pharmacy_id: string;
  date_dispensed: string | null;
  drug_ndc: string | null;
  drug_name: string | null;
  qty: number | null;
  total_paid: number | null;
  new_paid: number | null;
  bin: string | null;
  pdf_file: string | null;
  status: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const script = params.get("script");
    const ndc = params.get("ndc");
    const drug = params.get("drug");
    const bin = params.get("bin");
    const status = params.get("status");

    // Sidebar filters
    const owedType = params.get("owedType"); // underpaid | overpaid | all
    const methodParam = params.get("method"); // AAC | WAC
    const pbmFilter = params.get("pbm"); // PBM name filter

    const sortKey = (params.get("sortKey") || "date_dispensed") as any;
    const sortDir = (params.get("sortDir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const page = Math.max(parseInt(params.get("page") || "1", 10), 1);
    // TEMP: allow larger page sizes to support 'show all' on dashboard; we will restore a lower cap later
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") || "25", 10), 1),
      10000
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createClient();
    // Ensure caller is authenticated; otherwise RLS will silently return 0 rows.
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    if (!authData?.user) {
      return NextResponse.json(
        { error: "Unauthorized: no session found" },
        { status: 401 }
      );
    }

    // Use derived-first pagination approach (batch, enrich, filter, then paginate)
    const batchSize = 1000;
    let start = 0;
    let allFilteredRows: any[] = [];

    while (true) {
      let q = supabase
        .from("pharma_user_data")
        .select("*")
        .order("date_dispensed", { ascending: sortDir === "asc" })
        .order("script", { ascending: true, nullsFirst: false })
        .range(start, start + batchSize - 1) as any;

      if (dateFrom) q = q.gte("date_dispensed", dateFrom);
      if (dateTo) q = q.lte("date_dispensed", dateTo);
      if (script) q = q.ilike("script", `%${script}%`);
      if (ndc) q = q.ilike("drug_ndc", `%${ndc}%`);
      if (drug) q = q.ilike("drug_name", `%${drug}%`);
      if (bin) q = q.eq("bin", bin);
      if (status) q = q.eq("status", status);

      const { data: batch, error } = await q;
      if (error) throw error;
      if (!batch || batch.length === 0) break;

      const processedBatch = await processBatch(batch as Row[], supabase, owedType, methodParam, pbmFilter);
      allFilteredRows.push(...processedBatch);

      if (batch.length < batchSize) break;
      start += batchSize;
    }

    // Apply pagination to filtered results
    const totalDerived = allFilteredRows.length;
    const pageStart = (page - 1) * limit;
    const pageEnd = pageStart + limit;
    const pageRows = allFilteredRows.slice(pageStart, pageEnd);

    const response = {
      rows: pageRows,
      total: totalDerived, // Use derived total for pagination
      totalAfterDerivedFilters: totalDerived,
      page,
      limit,
    };


    return NextResponse.json(response);
  } catch (e: any) {
    console.error("/api/user-data GET error", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

async function processBatch(
  batch: Row[],
  supabase: any,
  owedType?: string | null,
  methodParam?: string | null,
  pbmFilter?: string | null
) {

  // Collect keys for enrichment
  const ndcs = Array.from(new Set(batch.map(r => r.drug_ndc).filter(Boolean))) as string[];
  const bins = Array.from(new Set(batch.map(r => r.bin).filter(Boolean))) as string[];

  // Fetch baseline (AAC) for all collected NDCs
  const baselineMap = new Map<string, { aac: number; drug_name?: string | null }>();
  if (ndcs.length > 0) {
    const { data: baselineRows, error: baseErr } = await supabase
      .from("pharma_baseline")
      .select("ndc,aac,drug_name")
      .in("ndc", ndcs);
    if (baseErr) throw baseErr;
    for (const b of baselineRows || []) {
      baselineMap.set(b.ndc, { aac: typeof b.aac === "number" ? b.aac : parseFloat(b.aac), drug_name: b.drug_name });
    }
  }

  // Fetch alt rates (WAC)
  const altMap = new Map<string, { wac: number; pkg_size: number; pkg_size_mult: number; generic_indicator: string }>();
  if (ndcs.length > 0) {
    const { data: altRows, error: altErr } = await supabase
      .from("pharma_alt_rates")
      .select("ndc,wac,pkg_size,pkg_size_mult,generic_indicator")
      .in("ndc", ndcs);
    if (altErr) throw altErr;
    for (const a of altRows || []) {
      altMap.set(a.ndc, { 
        wac: typeof a.wac === "number" ? a.wac : parseFloat(a.wac),
        pkg_size: typeof a.pkg_size === "number" ? a.pkg_size : parseFloat(a.pkg_size || "0"),
        pkg_size_mult: typeof a.pkg_size_mult === "number" ? a.pkg_size_mult : parseFloat(a.pkg_size_mult || "0"),
        generic_indicator: a.generic_indicator || ""
      });
    }
  }

  // Fetch PBM info
  const pbmMap = new Map<string, { pbm_name?: string | null }>();
  if (bins.length > 0) {
    const { data: pbmRows, error: pbmErr } = await supabase
      .from("pharma_pbm_info")
      .select("bin,pbm_name")
      .in("bin", bins);
    if (pbmErr) throw pbmErr;
    for (const p of pbmRows || []) {
      pbmMap.set(p.bin, { pbm_name: p.pbm_name });
    }
  }

  // Enrich + derive expected/owed/method over the batch
  const enriched = batch.map(r => {
    const ndcKey = r.drug_ndc || "";
    const base = ndcKey ? baselineMap.get(ndcKey) : undefined;
    const alt = ndcKey ? altMap.get(ndcKey) : undefined;

    const qty = typeof r.qty === "number" ? r.qty : r.qty ? Number(r.qty) : 0;
    const paid = typeof r.total_paid === "number" ? r.total_paid : r.total_paid ? Number(r.total_paid) : 0;

    let aac: number | undefined = base?.aac;
    let wac: number | undefined = alt?.wac;
    let method: "AAC" | "WAC" | "Other" = "Other";
    
    // Python logic: prefer AAC, fallback to computed WAC
    if (typeof aac === "number" && !Number.isNaN(aac) && aac > 0) {
      method = "AAC";
    } else if (typeof alt?.wac === "number" && !Number.isNaN(alt.wac) && alt.wac > 0 &&
               typeof alt?.pkg_size === "number" && alt.pkg_size > 0 &&
               typeof alt?.pkg_size_mult === "number" && alt.pkg_size_mult > 0) {
      method = "WAC";
      const gi = (alt.generic_indicator || "").toString().trim().toUpperCase();
      if (gi === "N") {
        // Brand: 0.96 * WAC / (pkg_size * pkg_size_mult)
        aac = (alt.wac * 0.96) / (alt.pkg_size * alt.pkg_size_mult);
      } else {
        // Generic: WAC / (pkg_size * pkg_size_mult)
        aac = alt.wac / (alt.pkg_size * alt.pkg_size_mult);
      }
    }

    // Python: expected_paid = qty * aac + FIXED_FEE
    const FIXED_FEE = 10.64;
    const expected = aac !== undefined ? (qty * aac + FIXED_FEE) : undefined;
    // Python: difference = total_paid - expected_paid
    const difference = expected !== undefined ? paid - expected : undefined;
    const owed = difference !== undefined ? -difference : undefined; // Convert to our owed convention

    const pbmName = r.bin ? pbmMap.get(r.bin)?.pbm_name || "Federal" : "Federal";
    const isFederal = pbmName === "Federal"; // Python fills missing PBM as 'Federal'

    return {
      script: r.script,
      date: r.date_dispensed || null,
      ndc: r.drug_ndc || "",
      drugName: r.drug_name || base?.drug_name || "",
      qty,
      aac,
      wac,
      method,
      expected,
      paid,
      newPaid: r.new_paid ?? null,
      owed,
      bin: r.bin || null,
      pbmName: pbmName || null,
      report: null,
      status: r.status || null,
      pdfUrl: r.pdf_file || null,
    };
  });

  // Apply derived filters (matching Python logic)
  let finalRows = enriched;
  
  // Only count rows with AAC available (same as Python/KPIs)
  finalRows = finalRows.filter(r => r.expected !== undefined);
  
  // REMOVED: Don't filter out Federal data - we need it for Federal Dollars tab
  
  // 1. Owed Type filter (underpaid/overpaid)
  if (owedType === "underpaid") {
    finalRows = finalRows.filter(r => {
      return typeof r.owed === "number" && r.owed > 0;
    });
  } else if (owedType === "overpaid") {
    finalRows = finalRows.filter(r => {
      return typeof r.owed === "number" && r.owed < 0;
    });
  }
  // owedType === "all" or null/undefined = no filter
  
  // 2. Method filter (AAC/WAC)
  if (methodParam === "AAC" || methodParam === "WAC") {
    finalRows = finalRows.filter(r => r.method === methodParam);
  }
  
  // 3. PBM filter
  if (pbmFilter && pbmFilter !== "All") {
    finalRows = finalRows.filter(r => r.pbmName === pbmFilter);
  }

  return finalRows;
}
