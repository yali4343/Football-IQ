import { describe, expect, it } from "vitest";
import { firstNSentences } from "./textExtract.js";

// Fetched live from Wikipedia's MediaWiki API (action=query&prop=extracts&
// exintro=true&explaintext=true&redirects=1&titles=1. FC Köln) — chosen
// deliberately because it's full of sentence-boundary traps: "1." as a
// leading numeral, "e. V." (a German legal-entity abbreviation), and
// "2024–25 2. Bundesliga" (a lone digit before a period, followed by a
// capitalized word).
const FC_KOLN_EXTRACT =
  "1. Fußball-Club Köln 01/07 e. V., better known as simply 1. FC Köln " +
  "(German pronunciation: [ɛf ˈt͡seː ˈkœln] ) or FC Cologne in English, is " +
  "a German professional football club based in Cologne, North Rhine-" +
  "Westphalia. It was formed in 1948 as a merger of the clubs Kölner " +
  "Ballspiel-Club 1901 and SpVgg Sülz 07. Köln compete in the first-tier " +
  "Bundesliga after winning the 2024–25 2. Bundesliga season and plays " +
  "its home matches at RheinEnergieStadion. 1. FC Köln was formed in " +
  "1948 through the merger of Kölner BC 01 and SpVgg Sülz 07, two " +
  "successful local sides. It was a founding member of the Bundesliga in " +
  "1963 and was crowned its inaugural champions the following year.";

describe("firstNSentences", () => {
  it("does not break on the leading '1.' numeral or the 'e. V.' abbreviation", () => {
    // The real first sentence runs all the way to "...Westphalia." despite
    // three abbreviation-like traps along the way.
    const result = firstNSentences(FC_KOLN_EXTRACT, 1);

    expect(result).toBe(
      "1. Fußball-Club Köln 01/07 e. V., better known as simply 1. FC Köln " +
        "(German pronunciation: [ɛf ˈt͡seː ˈkœln] ) or FC Cologne in " +
        "English, is a German professional football club based in " +
        "Cologne, North Rhine-Westphalia.",
    );
  });

  it("never cuts off mid-abbreviation, even when that costs an extra sentence", () => {
    // A trailing short numeral like "...Sülz 07." is indistinguishable
    // from an abbreviation by this heuristic, so it gets folded into the
    // next sentence rather than risking a truncated-looking cutoff — the
    // result runs one real sentence past N here (ends at
    // "...RheinEnergieStadion." instead of "...Sülz 07."), never mid-word.
    const result = firstNSentences(FC_KOLN_EXTRACT, 2);

    expect(result.endsWith(".")).toBe(true);
    expect(result).not.toMatch(/\b(e|V|1)\.$/);
    expect(result).toMatch(/RheinEnergieStadion\.$/);
  });

  it("returns the whole text when fewer real sentences exist than requested", () => {
    const result = firstNSentences(FC_KOLN_EXTRACT, 100);

    expect(result).toBe(FC_KOLN_EXTRACT);
  });

  it("collapses internal whitespace/newlines", () => {
    const result = firstNSentences("First sentence.\n\nSecond sentence.", 1);

    expect(result).toBe("First sentence.");
  });

  it("returns an empty string for empty input", () => {
    expect(firstNSentences("", 3)).toBe("");
  });
});
