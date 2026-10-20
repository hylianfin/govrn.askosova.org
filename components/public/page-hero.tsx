import { cn } from "@/lib/cn";

export function PageHero({ eyebrow, title, children, className }: { eyebrow: string; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden bg-navy text-white", className)}>
      <div className="absolute inset-0 bg-stripes" />
      <div className="absolute inset-0 bg-stars" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
          <span className="h-0.5 w-8 bg-danger" />
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-6xl">{title}</h1>
        {children ? <p className="mt-4 max-w-2xl text-lg text-white/75">{children}</p> : null}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children, light = false, center = false }: { eyebrow: string; title: string; children?: React.ReactNode; light?: boolean; center?: boolean }) {
  return (
    <div className={cn(center && "mx-auto max-w-2xl text-center")}>
      <p className={cn("font-display text-xs font-semibold uppercase tracking-[0.25em]", light ? "text-white/60" : "text-danger")}>{eyebrow}</p>
      <h2 className={cn("mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl", light ? "text-white" : "text-navy")}>{title}</h2>
      {children ? <p className={cn("mt-3", light ? "text-white/70" : "text-muted-foreground")}>{children}</p> : null}
    </div>
  );
}
