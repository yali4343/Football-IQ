// Generic kebab-case slugify — used for both league slugs (--league=<slug>)
// and club-name slugs (--club=<slug>).
export function slugifyLeagueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "us"/"calcio" verified live against API-Football's Serie A directory and
// search (US Lecce -> "Lecce", US Sassuolo Calcio -> "Sassuolo") — Italian
// club-type descriptors that, like fc/afc/cf/ac, aren't part of the club's
// distinguishing identity on API-Football's side.
//
// "real"/"club"/"de"/"rc"/"sv"/"tsg"/"ud" cover the same pattern for La Liga
// and Bundesliga club-type descriptors and connectors (Club Atlético de
// Madrid -> "Atletico Madrid", Real Racing Club de Santander -> "Racing
// Santander", RC Deportivo La Coruña -> "Deportivo La Coruna", SV Werder
// Bremen -> "Werder Bremen", TSG 1899 Hoffenheim -> "Hoffenheim", Levante UD
// -> "Levante") — based on API-Football's well-known public naming, not yet
// confirmed live the way the Italian tokens above were (today's daily
// request quota was already spent); worth checking against the next
// scheduled sync's `unmapped:` output.
const CLUB_SUFFIX_TOKENS = [
  "fc",
  "afc",
  "cf",
  "ac",
  "us",
  "calcio",
  "real",
  "club",
  "de",
  "rc",
  "sv",
  "tsg",
  "ud",
];

// API-Football uses a short brand name instead of the full official name
// for these clubs — verified live against /teams, not derivable by any
// general stripping rule.
const CLUB_NAME_ALIASES: Record<string, string> = {
  "brighton hove albion": "brighton",
};

// Drops club-type suffixes (fc/afc/cf/ac) and standalone numeric tokens
// (e.g. the "1." in "1. FC Köln", the "04" in "Bayer 04 Leverkusen") — both
// verified live to vary between football-data.org and API-Football's naming
// for the same club, and API-Football's search silently returns zero
// results when the query contains either.
export function normalizeClubName(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !CLUB_SUFFIX_TOKENS.includes(token) && !/^\d+$/.test(token),
    )
    .join(" ")
    .trim();

  return CLUB_NAME_ALIASES[normalized] ?? normalized;
}
