import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { TreasuryDesk } from "@/components/government/treasury-desk";
import { createClient } from "@/lib/supabase/server";
import { getGovAccess } from "@/lib/queries/government";
export const dynamic = "force-dynamic";
export default async function TreasuryPage() {
  const [access, supabase] = await Promise.all([getGovAccess(), createClient()]);
  const { data: allowed } = access ? await supabase.rpc("can_manage_finance", { uid: access.user.id }) : { data: false };
  const [{ data: events }, { data: entries }] = access ? await Promise.all([supabase.from("treasury_events").select("*").order("created_at", { ascending: false }), supabase.from("treasury_entries").select("amount_cents")]) : [{ data: [] }, { data: [] }];
  const balance = (entries ?? []).reduce((sum: number, row: { amount_cents: number }) => sum + row.amount_cents, 0);
  return <div className="space-y-6"><PageHeader eyebrow="Treasury" title="Event finance" description="Record ticket sales, refunds, expenses and adjustments." />{allowed ? <TreasuryDesk events={(events ?? []) as never[]} balance={balance} /> : events?.length ? <div className="rounded-xl border border-border bg-card p-5"><p className="font-medium">Read-only school finance</p><p className="mt-1 text-sm text-muted-foreground">Your school&apos;s executive team and senators can review these records. Only the Treasurer can edit them.</p><p className="mt-4 font-display text-3xl font-bold text-navy">${(balance / 100).toFixed(2)}</p></div> : <EmptyState>Treasurers and administrators can manage event finances.</EmptyState>}</div>;
}
