import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero, SectionHeading } from "@/components/public/page-hero";
import {
  ClipboardList,
  KeyRound,
  ShieldCheck,
  Megaphone,
  Trophy,
  CheckCircle2,
  Users,
  Vote,
  Crown,
} from "lucide-react";

// Sample data only — this page previews the counting & results-reveal flow
// before any real paper ballots exist. Nothing here reads from the database.

const steps = [
  {
    icon: ClipboardList,
    title: "1. Ballots counted in person",
    desc: "On election day, two staff members count the paper ballots together, separating valid, invalid, and blank ballots per race.",
  },
  {
    icon: KeyRound,
    title: "2. Counts entered into the system",
    desc: "A staff member enters each team's (or candidate's) ballot count, plus invalid and blank totals, on the Election Results page.",
  },
  {
    icon: ShieldCheck,
    title: "3. A second staff member verifies",
    desc: "Counts stay unverified until another staff reviewer double-checks and confirms them against the physical ballots.",
  },
  {
    icon: Megaphone,
    title: "4. Admin publishes",
    desc: "Once verified, an admin publishes the results. Only then do they appear on this results page for everyone to see.",
  },
];

const execTeams = [
  { name: "Team Phoenix", slogan: "Lead with Heart", votes: 312, color: "bg-danger" },
  { name: "Team Horizon", slogan: "Building Tomorrow", votes: 289, color: "bg-primary" },
  { name: "Team Unity", slogan: "One Voice, One School", votes: 143, color: "bg-navy/50" },
];
const execInvalid = 9;
const execBlank = 14;
const execValidTotal = execTeams.reduce((sum, t) => sum + t.votes, 0);
const execCastTotal = execValidTotal + execInvalid + execBlank;
const eligibleVoters = 1050;
const turnoutPct = Math.round((execCastTotal / eligibleVoters) * 100);
const execWinner = [...execTeams].sort((a, b) => b.votes - a.votes)[0];

const senateGrades = [
  {
    grade: 9,
    seats: 2,
    candidates: [
      { name: "Elira Bytyqi", votes: 58 },
      { name: "Nruen Shabani", votes: 51 },
      { name: "Dion Krasniqi", votes: 33 },
    ],
  },
  {
    grade: 10,
    seats: 2,
    candidates: [
      { name: "Yllka Morina", votes: 62 },
      { name: "Besart Gjoka", votes: 47 },
      { name: "Fitore Kelmendi", votes: 29 },
    ],
  },
  {
    grade: 11,
    seats: 2,
    candidates: [
      { name: "Arben Hoxha", votes: 55 },
      { name: "Lule Rexhepi", votes: 49 },
      { name: "Kreshnik Dema", votes: 38 },
    ],
  },
  {
    grade: 12,
    seats: 2,
    candidates: [
      { name: "Ardita Berisha", votes: 61 },
      { name: "Gent Krasniqi", votes: 44 },
      { name: "Drita Leka", votes: 31 },
    ],
  },
];

function pct(votes: number, total: number) {
  return total === 0 ? 0 : Math.round((votes / total) * 1000) / 10;
}

export default function VoteCountingDemoPage() {
  const ranked = execTeams.slice().sort((a, b) => b.votes - a.votes);
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: the winner */}
        <section className="relative overflow-hidden bg-navy text-white">
          <div className="absolute inset-0 bg-stripes" />
          <div className="absolute inset-0 bg-stars" />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em]">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse-ring" /> Election results · sample data
            </p>
            <h1 className="mt-6 font-display text-6xl font-bold uppercase leading-[0.9] tracking-tight sm:text-8xl">
              {execWinner.name}
              <span className="block text-danger">wins.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/75">
              “{execWinner.slogan}” takes the Executive Team with {pct(execWinner.votes, execValidTotal)}% of valid votes.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                { label: "Turnout", value: `${turnoutPct}%` },
                { label: "Ballots cast", value: execCastTotal },
                { label: "Valid votes", value: execValidTotal },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-white/20 bg-white/10 px-4 py-3">
                  <p className="font-display text-3xl font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="bg-danger py-2 text-center font-display text-xs font-semibold uppercase tracking-[0.25em] text-white">
          Demo — every name and number is made up
        </div>

        {/* Executive */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading eyebrow="President · Vice President · Secretary · Treasurer" title="Executive Team">
            Final results, {execCastTotal} ballots counted and verified.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ranked.map((t, i) => {
              const winner = i === 0;
              const share = pct(t.votes, execValidTotal);
              return (
                <article
                  key={t.name}
                  className={
                    winner
                      ? "relative rounded-2xl bg-navy p-6 text-white shadow-[6px_6px_0_0_var(--danger)]"
                      : "rounded-2xl border-2 border-navy bg-card p-6 text-navy shadow-[4px_4px_0_0_var(--navy)]"
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-display text-5xl font-bold leading-none ${winner ? "text-danger" : "text-navy/30"}`}>0{i + 1}</span>
                    {winner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest">
                        <Crown className="h-3.5 w-3.5" /> Winner
                      </span>
                    )}
                  </div>
                  <h3 className="mt-6 font-display text-3xl font-bold uppercase leading-none">{t.name}</h3>
                  <p className={`mt-1 text-sm ${winner ? "text-white/65" : "text-muted-foreground"}`}>{t.slogan}</p>
                  <p className="mt-6 font-display text-6xl font-bold tabular-nums leading-none">{share}%</p>
                  <div className={`mt-3 h-2 overflow-hidden rounded-full ${winner ? "bg-white/20" : "bg-muted"}`}>
                    <div className={`h-full ${winner ? "bg-danger" : "bg-primary"}`} style={{ width: `${share}%` }} />
                  </div>
                  <p className={`mt-2 text-sm tabular-nums ${winner ? "text-white/70" : "text-muted-foreground"}`}>{t.votes} votes</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Senate */}
        <section className="bg-navy text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <SectionHeading light eyebrow="Results by grade" title="Student Senate" />
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {senateGrades.map((g) => {
                const total = g.candidates.reduce((n, c) => n + c.votes, 0);
                const list = g.candidates.slice().sort((a, b) => b.votes - a.votes);
                return (
                  <article key={g.grade} className="rounded-2xl bg-white p-6 text-navy">
                    <div className="flex items-end justify-between">
                      <h3 className="font-display text-4xl font-bold uppercase leading-none">Grade {g.grade}</h3>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">{g.seats} seats</span>
                    </div>
                    <ul className="mt-5 space-y-3">
                      {list.map((c, i) => {
                        const elected = i < g.seats;
                        const share = pct(c.votes, total);
                        return (
                          <li key={c.name} className={`rounded-lg border-2 p-3 ${elected ? "border-danger bg-danger/5" : "border-border"}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{c.name}</span>
                              {elected && <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Elected</span>}
                              <span className="ml-auto font-display text-xl font-bold tabular-nums">{share}%</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full ${elected ? "bg-danger" : "bg-navy/30"}`} style={{ width: `${share}%` }} />
                            </div>
                            <p className="mt-1 text-xs tabular-nums text-muted-foreground">{c.votes} votes</p>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Paper ballots counted by two staff, verified by a second reviewer, then published by an admin.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
