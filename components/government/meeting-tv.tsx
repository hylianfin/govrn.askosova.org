import Image from "next/image";

export type TvSeat = {
  id: string;
  name: string;
  office: string;
  status: "present" | "late" | "excused" | "absent" | "unmarked";
};

export type TvMotion = {
  id: string;
  text: string;
  open: boolean;
  yes: number;
  no: number;
  abstain: number;
  status: string;
  ballotVisibility: "open" | "anonymous";
  ballots: { userId: string; name: string; choice: "yes" | "no" | "abstain" }[];
};

export type TvData = {
  meeting?: { title?: string; status?: string; body?: string; displayCode?: string };
  seats?: TvSeat[];
  motions?: TvMotion[];
} | null;

const BODY_LABEL: Record<string, string> = { senate: "Senate", executive: "Executive team", joint: "Joint session" };
const ATTENDANCE_LABEL: Record<TvSeat["status"], string> = {
  present: "Present", late: "Late", excused: "Excused", absent: "Absent", unmarked: "Not checked in",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts.at(-1)?.[0] ?? "");
}

function SeatBubble({ seat, choice, live }: { seat: TvSeat; choice?: TvMotion["ballots"][number]["choice"]; live: boolean }) {
  const state = live ? choice ?? "waiting" : seat.status;
  const tone: Record<string, string> = {
    yes: "bg-accent text-navy ring-accent",
    no: "bg-white text-navy ring-white",
    abstain: "bg-white/45 text-navy ring-white/45",
    waiting: "bg-transparent text-white ring-2 ring-white/75",
    present: "bg-accent text-navy ring-accent",
    late: "bg-accent text-navy ring-accent",
    excused: "bg-white/20 text-white ring-2 ring-white/70",
    absent: "bg-white/10 text-white/55 ring-white/20",
    unmarked: "bg-transparent text-white/45 ring-2 ring-dashed ring-white/30",
  };
  const label = live ? (choice ? `Voted ${choice}` : "Waiting to vote") : ATTENDANCE_LABEL[seat.status];

  return (
    <li className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-label={`${seat.name}: ${label}`}>
      <span className={`flex size-11 items-center justify-center rounded-full text-xs font-bold tracking-tight ring-1 sm:size-14 sm:text-sm xl:size-16 xl:text-base ${tone[state]}`}>
        {initials(seat.name)}
      </span>
      <span className="max-w-full truncate text-[10px] font-medium text-white/75 sm:text-xs">{seat.name}</span>
    </li>
  );
}

function SeatLegend({ live }: { live: boolean }) {
  const items = live
    ? [["bg-accent", "Yes"], ["bg-white", "No"], ["bg-white/45", "Abstain"], ["border-2 border-white/70", "Waiting"]]
    : [["bg-accent", "Present"], ["bg-primary", "Late"], ["bg-white/20", "Excused"], ["bg-white/10", "Absent"], ["border-2 border-dashed border-white/30", "Not checked in"]];
  return <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-white/65 sm:text-xs" aria-label="Seat legend">
    {items.map(([swatch, label]) => <li key={label} className="flex items-center gap-1.5"><span className={`size-3 rounded-full ${swatch}`} />{label}</li>)}
  </ul>;
}

function VoteTotals({ motion }: { motion: TvMotion }) {
  return <dl className="grid grid-cols-3 divide-x divide-white/15 border-y border-white/15">
    {[["Yes", motion.yes, "text-accent"], ["No", motion.no, "text-white"], ["Abstain", motion.abstain, "text-white/55"]].map(([label, count, tone]) => (
      <div key={label} className="px-3 py-4 text-center sm:px-5"><dd className={`font-display text-5xl leading-none sm:text-6xl ${tone}`}>{count}</dd><dt className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{label}</dt></div>
    ))}
  </dl>;
}

export function MeetingTv({ data }: { data: TvData }) {
  const meeting = data?.meeting;
  const seats = data?.seats ?? [];
  const motions = data?.motions ?? [];
  const activeMotion = motions.find((motion) => motion.open);
  const namesShown = activeMotion?.ballotVisibility !== "anonymous";
  const lastMotion = motions.at(-1);
  const ballots = new Map(namesShown ? activeMotion?.ballots.map((ballot) => [ballot.userId, ballot.choice]) ?? [] : []);
  const here = seats.filter((seat) => seat.status === "present" || seat.status === "late").length;
  const ballotsCast = activeMotion ? activeMotion.yes + activeMotion.no + activeMotion.abstain : 0;
  const quorum = seats.length ? Math.floor(seats.length / 2) + 1 : 0;
  const quorumMet = here >= quorum;

  return (
    <main className="min-h-screen overflow-hidden bg-navy text-white">
      <header className="border-b border-white/20 bg-[#030530] px-5 py-4 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Image src="/images/logo-mark.png" width={56} height={56} alt="American School of Kosovo" className="size-11 rounded-full bg-white sm:size-14" priority />
            <div className="min-w-0 border-l border-white/25 pl-3 sm:pl-5">
              <p className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-accent sm:text-base">ASK student government</p>
              <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{meeting?.title ?? "Meeting display"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className={`size-3 rounded-full ${activeMotion ? "bg-accent animate-pulse" : "bg-white/50"}`} aria-hidden />
            <div><p className="text-sm font-semibold uppercase tracking-[0.16em]">{activeMotion ? "Live ballot" : "Meeting room"}</p><p className="text-xs text-white/60">{BODY_LABEL[meeting?.body ?? ""] ?? "Student government"}{meeting?.displayCode ? ` · TV ${meeting.displayCode}` : ""}</p></div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-88px)] gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.65fr)]">
        <section className="flex min-h-[55vh] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          {activeMotion ? (
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-3"><span className="bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-white">Vote {motions.filter((motion) => motion.open || motion.status === "passed" || motion.status === "failed").indexOf(activeMotion) + 1}</span><span className="border border-white/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{namesShown ? "Open ballot · names shown" : "Anonymous ballot · totals only"}</span></div>
              <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Motion on the floor</p>
              <h2 className="mt-3 max-w-5xl font-display text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">{activeMotion.text}</h2>
              <div className="mt-auto pt-9"><SeatLegend live={namesShown} /><ul className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8" aria-label={namesShown ? "Live voting seats" : "Meeting seats"}>{seats.map((seat) => <SeatBubble key={seat.id} seat={seat} choice={ballots.get(seat.id)} live={namesShown} />)}</ul></div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
              <Image src="/images/logo-mark.png" width={180} height={180} alt="American School of Kosovo" className="size-28 rounded-full bg-white shadow-[0_0_0_12px_rgb(152_179_234_/_0.16)] sm:size-36" priority />
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-accent">American School of Kosovo</p>
              <h2 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">Meeting in progress</h2>
              <p className="mt-4 max-w-xl text-base text-white/70 sm:text-lg">No motion is open right now. The display will switch to a live ballot as soon as an executive opens one.</p>
              {lastMotion && <p className="mt-7 border-y border-white/15 px-5 py-3 text-sm text-white/65">Last decision: <span className="font-semibold capitalize text-white">{lastMotion.status}</span> · {lastMotion.text}</p>}
              <div className="mt-10 w-full"><SeatLegend live={false} /><ul className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8" aria-label="Meeting seats">{seats.map((seat) => <SeatBubble key={seat.id} seat={seat} live={false} />)}</ul></div>
            </div>
          )}
        </section>

        <aside className="border-t border-white/20 bg-[#05073a] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
          {activeMotion ? <><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Live count</p><p className="mt-2 font-display text-5xl font-semibold">Voting open</p><div className="mt-7"><VoteTotals motion={activeMotion} /></div></> : <><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Meeting status</p><p className="mt-2 font-display text-5xl font-semibold">Ready</p><p className="mt-3 text-sm leading-6 text-white/65">Roll call stays visible here until the next ballot opens.</p></>}

          <section className="mt-8 border border-white/20" aria-labelledby="roll-call-title">
            <div className="flex items-end justify-between gap-3 border-b border-white/20 px-4 py-3"><div><h2 id="roll-call-title" className="font-display text-2xl font-semibold">Roll call</h2><p className="text-xs text-white/60">{here} of {seats.length} present or late</p></div><span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${quorumMet ? "bg-primary text-white" : "bg-white/15 text-white/75"}`}>{quorumMet ? "Quorum met" : `${quorum} needed`}</span></div>
            <div className="grid grid-cols-2 gap-x-5 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-2">{seats.map((seat) => { const choice = ballots.get(seat.id); const state = activeMotion && namesShown ? (choice ? choice : "waiting") : seat.status; return <div key={seat.id} className="flex min-w-0 items-center gap-2 border-b border-white/10 py-2"><span className={`size-2.5 shrink-0 rounded-full ${state === "yes" || state === "present" ? "bg-accent" : state === "no" ? "bg-white" : state === "abstain" ? "bg-white/45" : state === "late" ? "bg-primary" : state === "waiting" || state === "unmarked" ? "border-2 border-white/65 bg-transparent" : "bg-white/25"}`} /><span className="truncate font-medium">{seat.name}</span><span className="ml-auto shrink-0 text-xs capitalize text-white/60">{activeMotion && namesShown ? (choice ?? "Waiting") : ATTENDANCE_LABEL[seat.status]}</span></div>; })}</div>
          </section>

          {activeMotion && <p className="mt-5 text-center text-sm text-white/60">{ballotsCast} ballot{ballotsCast === 1 ? "" : "s"} cast · {Math.max(here - ballotsCast, 0)} waiting</p>}
        </aside>
      </div>
    </main>
  );
}
