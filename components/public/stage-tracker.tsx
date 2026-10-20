import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ElectionStage } from "@/lib/types";

const steps = ["Applications", "Eligibility", "Campaign Prep", "Campaign", "Debate & Q&A", "Silence", "Election Day", "Results"];

const index: Record<ElectionStage, number> = {
  applications_not_open: -1,
  applications_open: 0,
  eligibility_review: 1,
  campaign_preparation: 2,
  official_campaign: 3,
  debate_qa: 4,
  election_silence: 5,
  election_day: 6,
  results_published: 7,
  election_completed: 8,
};

export function stageIndex(stage?: ElectionStage | null) {
  return stage ? index[stage] ?? -1 : -1;
}

export function StageTracker({ stage }: { stage?: ElectionStage | null }) {
  const current = stageIndex(stage);
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {steps.map((label, i) => {
        const done = i < current;
        const live = i === current;
        return (
          <li
            key={label}
            className={cn(
              "relative rounded-lg border-2 p-3",
              live ? "border-danger bg-danger text-white shadow-lg" : done ? "border-primary bg-primary text-white" : "border-border bg-card text-navy/60",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
              {done ? <Check className="h-4 w-4" /> : live ? <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">Live</span> : null}
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
