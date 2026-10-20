import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createMockClient } from "@/lib/supabase/mock";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

export async function createClient(): Promise<any> {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    return createMockClient() as any;
  }
  const cookieStore = await cookies();
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context; ignore.
          }
        },
      },
    },
  );
}

export function createAdminClient() {
  // Service role client for server-only privileged operations.
  // Never expose to the browser.
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}