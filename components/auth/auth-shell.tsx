"use client";

import Link from "next/link";
import { useConfig } from "@/components/config-provider";
import { ArrowLeft, type LucideIcon } from "lucide-react";

type Point = { icon: LucideIcon; title: string; desc: string };

export function AuthShell({
  eyebrow,
  heading,
  points,
  children,
}: {
  eyebrow: string;
  heading: string;
  points: Point[];
  children: React.ReactNode;
}) {
  const c = useConfig();
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Campaign panel */}
      <aside className="relative flex flex-col overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-stripes" />
        <div className="absolute inset-0 bg-stars" />
        <div className="relative flex flex-1 flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <Link href="/" className="flex w-fit items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.logoUrl} alt={c.siteName} width={44} height={44} className="h-11 w-11 rounded-full object-contain" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-bold uppercase tracking-wide">{c.siteName}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{c.tagline}</span>
            </span>
          </Link>

          <div className="my-10 lg:my-auto lg:py-12">
            <p className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              <span className="h-0.5 w-8 bg-danger" />
              {eyebrow}
            </p>
            <h2 className="mt-3 max-w-md font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
              {heading}
            </h2>

            <ul className="mt-8 hidden max-w-md space-y-5 lg:block">
              {points.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-sm font-semibold uppercase tracking-wider">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-white/65">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-white/45 lg:block">
            {c.organizationName}
          </p>
        </div>
        <div className="ribbon relative" />
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-danger">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight text-navy sm:text-5xl">{title}</h1>
      {children ? <p className="mt-3 text-muted-foreground">{children}</p> : null}
    </div>
  );
}
