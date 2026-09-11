import { describe, expect, it } from "vitest";
import { computeLeaguePlayerStats } from "./leagueStats.js";

describe("computeLeaguePlayerStats", () => {
  it("averages age over players with a known age only", () => {
    const result = computeLeaguePlayerStats([
      { age: 20, nationality: null, club: null },
      { age: 30, nationality: null, club: null },
      { age: null, nationality: null, club: null },
    ]);

    expect(result.averageAge).toBe(25);
    expect(result.totalActivePlayers).toBe(3);
  });

  it("excludes an implausible age (a sync-side data bug, not a real age) from the average", () => {
    // Real case: two Premier League players currently carry age: 2025 from
    // API-Football's squad sync.
    const result = computeLeaguePlayerStats([
      { age: 24, nationality: null, club: null },
      { age: 26, nationality: null, club: null },
      { age: 2025, nationality: null, club: null },
    ]);

    expect(result.averageAge).toBe(25);
  });

  it("returns a null average age when no player has a known age", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: null, club: null },
    ]);

    expect(result.averageAge).toBeNull();
  });

  it("counts a player as foreign when their nationality differs from their club's area", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: "Spain", club: { area: { name: "Spain" } } },
      {
        age: null,
        nationality: "Argentina",
        club: { area: { name: "Spain" } },
      },
    ]);

    expect(result.playersWithKnownNationality).toBe(2);
    expect(result.foreignPlayerPercentage).toBe(50);
  });

  it("excludes players with an unknown nationality from the percentage", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: "Spain", club: { area: { name: "Spain" } } },
      { age: null, nationality: null, club: { area: { name: "Spain" } } },
      { age: null, nationality: null, club: { area: { name: "Spain" } } },
    ]);

    expect(result.playersWithKnownNationality).toBe(1);
    expect(result.foreignPlayerPercentage).toBe(0);
  });

  it("excludes players whose club has no known area, even with a known nationality", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: "Spain", club: { area: null } },
      { age: null, nationality: "Spain", club: null },
    ]);

    expect(result.playersWithKnownNationality).toBe(0);
    expect(result.foreignPlayerPercentage).toBeNull();
  });

  it("returns a null percentage when nationality is unknown for every player", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: null, club: { area: { name: "Spain" } } },
    ]);

    expect(result.foreignPlayerPercentage).toBeNull();
  });

  it("rounds the percentage to one decimal place", () => {
    const result = computeLeaguePlayerStats([
      { age: null, nationality: "Spain", club: { area: { name: "Spain" } } },
      {
        age: null,
        nationality: "Argentina",
        club: { area: { name: "Spain" } },
      },
      { age: null, nationality: "Spain", club: { area: { name: "Spain" } } },
    ]);

    expect(result.foreignPlayerPercentage).toBe(33.3);
  });
});
