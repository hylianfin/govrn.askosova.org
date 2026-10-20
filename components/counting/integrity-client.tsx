"use client";

import { useMemo } from "react";
import { IntegritySettings } from "@/components/counting/integrity-settings";
import { createCountApi } from "@/components/counting/api";
import type { IntegritySetting } from "@/lib/live";

export function IntegrityClient({ initial, isAdmin }: { initial: IntegritySetting[]; isAdmin: boolean }) {
  const api = useMemo(() => createCountApi(), []);
  return <IntegritySettings api={api} initial={initial} isAdmin={isAdmin} />;
}
