// src/app/api/kpis/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Minimal row shape pulled from pharma_user_data
type Row = {
  script: string;
  date_dispensed: string | null;
  drug_ndc: string | null;
  qty: number | null;
  total_paid: number | null;
  new_paid: number | null;
  bin: string | null;
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

    const owedType = params.get("owedType"); // underpaid | overpaid
    const methodParam = params.get("method"); // AAC | WAC

    const supabase = await createClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    if (!authData?.user) {
      return NextResponse.json({ error: "Unauthorized: no session found" }, { status: 401 });
    }

    // We'll iterate through the dataset in stable order, in batches, and aggregate on the fly
    const batchSize = 1000;
    let start = 0;

    // Aggregates
    // Scripts
    let scriptsAll = 0; // all rows in date/pbm scope (no derived filters)
    let scriptsCommercial = 0; // only rows with PBM != 'federal' (no derived filters)
    let scriptsAllDerived = 0; // rows that pass owedType/method filters
    let scriptsCommercialDerived = 0; // commercial rows that pass owedType/method

    // Owed totals (absolute underpaid sums)
    let underpaidAllAbs = 0; // abs(sum of owed<0 over all)
    let underpaidCommercialAbs = 0; // abs(sum of owed<0 over commercial)
    // Net owed sums (can be positive or negative)
    let owedNetAll = 0;
    let owedNetCommercial = 0;

    // Updated difference TOTAL (commercial rows with new_paid)
    let updatedDiffTotalCommercial = 0;

    while (true) {
      // Base ranged query
      let q = supabase
        .from("pharma_user_data")
        .select("*", { count: "exact" })
        .order("date_dispensed", { ascending: false })
        .order("script", { ascending: true, nullsFirst: false })
        .range(start, start + batchSize - 1) as any;

      if (dateFrom) q = q.gte("date_dispensed", dateFrom);
      if (dateTo) q = q.lte("date_dispensed", dateTo);
      if (script) q = q.ilike("script", `%${script}%`);
      if (ndc) q = q.ilike("drug_ndc", `%${ndc}%`);
      if (drug) q = q.ilike("drug_name", `%${drug}%`);
      if (bin) q = q.eq("bin", bin);
      if (status) q = q.eq("status", status);

      const { data: rows, error } = await q as { data: Row[] | null; error: any };
      if (error) throw error;

      const batch = rows || [];
      if (batch.length === 0) break;

      // Collect keys for this batch
      const ndcs = Array.from(new Set(batch.map(r => r.drug_ndc).filter(Boolean))) as string[];
      const bins = Array.from(new Set(batch.map(r => r.bin).filter(Boolean))) as string[];

      // Fetch baseline AAC
      const baselineMap = new Map<string, { aac: number; drug_name?: string | null }>();
      if (ndcs.length) {
        const { data: baselineRows, error: baseErr } = await supabase
          .from("pharma_baseline")
          .select("ndc,aac,drug_name")
          .in("ndc", ndcs);
        if (baseErr) throw baseErr;
        for (const b of baselineRows || []) {
          baselineMap.set(b.ndc, { aac: typeof b.aac === "number" ? b.aac : parseFloat(b.aac), drug_name: b.drug_name });
        }
      }

      // Fetch alt WAC
      const altMap = new Map<string, { wac: number; pkg_size: number; pkg_size_mult: number; generic_indicator: string }>();
      if (ndcs.length) {
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

      // Fetch PBM names
      const pbmMap = new Map<string, { pbm_name?: string | null }>();
      if (bins.length) {
        const { data: pbmRows, error: pbmErr } = await supabase
          .from("pharma_pbm_info")
          .select("bin,pbm_name")
          .in("bin", bins);
        if (pbmErr) throw pbmErr;
        for (const p of pbmRows || []) pbmMap.set(p.bin, { pbm_name: p.pbm_name });
      }

      for (const r of batch) {
        const qty = typeof r.qty === "number" ? r.qty : r.qty ? Number(r.qty) : 0;
        const paid = typeof r.total_paid === "number" ? r.total_paid : r.total_paid ? Number(r.total_paid) : 0;
        const ndcKey = r.drug_ndc || "";
        const base = ndcKey ? baselineMap.get(ndcKey) : undefined;
        const alt = ndcKey ? altMap.get(ndcKey) : undefined;

        let aac: number | undefined = undefined;
        let method: "AAC" | "WAC" | "Other" = "Other";
        
        // Python logic: prefer AAC, fallback to computed WAC
        if (typeof base?.aac === "number" && !Number.isNaN(base.aac) && base.aac > 0) {
          method = "AAC";
          aac = base.aac;
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
        // Python: difference = total_paid - expected_paid (opposite of our owed)
        const difference = expected !== undefined ? paid - expected : undefined;
        const owed = difference !== undefined ? -difference : undefined; // Convert to our owed convention

        // PBM classification: Federal = no PBM match (like Python)
        const pbmNameRaw = r.bin ? pbmMap.get(r.bin)?.pbm_name : undefined;
        const isFederal = !pbmNameRaw; // Python treats missing PBM as Federal
        const isCommercial = !isFederal;

        // Count scripts (only those with AAC available, like Python)
        const hasPrice = aac !== undefined;
        if (hasPrice) {
          scriptsAll += 1;
          if (isCommercial) scriptsCommercial += 1;
        }

        // Apply derived filters (matching Python's difference logic)
        const passesDerived = (
          (owedType === "underpaid" ? (typeof difference === "number" && difference < 0) : owedType === "overpaid" ? (typeof difference === "number" && difference > 0) : true)
          && (methodParam === "AAC" ? method === "AAC" : methodParam === "WAC" ? method === "WAC" : true)
        );
        if (!passesDerived) continue;

        // Count scripts after derived filters
        if (hasPrice) {
          scriptsAllDerived += 1;
          if (isCommercial) scriptsCommercialDerived += 1;
        }

        // Owed sums (using difference for consistency with Python)
        if (typeof difference === "number" && !Number.isNaN(difference)) {
          // Net sums (Python's difference convention)
          owedNetAll += -difference; // Convert to our owed convention
          if (isCommercial) owedNetCommercial += -difference;
        }
        // Absolute underpaid (when difference < 0, meaning underpaid)
        if (typeof difference === "number" && !Number.isNaN(difference) && difference < 0) {
          const abs = Math.abs(difference);
          underpaidAllAbs += abs;
          if (isCommercial) underpaidCommercialAbs += abs;
        }

        // Updated diff total over commercial rows with new_paid
        if (isCommercial && r.new_paid != null) {
          const np = typeof r.new_paid === "number" ? r.new_paid : Number(r.new_paid);
          const diff = np - paid;
          if (!Number.isNaN(diff)) {
            updatedDiffTotalCommercial += diff;
          }
        }
      }

      if (batch.length < batchSize) break; // exhausted
      start += batchSize;
    }

    return NextResponse.json({
      scriptsAll,
      scriptsCommercial,
      scriptsAllDerived,
      scriptsCommercialDerived,
      underpaidAllAbs,
      underpaidCommercialAbs,
      owedNetAll,
      owedNetCommercial,
      updatedDifferenceTotal: updatedDiffTotalCommercial,
    });
  } catch (e: any) {
    console.error("/api/kpis GET error", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
