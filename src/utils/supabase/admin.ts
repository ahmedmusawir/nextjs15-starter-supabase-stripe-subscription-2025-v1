import { createClient } from "@supabase/supabase-js";

// Server-side admin client (SERVICE ROLE) for Storage + DB writes.
// ATTENTION: Only import this from server code (e.g., route handlers).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY envs");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
