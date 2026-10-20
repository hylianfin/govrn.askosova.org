import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the link in the confirmation email: swaps the one-time code for a session, then sends the person on.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, origin));
  }
  // Link expired or already used: the email may still be confirmed, so signing in is the next step.
  return NextResponse.redirect(new URL("/sign-in", origin));
}
