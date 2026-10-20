import { DashboardShell } from "@/components/dashboard-shell";
import { staffNav } from "@/lib/nav";
import { VoteCountingConsole } from "./console";

// Preview of the election-day panels with sample data. Nothing here reads from or writes to the database.
export default function VoteCountingConsolePage() {
  return (
    <DashboardShell title="Staff" nav={staffNav()} userName="Demo user" roleLabel="Preview">
      <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
        Preview with sample data. Nothing you do here is saved.
      </div>
      <VoteCountingConsole />
    </DashboardShell>
  );
}
