"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Lock, Mail, Megaphone, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { AuthError, AuthField, PasswordField } from "@/components/auth/fields";
import { signUp } from "@/lib/auth/actions";
import { useConfig } from "@/components/config-provider";

const points = [
  { icon: Users, title: "Run for office", desc: "Apply solo for the Senate or as a four-member Executive Team." },
  { icon: Megaphone, title: "Campaign your way", desc: "Share your platform once staff have reviewed your materials." },
  { icon: CalendarDays, title: "Never miss a date", desc: "Deadlines, debates and Election Day, all in one timeline." },
];

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  const cfg = useConfig();
  const domains = cfg.emailDomains;

  if (state?.success) {
    return (
      <AuthShell eyebrow="Almost there" heading="Check your inbox." points={points}>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold uppercase leading-none tracking-tight text-navy">Confirm your email</h1>
          <p role="status" className="mt-3 text-muted-foreground">{state.success}</p>
          <p className="mt-1 text-sm text-muted-foreground">Open the link we sent to finish creating your account.</p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Join the election" heading="Make your mark." points={points}>
      <AuthHeading eyebrow="Create account" title={`Join ${cfg.siteName}`}>
        Students register with their school details. Staff accounts are provisioned by administrators.
      </AuthHeading>

      <form action={action} className="space-y-5">
        <AuthField id="fullName" label="Full name" icon={User} required autoComplete="name" placeholder="First and last name" />
        <AuthField
          id="email"
          label="School email"
          type="email"
          icon={Mail}
          required
          autoComplete="email"
          placeholder={`name@${domains[0] ?? "school.org"}`}
          hint={domains.length ? `Any ${domains.map((d) => "@" + d).join(" or ")} address works.` : "Use your school email."}
        />
        <PasswordField icon={Lock} required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
        <AuthError message={state?.error} />
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 w-full bg-danger font-display text-base uppercase tracking-wider hover:bg-danger/90"
        >
          {pending ? "Creating account…" : (<>Create account <ArrowRight className="h-4 w-4" aria-hidden /></>)}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
