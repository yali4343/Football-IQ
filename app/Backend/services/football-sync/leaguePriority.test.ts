import { describe, expect, it } from "vitest";
import { sortLeaguesByMissingWork } from "./leaguePriority.js";

describe("sortLeaguesByMissingWork", () => {
  it("puts a league with a never-synced club ahead of a league that's merely missing profile fields", () => {
    const leagues = [{ id: 1 }, { id: 2 }];
    const clubs = [
      { id: 10, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 20, leagueId: 2, squadLastSyncedAt: null },
    ];
    const missingProfileCounts = [{ clubId: 10, count: 25 }];

    const result = sortLeaguesByMissingWork(leagues, clubs, missingProfileCounts);

    expect(result.map((league) => league.id)).toEqual([2, 1]);
  });

  it("orders leagues by total missing-profile count when no club is never-synced", () => {
    const leagues = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const clubs = [
      { id: 10, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 20, leagueId: 2, squadLastSyncedAt: new Date() },
      { id: 30, leagueId: 3, squadLastSyncedAt: new Date() },
    ];
    const missingProfileCounts = [
      { clubId: 10, count: 3 },
      { clubId: 20, count: 9 },
      { clubId: 30, count: 1 },
    ];

    const result = sortLeaguesByMissingWork(leagues, clubs, missingProfileCounts);

    expect(result.map((league) => league.id)).toEqual([2, 1, 3]);
  });

  it("keeps original order for leagues that tie on score (stable sort)", () => {
    const leagues = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const clubs = [
      { id: 10, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 20, leagueId: 2, squadLastSyncedAt: new Date() },
    ];
    const missingProfileCounts: { clubId: number; count: number }[] = [];

    const result = sortLeaguesByMissingWork(leagues, clubs, missingProfileCounts);

    expect(result.map((league) => league.id)).toEqual([1, 2, 3]);
  });

  it("sums scores across multiple clubs within the same league", () => {
    const leagues = [{ id: 1 }, { id: 2 }];
    const clubs = [
      { id: 10, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 11, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 20, leagueId: 2, squadLastSyncedAt: new Date() },
    ];
    const missingProfileCounts = [
      { clubId: 10, count: 4 },
      { clubId: 11, count: 4 },
      { clubId: 20, count: 5 },
    ];

    const result = sortLeaguesByMissingWork(leagues, clubs, missingProfileCounts);

    // League 1 totals 8 (4 + 4), league 2 totals 5 — league 1 wins.
    expect(result.map((league) => league.id)).toEqual([1, 2]);
  });

  it("rotates priority to the next-neediest league once the top one is fully backfilled", () => {
    const leagues = [{ id: 1 }, { id: 2 }];
    const clubs = [
      { id: 10, leagueId: 1, squadLastSyncedAt: null },
      { id: 20, leagueId: 2, squadLastSyncedAt: new Date() },
    ];

    const beforeBackfill = sortLeaguesByMissingWork(leagues, clubs, [
      { clubId: 20, count: 2 },
    ]);
    expect(beforeBackfill.map((league) => league.id)).toEqual([1, 2]);

    // Simulate the next run after league 1's club has been synced and
    // league 2's club still has missing profiles: recomputed from scratch,
    // with no persisted score, league 2 should now lead.
    const clubsAfterBackfill = [
      { id: 10, leagueId: 1, squadLastSyncedAt: new Date() },
      { id: 20, leagueId: 2, squadLastSyncedAt: new Date() },
    ];
    const afterBackfill = sortLeaguesByMissingWork(leagues, clubsAfterBackfill, [
      { clubId: 20, count: 2 },
    ]);
    expect(afterBackfill.map((league) => league.id)).toEqual([2, 1]);
  });

  it("scores a league with no clubs as 0 and does not throw", () => {
    const leagues = [{ id: 1 }, { id: 2 }];
    const clubs = [{ id: 10, leagueId: 1, squadLastSyncedAt: null }];

    const result = sortLeaguesByMissingWork(leagues, clubs, []);

    expect(result.map((league) => league.id)).toEqual([1, 2]);
  });

  it("returns leagues unchanged when there's nothing to compare", () => {
    const leagues = [{ id: 1 }];

    const result = sortLeaguesByMissingWork(leagues, [], []);

    expect(result).toEqual(leagues);
  });
});
