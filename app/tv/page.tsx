import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export default function TvHome() {
  async function open(formData: FormData) { "use server"; const code = String(formData.get("code") ?? "").trim(); const supabase = await createClient(); const { data } = await supabase.rpc("gov_tv_meeting_id", { p_code: code }); if (data) redirect(`/tv/${data}`); }
  return <main className="grid min-h-screen place-items-center bg-black p-6 text-white"><form action={open} className="w-full max-w-lg border border-white/30 p-8"><p className="text-sm font-semibold uppercase tracking-[.2em] text-yellow-300">Meeting display</p><h1 className="mt-3 text-4xl font-bold">Open live TV</h1><p className="mt-3 text-white/65">Enter the four-digit code shown on the meeting.</p><label className="mt-8 block text-sm">Meeting code<input name="code" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000" className="mt-2 h-12 w-full border border-white/30 bg-transparent px-3 text-white outline-none focus:border-yellow-300" /></label><button className="mt-5 h-12 w-full bg-yellow-300 font-semibold text-black">Open display</button></form></main>;
}
