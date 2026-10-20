import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { KIND_LABEL, ROLE_LABEL, SCHOOL_LABEL, type LiveRace } from "@/lib/live";

// A replica of the printed ballot, so the person counting sees what is on the paper in their hand.
export function BallotPaper({ race, selected, onToggle, disabled }: { race: LiveRace; selected: string[]; onToggle: (id: string) => void; disabled: boolean }) {
  const exec = race.kind === "exec";
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white text-[#1b2a5e] shadow-sm">
      <div className="mx-6 h-8 rounded-b-xl bg-[#2b3a82]" />
      <div className="relative px-6 pb-6 pt-5">
        <Image src="/images/logo-mark.png" alt="" width={72} height={72} className="absolute right-5 top-3 h-[72px] w-[72px]" />
        <p className="text-2xl font-medium uppercase leading-tight tracking-wide">Vote for<br />{SCHOOL_LABEL[race.school]}</p>
        <p className="text-2xl font-extrabold leading-tight">{KIND_LABEL[race.kind]}</p>
        {!exec && <p className="mt-1 text-[11px] text-[#1b2a5e]/70">(select up to three people)</p>}

        <ul className={cn("mt-5", exec ? "space-y-4" : "space-y-1.5")}>
          {race.candidates.map((c) => {
            const on = selected.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button" disabled={disabled} onClick={() => onToggle(c.id)} aria-pressed={on}
                  className={cn("flex w-full items-start gap-3 rounded-md p-1.5 text-left transition-colors", on ? "bg-[#2b3a82]/10" : "hover:bg-[#2b3a82]/5", disabled && "cursor-not-allowed opacity-70")}
                >
                  <span className={cn("mt-0.5 flex shrink-0 items-center justify-center border-2 border-[#2b3a82]", exec ? "h-10 w-10 rounded-lg" : "h-4 w-4 rounded-[3px]", on && "bg-[#2b3a82] text-white")}>
                    {on && <Check className={exec ? "h-6 w-6" : "h-3 w-3"} strokeWidth={3} />}
                  </span>
                  {exec ? (
                    <span>
                      <span className="block text-4xl font-extrabold leading-none">{c.num}.</span>
                      <span className="mt-1.5 block text-[13px] leading-snug">
                        {c.members.length === 0 && <b>{c.label}</b>}
                        {c.members.map((m) => (<span key={m.role} className="block">{ROLE_LABEL[m.role] ?? m.role}: <b>{m.name}</b></span>))}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-baseline gap-2 text-lg"><span className="w-6 shrink-0 text-right text-xs tabular-nums text-[#1b2a5e]/50">{c.num}</span>{c.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
