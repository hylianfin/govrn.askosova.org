import { headers } from "next/headers";

/** The public address of this site: NEXT_SITE_URL when set (production), otherwise whatever address the request came in on. */
export async function getSiteUrl() {
  const fromEnv = process.env.NEXT_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
