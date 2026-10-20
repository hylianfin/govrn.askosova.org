import { CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

const STYLE = {
  approved: { icon: CheckCircle2, title: "Your application was approved", cls: "border-success/40 bg-success/10 text-success" },
  rejected: { icon: XCircle, title: "Your application was denied", cls: "border-danger/40 bg-danger/10 text-danger" },
  changes_requested: { icon: MessageSquareWarning, title: "Staff asked for changes", cls: "border-warning/40 bg-warning/10 text-warning" },
} as const;

export async function ReviewFeedback({ applicationId, status }: { applicationId: string; status: string }) {
  if (!["approved", "rejected", "changes_requested"].includes(status)) return null;
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("application_reviews").select("decision, reason, decided_at")
    .eq("application_id", applicationId).eq("decision", status).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const s = STYLE[status as keyof typeof STYLE];
  return (
    <div role="status" className={cn("mx-auto flex w-full max-w-3xl items-start gap-3 rounded-lg border px-4 py-3", s.cls)}>
      <s.icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 text-foreground">
        <p className={cn("text-sm font-semibold", s.cls.split(" ").pop())}>{s.title}</p>
        {review?.reason
          ? <p className="mt-1 whitespace-pre-line text-sm">{review.reason}</p>
          : status === "changes_requested" && <p className="mt-1 text-sm">Update your answers and submit again.</p>}
      </div>
    </div>
  );
}
