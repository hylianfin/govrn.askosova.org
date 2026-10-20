"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CONFIG, kindLabel, raceLabel, schoolLabel, type ElectionConfig, type RaceKind } from "@/lib/config";

const Ctx = createContext<ElectionConfig>(DEFAULT_CONFIG);

export function ConfigProvider({ value, children }: { value: ElectionConfig; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);

// Names for schools, ballots and races, as set in the settings.
export function useLabels() {
  const cfg = useConfig();
  return useMemo(() => ({ cfg, school: (k: string) => schoolLabel(cfg, k), kind: (k: RaceKind) => kindLabel(cfg, k), race: (r: string) => raceLabel(cfg, r) }), [cfg]);
}
