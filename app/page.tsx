import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentElection, getElectionEvents, getAnnouncements } from "@/lib/queries/elections";
import { STAGE_LABELS } from "@/lib/types";
import {
  Calendar,
  Megaphone,
  ShieldCheck,
  Users,
  BookOpen,
  Heart,
  Sparkles,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const features = [
  { icon: BookOpen, title: "Modern Curriculum", desc: "Student-led initiatives that prepare leaders for success." },
  { icon: Heart, title: "Safe Environment", desc: "A supportive community where every voice is heard." },
  { icon: Sparkles, title: "Holistic Development", desc: "Leadership, service, and character in every role." },
  { icon: GraduationCap, title: "Experiential Learning", desc: "Real responsibility and hands-on school governance." },
];

const stages = [
  {
    tag: "Applications",
    title: "Executive Teams & Student Senate",
    desc: "Students apply individually for the Senate or as a four-member Executive Team. Drafts can be saved and submitted before the deadline.",
  },
  {
    tag: "Eligibility",
    title: "Staff-Verified Eligibility",
    desc: "Authorized staff review behavior, grades, attendance, and other configured requirements. Students are never automatically declared eligible.",
  },
  {
    tag: "Campaign",
    title: "Campaign Preparation & Approval",
    desc: "Approved teams prepare posters, videos, and speeches. Campaign materials are reviewed by authorized staff before publishing.",
  },
  {
    tag: "Election",
    title: "Debate, Silence & Election Day",
    desc: "Teams present platforms in a debate, observe election silence, then vote using paper ballots on Election Day.",
  },
];

export default async function HomePage() {
  const election = await getCurrentElection();
  const events = election ? await getElectionEvents(election.id) : [];
  const announcements = await getAnnouncements(true);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-accent blur-3xl" />
            <div className="absolute right-10 bottom-0 h-80 w-80 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="max-w-2xl text-white">
              <Badge variant="secondary" className="mb-4">American School of Kosovo</Badge>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Growing Future Leaders From the Classroom
              </h1>
              <p className="mt-5 text-lg text-white/80">
                The ASK Student Government and Student Senate give students a real voice in school life — from leading initiatives to representing every class.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  <Link href="/dashboard/applications">Apply Now</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/election-timeline">Explore the Election Process</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-4 py-6 sm:px-6">
            {["Student Government", "Student Senate", "Executive Team", "Election Office", "Student Services"].map((t) => (
              <span key={t} className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t}</span>
            ))}
          </div>
        </section>

        {/* Intro */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-primary">
              A progressive student government dedicated to fostering leadership, participation, and character development.
            </h2>
            <p className="mt-5 text-muted-foreground">
              We believe in empowering students to take ownership of their school experience. Through transparent applications, verified eligibility, and a fair election process, we create leaders who serve their community.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="text-center">
                <CardHeader className="items-center">
                  <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-primary">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{f.desc}</p></CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Election process */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Image src="/images/logo-mark.png" alt="ASK" width={120} height={120} className="h-24 w-24 opacity-90" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary">A Fair and Transparent Election Process</h2>
                <p className="mt-4 text-muted-foreground">
                  From application to election day, every step is configurable, reviewable, and auditable. Students see their own status while staff manage eligibility and approvals securely.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm font-semibold">Verified Eligibility</p>
                    <p className="text-xs text-muted-foreground">Staff confirm records before approval.</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm font-semibold">Application Deadlines</p>
                    <p className="text-xs text-muted-foreground">Configured per form, per cycle.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stages */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-primary">Our Election Process</h2>
            <p className="mt-3 text-muted-foreground">Comprehensive stages designed to guide every candidate to success.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {stages.map((s) => (
              <div key={s.title} className="rounded-xl border border-border bg-card p-6">
                <Badge variant="secondary" className="mb-3">{s.tag}</Badge>
                <h3 className="text-lg font-semibold text-primary">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Positions */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold text-primary">Student Government Positions</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { title: "President", desc: "Leads the Executive Team and represents the student body." },
                { title: "Vice President", desc: "Supports the President and coordinates initiatives." },
                { title: "Secretary", desc: "Manages records, communication, and meeting minutes." },
                { title: "Treasurer", desc: "Oversees the budget and financial planning." },
                { title: "Student Senate", desc: "Represents each class in school decisions." },
              ].map((p) => (
                <Card key={p.title}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription className="text-xs">{p.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-accent/10">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold text-primary">Proven Excellence in Student Leadership</h2>
              <p className="mt-3 text-muted-foreground">Our programs give every student a path to participate.</p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {[
                { value: "4", label: "Executive Positions" },
                { value: "10", label: "Senate Seats" },
                { value: "100%", label: "Transparent Process" },
                { value: "24/7", label: "Platform Access" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-4xl font-bold text-primary">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Announcements */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold text-primary">Stay Updated with Our Latest News & Insights</h2>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements at this time.</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {announcements.slice(0, 3).map((a: any) => (
                  <Card key={a.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <CardDescription>{formatDate(a.published_at || a.created_at)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{a.body}</p>
                      <Link href="/announcements" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Learn more <ArrowRight className="h-3 w-3" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA banner */}
        <section className="relative overflow-hidden bg-primary">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-accent blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="text-white">
              <h2 className="text-3xl font-bold">Give Your Voice the Best Start in School Life</h2>
              <p className="mt-2 text-white/80">Apply to lead, represent your classmates, and shape our school community.</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
              <Link href="/dashboard/applications">Apply Now</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}