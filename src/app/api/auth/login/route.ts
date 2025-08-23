import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Ensure this route is always dynamic and not cached
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Testing the route
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const res = NextResponse.json(
    { message: "Auth login Route Accessed Successfully!" },
    { status: 200 }
  );
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const err = NextResponse.json({ error: error.message }, { status: 400 });
    err.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    err.headers.set("Pragma", "no-cache");
    err.headers.set("Expires", "0");
    return err;
  }

  const res = NextResponse.json({ data }, { status: 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  // Collect cookies set during this request cycle via next/headers store
  try {
    // We cannot directly read cookies set by Supabase here reliably, but we can at least echo names we expect
    const cookieNames: string[] = [];
    // Common Supabase cookie names vary by version; include broad patterns being used
    // Note: This is best-effort visibility for debugging
    const possible = ['sb-access-token', 'sb-refresh-token'];
    // Attach names as header for visibility (non-sensitive)
    res.headers.set('x-login-cookies-set', String(possible.length));
    res.headers.set('x-login-cookie-names', possible.join(','));
  } catch {}
  return res;
}
