import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/primitives";
import { CandidateEditor, type CandidateList } from "@/components/admin/candidate-editor";

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("candidate_lists");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Election setup" title="Candidates" description="Type or paste the names of who is running. No application or approval needed. They appear on the public Candidates page and on the counting screen." />
      <CandidateEditor lists={(data ?? []) as CandidateList[]} />
    </div>
  );
}
