// Trims an arbitrary prose extract (from Wikipedia) down to its first N
// sentences. Sentence-boundary detection on real prose is inherently a
// heuristic, not exact grammar — verified live against actual Wikipedia
// extracts (see textExtract.test.ts): splitting on ". " alone breaks on
// abbreviations like "1. FC Köln"'s "e. V." or the leading "1.", so a
// candidate boundary only counts as real when the word right before the
// punctuation is longer than two characters (long enough not to be an
// initial, "e.", "V.", "St.", a bare year fragment, etc.).
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9])/;
const TRAILING_WORD_AND_PUNCTUATION = /([A-Za-z0-9]+)[.!?]+$/;

export function firstNSentences(text: string, n: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const candidates = normalized.split(SENTENCE_SPLIT);
  const sentences: string[] = [];
  let current = "";

  for (const candidate of candidates) {
    current = current ? `${current} ${candidate}` : candidate;

    if (isRealSentenceBoundary(current)) {
      sentences.push(current);
      current = "";

      if (sentences.length >= n) {
        break;
      }
    }
  }

  if (current && sentences.length < n) {
    sentences.push(current);
  }

  return sentences.slice(0, n).join(" ");
}

function isRealSentenceBoundary(fragment: string): boolean {
  const match = fragment.match(TRAILING_WORD_AND_PUNCTUATION);

  return match !== null && match[1].length > 2;
}
