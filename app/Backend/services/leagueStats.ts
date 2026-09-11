export interface LeaguePlayerSample {
  age: number | null;
  nationality: string | null;
  club: { area: { name: string } | null } | null;
}

export interface LeaguePlayerStats {
  totalActivePlayers: number;
  averageAge: number | null;
  playersWithKnownNationality: number;
  foreignPlayerPercentage: number | null;
}

// A player counts as "foreign" when their nationality differs from their
// own club's country (not a single assumed league nationality — mirrors how
// ClubMapper already treats a club's own area as the source of truth). Only
// players with both a known nationality and a club with a known area count
// toward the percentage at all: nationality data is sparse in this database
// (see PlayerProfileSyncer), so playersWithKnownNationality is returned
// alongside it — the caller must show it, not just the bare percentage, or
// a small sample (a single player, in the worst case) reads as a solid
// league-wide figure.
export function computeLeaguePlayerStats(
  players: LeaguePlayerSample[],
): LeaguePlayerStats {
  const ages = players.filter(
    (player): player is LeaguePlayerSample & { age: number } =>
      player.age !== null,
  );
  const averageAge =
    ages.length > 0
      ? roundToOneDecimal(
          ages.reduce((sum, player) => sum + player.age, 0) / ages.length,
        )
      : null;

  let foreignCount = 0;
  let knownNationalityCount = 0;

  for (const player of players) {
    const homeNation = player.club?.area?.name ?? null;

    if (player.nationality === null || homeNation === null) {
      continue;
    }

    knownNationalityCount += 1;

    if (player.nationality !== homeNation) {
      foreignCount += 1;
    }
  }

  const foreignPlayerPercentage =
    knownNationalityCount > 0
      ? roundToOneDecimal((foreignCount / knownNationalityCount) * 100)
      : null;

  return {
    totalActivePlayers: players.length,
    averageAge,
    playersWithKnownNationality: knownNationalityCount,
    foreignPlayerPercentage,
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
