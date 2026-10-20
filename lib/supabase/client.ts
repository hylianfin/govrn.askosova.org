import { createBrowserClient } from "@supabase/ssr";
import { createMockClient } from "@/lib/supabase/mock";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

export function createClient(): any {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    return createMockClient() as any;
  }
  return createBrowserClient(url, key);
}