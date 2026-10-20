import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows the redirect with GET; origin comes from the request, not an env var.
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
