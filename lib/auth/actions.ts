"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { homeForRoles } from "@/lib/nav";
import { getSiteUrl } from "@/lib/site-url";
import type { Role } from "@/lib/types";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signIn(prevState: { error?: string } | undefined, formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please enter a valid email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  const home = homeForRoles((roleRows ?? []).map((r: { role: Role }) => r.role));
  const requested = (formData.get("next") as string) || "";
  const safe = requested.startsWith("/") && !requested.startsWith("//") ? requested : "";
  // Student pages are not for staff/admin accounts, so they land on their own console instead.
  const next = !safe || (safe.startsWith("/dashboard") && home !== "/dashboard") ? home : safe;
  revalidatePath("/", "layout");
  redirect(next);
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
});

export async function signUp(prevState: { error?: string; success?: string } | undefined, formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { error: "Please check your details and try again." };
  const domain = parsed.data.email.toLowerCase().split("@").pop() ?? "";
  if (domain !== "askosova.org" && !domain.endsWith(".askosova.org")) {
    return { error: "Only askosova.org email addresses can sign up." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${await getSiteUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { success: "Check your email to confirm your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}