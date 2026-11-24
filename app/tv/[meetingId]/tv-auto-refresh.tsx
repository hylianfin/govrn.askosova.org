"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The TV route is deliberately public, while the underlying attendance and ballots remain
// protected by RLS. Refresh its security-definer display payload without exposing those tables.
export function TvAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
