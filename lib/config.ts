// Everything that is specific to one school or election lives in the settings (election_config), not in the code.
export interface SchoolCfg { key: string; label: string; minGrade: number; maxGrade: number }

export interface ElectionConfig {
  organizationName: string;
  siteName: string;
  tagline: string;
  logoUrl: string;
  emailDomains: string[]; // empty means anyone may sign up
  schools: SchoolCfg[];
  senateSeats: number;
  senateMaxChoices: number;
  governmentLabel: string;
  senateLabel: string;
}

// Used until the settings can be read, and by the demo pages.
export const DEFAULT_CONFIG: ElectionConfig = {
  organizationName: "American School of Kosovo",
  siteName: "ASK Votes",
  tagline: "Student Government",
  logoUrl: "/images/logo-mark.png",
  emailDomains: ["askosova.org"],
  schools: [
    { key: "middle", label: "Middle School", minGrade: 0, maxGrade: 8 },
    { key: "high", label: "High School", minGrade: 9, maxGrade: 99 },
  ],
  senateSeats: 5,
  senateMaxChoices: 3,
  governmentLabel: "Government",
  senateLabel: "Senator",
};

export function parseConfig(raw: unknown): ElectionConfig {
  const r = (raw ?? {}) as Partial<ElectionConfig>;
  const d = DEFAULT_CONFIG;
  return {
    organizationName: r.organizationName || d.organizationName,
    siteName: r.siteName || d.siteName,
    tagline: r.tagline ?? d.tagline,
    logoUrl: r.logoUrl || d.logoUrl,
    emailDomains: Array.isArray(r.emailDomains) ? r.emailDomains : d.emailDomains,
    schools: Array.isArray(r.schools) && r.schools.length > 0 ? r.schools : d.schools,
    senateSeats: r.senateSeats ?? d.senateSeats,
    senateMaxChoices: r.senateMaxChoices ?? d.senateMaxChoices,
    governmentLabel: r.governmentLabel || d.governmentLabel,
    senateLabel: r.senateLabel || d.senateLabel,
  };
}

export type RaceKind = "exec" | "senate";
export const schoolLabel = (c: ElectionConfig, key: string) => c.schools.find((s) => s.key === key)?.label ?? key;
export const kindLabel = (c: ElectionConfig, kind: RaceKind) => (kind === "exec" ? c.governmentLabel : c.senateLabel);
export const raceLabel = (c: ElectionConfig, race: string) => {
  const [kind, ...school] = race.split("-");
  return `${schoolLabel(c, school.join("-"))} ${kindLabel(c, kind as RaceKind)}`;
};
const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const numberWord = (n: number) => NUMBERS[n] ?? String(n);
