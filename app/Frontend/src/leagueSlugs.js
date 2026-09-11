// The site only ever supports these four leagues (see
// useClubSelection's SUPPORTED_LEAGUES) — a fixed map is simpler than a
// general-purpose slugify function for a set this small and this stable.
const LEAGUE_SLUGS = {
  "Premier League": "premier-league",
  "La Liga": "la-liga",
  "Serie A": "serie-a",
  Bundesliga: "bundesliga",
};

const SLUG_TO_LEAGUE = Object.fromEntries(
  Object.entries(LEAGUE_SLUGS).map(([league, slug]) => [slug, league]),
);

export function leagueToSlug(league) {
  return LEAGUE_SLUGS[league] ?? null;
}

export function slugToLeague(slug) {
  return SLUG_TO_LEAGUE[slug] ?? null;
}
