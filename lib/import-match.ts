export type KnownAccount = { name: string; email: string; confirmed: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1);

/** Accounts whose name (or the part of the email before the @) looks like the name on a response. Staff confirm each one. */
export function suggestAccounts(name: string, accounts: KnownAccount[], limit = 3) {
  const want = tokens(name);
  if (want.length === 0) return [];
  const wantKey = [...want].sort().join(" ");
  const scored = accounts.map((a) => {
    const byName = tokens(a.name);
    const byEmail = tokens(a.email.split("@")[0]);
    let score = 0;
    if ([...byName].sort().join(" ") === wantKey || [...byEmail].sort().join(" ") === wantKey) score = 3;
    else if (want.length >= 2 && [want[0], want[want.length - 1]].every((t) => byName.includes(t) || byEmail.includes(t))) score = 2;
    return { a, score };
  }).filter((x) => x.score > 0);
  return scored.sort((x, y) => y.score - x.score).slice(0, limit).map((x) => ({ email: x.a.email, name: x.a.name || x.a.email, confirmed: x.a.confirmed }));
}
