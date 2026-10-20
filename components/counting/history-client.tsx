"use client";

import { useMemo } from "react";
import { BallotHistory } from "@/components/counting/ballot-history";
import { createCountApi } from "@/components/counting/api";

export function BallotHistoryClient({ eyebrow }: { eyebrow: string }) {
  const api = useMemo(() => createCountApi(), []);
  return <BallotHistory api={api} eyebrow={eyebrow} />;
}
