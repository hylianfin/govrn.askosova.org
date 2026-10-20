import { VoteCountingConsole } from "@/app/demo/vote-counting/console";

// A sandbox with sample data, so the team can learn the counting screens before election day. Nothing here is saved.
export default function PracticePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
        Practice mode with sample data. Nothing you do here touches the real election.
      </div>
      <VoteCountingConsole />
    </div>
  );
}
