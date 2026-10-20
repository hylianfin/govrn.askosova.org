"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);
  useEffect(() => {
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  const cells: [string, number | undefined][] = [["Days", t?.d], ["Hrs", t?.h], ["Min", t?.m], ["Sec", t?.s]];
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Countdown">
      {cells.map(([label, v]) => (
        <div key={label} className="rounded-md bg-navy px-2 py-2 text-center text-white">
          <p className="font-display text-2xl font-bold tabular-nums leading-none">{v === undefined ? "--" : String(v).padStart(2, "0")}</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
        </div>
      ))}
    </div>
  );
}
