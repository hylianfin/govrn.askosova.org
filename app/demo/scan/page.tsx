import { DashboardShell } from "@/components/dashboard-shell";
import { staffNav } from "@/lib/nav";
import { PageHeader } from "@/components/dashboard/primitives";
import { ScannerDemo } from "@/components/scan/scanner-demo";

// Test page for reading paper ballots with a camera. Nothing here touches the real count.
export default function ScanDemoPage() {
  return (
    <DashboardShell title="Staff" nav={staffNav()} userName="Demo user" roleLabel="Preview">
      <div className="space-y-6">
        <PageHeader eyebrow="Test page" title="Ballot scanner" description="Point a camera at a paper ballot, or upload a photo. It finds the ballot, finds the checkboxes and shows which ones are marked. Nothing is recorded." />
        <ScannerDemo />
      </div>
    </DashboardShell>
  );
}
