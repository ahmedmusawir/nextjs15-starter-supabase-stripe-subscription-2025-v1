export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pbmName = url.searchParams.get("pbmName");
    if (!pbmName) {
      return NextResponse.json({ error: "Missing pbmName" }, { status: 400 });
    }

    const supa = createAdminClient();
    const { data, error } = await supa
      .from("pharma_pbm_info")
      .select("email")
      .eq("pbm_name", pbmName)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: `PBM lookup failed: ${error.message}` }, { status: 500 });
    }

    const email = Array.isArray(data) && data.length > 0 ? (data[0] as any).email as string : undefined;
    if (!email) {
      return NextResponse.json({ error: `No email found for PBM: ${pbmName}` }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
