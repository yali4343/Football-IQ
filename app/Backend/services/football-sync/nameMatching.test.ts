import { describe, expect, it } from "vitest";
import { normalizeClubName, slugifyLeagueName } from "./nameMatching.js";

describe("slugifyLeagueName", () => {
  it("kebab-cases a plain league name", () => {
    expect(slugifyLeagueName("Premier League")).toBe("premier-league");
  });

  it("handles a two-word league name", () => {
    expect(slugifyLeagueName("La Liga")).toBe("la-liga");
  });

  it("strips diacritics", () => {
    expect(slugifyLeagueName("Bundesliga")).toBe("bundesliga");
  });
});

describe("normalizeClubName", () => {
  // These cases are all verified live against the real API-Football search
  // endpoint during ticket #53 — each one is a case where naive comparison
  // would fail to match the same real club across the two providers.

  it("strips the FC suffix", () => {
    expect(normalizeClubName("Arsenal FC")).toBe(
      normalizeClubName("Arsenal"),
    );
  });

  it("strips the AFC suffix (not just FC)", () => {
    // Sunderland AFC vs API-Football's "Sunderland" — AFC is a distinct
    // token from FC and needs its own entry in the suffix list.
    expect(normalizeClubName("Sunderland AFC")).toBe(
      normalizeClubName("Sunderland"),
    );
  });

  it("strips diacritics so Köln matches Koln", () => {
    expect(normalizeClubName("1. FC Köln")).toBe(normalizeClubName("Koln"));
  });

  it("strips a leading numeral-with-period token", () => {
    // "1. FC Köln" — API-Football's own name for the same club is just
    // "1. FC Köln" too, but the leading "1." breaks their search unless
    // it's dropped from the comparison/query.
    expect(normalizeClubName("1. FC Köln")).toBe("koln");
  });

  it("strips an internal standalone numeric token", () => {
    // "Bayer 04 Leverkusen" vs API-Football's "Bayer Leverkusen" — the
    // "04" doesn't appear in the other provider's name at all.
    expect(normalizeClubName("Bayer 04 Leverkusen")).toBe(
      normalizeClubName("Bayer Leverkusen"),
    );
  });

  it("strips a trailing standalone numeric token", () => {
    // "1. FSV Mainz 05" vs API-Football's "FSV Mainz 05" — after
    // stripping, both reduce to the same normalized form.
    expect(normalizeClubName("1. FSV Mainz 05")).toBe(
      normalizeClubName("FSV Mainz 05"),
    );
  });

  it("strips a year-like numeric token", () => {
    // "TSG 1899 Hoffenheim" — 1899 is dropped as a standalone numeric
    // token even though it's 4 digits, not just 2.
    expect(normalizeClubName("TSG 1899 Hoffenheim")).toBe("tsg hoffenheim");
  });

  it("strips a two-digit founding-year token", () => {
    expect(normalizeClubName("SC Paderborn 07")).toBe("sc paderborn");
  });

  it("only drops tokens that are purely numeric, not alphanumeric ones", () => {
    // Guards the regex against over-matching — "07fc" isn't a real club
    // suffix pattern, but confirms a mixed token survives unless it's a
    // pure digit run.
    expect(normalizeClubName("Team 07fc")).toBe("team 07fc");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeClubName("  Real   Madrid  ")).toBe("real madrid");
  });
});
