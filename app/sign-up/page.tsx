"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "@/lib/auth/actions";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Students register with their details. Staff accounts are provisioned by administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="name@students.askosova.org" />
              <p className="text-xs text-muted-foreground">Must end with @students.askosova.org</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            {state?.error && <p className="text-sm text-danger">{state.error}</p>}
            {state?.success && <p className="text-sm text-success">{state.success}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create Account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-accent hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}