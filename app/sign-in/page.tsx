"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Lock, Mail, ShieldCheck, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { AuthError, AuthField, PasswordField } from "@/components/auth/fields";
import { signIn } from "@/lib/auth/actions";
import { useConfig } from "@/components/config-provider";

const points = [
  { icon: ClipboardList, title: "Track your application", desc: "Save drafts, submit before the deadline and see staff feedback." },
  { icon: ShieldCheck, title: "Staff-verified", desc: "Eligibility is reviewed by people, never declared automatically." },
  { icon: Vote, title: "One school, one vote", desc: "Follow every stage from applications to Election Day." },
];

export default function SignInPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const cfg = useConfig();
  const sample = `name@${cfg.emailDomains[0] ?? "school.org"}`;
  return (
    <AuthShell eyebrow="Welcome back" heading="Your voice. Your school." points={points}>
      <AuthHeading eyebrow="Sign in" title="Welcome back">
        Use your school account to access the platform.
      </AuthHeading>

      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value="/dashboard" />
        <AuthField id="email" label="School email" type="email" icon={Mail} required autoComplete="email" placeholder={sample} />
        <PasswordField icon={Lock} required autoComplete="current-password" />
        <AuthError message={state?.error} />
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 w-full bg-primary font-display text-base uppercase tracking-wider"
        >
          {pending ? "Signing in…" : (<>Sign in <ArrowRight className="h-4 w-4" aria-hidden /></>)}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to {cfg.siteName}?{" "}
        <Link href="/sign-up" className="font-semibold text-primary underline-offset-4 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
