import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies() as unknown as any;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  // If running on plain http (e.g., local prod with next start), secure cookies will be dropped by the browser.
  // Decide secure flag based on protocol in site URL; default to false when unknown.
  const secure = siteUrl.startsWith('https://');

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure } as CookieOptions,
      cookies: {
        getAll() {
          return (cookieStore as any).getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            (cookieStore as any).set(name, value, options)
          );
        },
      },
    }
  );
}
