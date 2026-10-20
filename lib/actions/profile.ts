"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().min(2),
  gradeLevel: z.coerce.number().min(9).max(12).optional(),
  homeroom: z.string().optional(),
});

export async function updateProfile(prev: { error?: string; success?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    gradeLevel: formData.get("gradeLevel") || undefined,
    homeroom: formData.get("homeroom") || undefined,
  });
  if (!parsed.success) return { error: "Invalid details." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    grade_level: parsed.data.gradeLevel ?? null,
    homeroom: parsed.data.homeroom ?? null,
  }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/profile");
  return { success: "Profile updated." };
}