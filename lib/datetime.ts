// Election dates are wall-clock times in the election's timezone (e.g. Europe/Berlin), stored as UTC.

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}`, asUtc: Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute) };
}

export function validTimezone(tz: string | null | undefined) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz ?? "" }); return !!tz; } catch { return false; }
}

/** "2025-11-14" + "15:00" in `tz` -> ISO string in UTC, or null if either part is missing/invalid. */
export function wallToIso(date: string, time: string, tz: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time || "00:00")) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - (parts(wall, tz).asUtc - wall);
  utc = wall - (parts(utc, tz).asUtc - utc);
  const out = new Date(utc);
  if (Number.isNaN(out.getTime()) || parts(utc, tz).date !== date) return null; // rejects e.g. Feb 30
  return out.toISOString();
}

/** ISO string -> { date: "YYYY-MM-DD", time: "HH:MM" } as seen in `tz`. */
export function isoToWall(iso: string | null | undefined, tz: string) {
  if (!iso) return { date: "", time: "" };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { date: "", time: "" };
  const p = parts(t, tz);
  return { date: p.date, time: p.time };
}

export function formatWhen(startIso?: string | null, endIso?: string | null, tz = "UTC") {
  if (!startIso) return "No date set";
  const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
  if (!endIso) return `${day(startIso)}, ${time(startIso)}`;
  const sameDay = isoToWall(startIso, tz).date === isoToWall(endIso, tz).date;
  return sameDay
    ? `${day(startIso)}, ${time(startIso)} – ${time(endIso)}`
    : `${day(startIso)}, ${time(startIso)} → ${day(endIso)}, ${time(endIso)}`;
}

export function formatDay(iso?: string | null, tz = "UTC") {
  return iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso)) : "";
}
