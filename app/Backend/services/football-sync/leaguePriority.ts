// A club whose squad has never been synced contributes 0 players to the
// database, so it always outranks a club that's merely missing some
// player-profile fields — this weight just needs to dominate any realistic
// sum of missing-profile counts.
const NEVER_SYNCED_WEIGHT = 1000;

interface PriorityLeague {
  id: number;
}

interface PriorityClub {
  id: number;
  leagueId: number;
  squadLastSyncedAt: Date | null;
}

interface MissingProfileCount {
  clubId: number;
  count: number;
}

function scoreByLeagueId(
  clubs: PriorityClub[],
  missingProfileCounts: MissingProfileCount[],
): Map<number, number> {
  const missingByClub = new Map(
    missingProfileCounts.map((entry) => [entry.clubId, entry.count]),
  );
  const scores = new Map<number, number>();

  for (const club of clubs) {
    const neverSynced = club.squadLastSyncedAt === null ? NEVER_SYNCED_WEIGHT : 0;
    const missingProfiles = missingByClub.get(club.id) ?? 0;
    const clubScore = neverSynced + missingProfiles;

    scores.set(club.leagueId, (scores.get(club.leagueId) ?? 0) + clubScore);
  }

  return scores;
}

// Orders leagues by how much sync work they still need, computed fresh from
// live DB state every call: never-synced clubs first, then leagues with the
// most players missing profile data. A league recomputed after it's fully
// backfilled scores 0 and sorts to the back on the next run — no persisted
// state, so priority naturally rotates day to day.
export function sortLeaguesByMissingWork<League extends PriorityLeague>(
  leagues: League[],
  clubs: PriorityClub[],
  missingProfileCounts: MissingProfileCount[],
): League[] {
  const scores = scoreByLeagueId(clubs, missingProfileCounts);

  return leagues
    .map((league, index) => ({
      league,
      index,
      score: scores.get(league.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.league);
}
