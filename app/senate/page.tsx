import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SenatePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-primary">Student Senate</h1>
        <p className="mt-2 text-muted-foreground">Apply individually to represent your class and contribute to school decisions.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Eligibility</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>No suspensions during the current academic year.</li>
                <li>No filed detentions during the current academic year.</li>
                <li>Attendance and community-service rules apply (see admin-configured rules).</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Apply</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Complete the Senate application form and submit before the deadline.</p>
              <Button asChild className="mt-3"><Link href="/dashboard/applications/senate">Start an application</Link></Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}