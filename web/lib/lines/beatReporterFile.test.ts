import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { normaliseReview, parseReviews, removeReview, renderReviews, upsertReview } from "./beatReporterFile";

const SOURCE = readFileSync(path.join(__dirname, "beatReporters.ts"), "utf8");
const AT = "2026-11-07T20:00:00.000Z";

describe("beatReporters.ts writer", () => {
  it("round-trips the committed data file", () => {
    const reviews = parseReviews(SOURCE);
    expect(parseReviews(renderReviews(SOURCE, reviews))).toEqual(reviews);
  });

  it("writes decisions sorted by handle, replaces a re-review and keeps text outside the markers", () => {
    let reviews = parseReviews(SOURCE).filter(() => false);
    reviews = upsertReview(reviews, normaliseReview({ handle: "@Stefen_Rosner", verdict: "beat", teamAbbrevs: ["nyi"], evidenceCount: 79 }, AT));
    reviews = upsertReview(reviews, normaliseReview({ handle: "agrossnewsday", verdict: "not_beat", teamAbbrevs: ["NYI"], evidenceCount: 43 }, AT));
    reviews = upsertReview(reviews, normaliseReview({ handle: "agrossnewsday", verdict: "beat", teamAbbrevs: ["NYI", "NYI"], evidenceCount: 43 }, AT));
    const written = renderReviews(SOURCE, reviews);
    expect(parseReviews(written)).toEqual([
      { handle: "agrossnewsday", verdict: "beat", teamAbbrevs: ["NYI"], reviewedAt: AT, evidenceCount: 43 },
      { handle: "stefen_rosner", verdict: "beat", teamAbbrevs: ["NYI"], reviewedAt: AT, evidenceCount: 79 }
    ]);
    const outside = (text: string) => text.replace(/\/\/ BEGIN BEAT_REPORTER_REVIEWS[\s\S]*\/\/ END BEAT_REPORTER_REVIEWS/, "");
    expect(outside(written)).toBe(outside(SOURCE));
    expect(parseReviews(renderReviews(written, removeReview(parseReviews(written), "@AGrossNewsday"))).map((review) => review.handle)).toEqual(["stefen_rosner"]);
  });

  it("drops teams for a not-beat verdict and rejects bad input", () => {
    expect(normaliseReview({ handle: "x_y", verdict: "not_beat", teamAbbrevs: ["TOR"] }, AT).teamAbbrevs).toEqual([]);
    expect(() => normaliseReview({ handle: "has space", verdict: "beat", teamAbbrevs: ["TOR"] }, AT)).toThrow("Invalid handle");
    expect(() => normaliseReview({ handle: "ok", verdict: "maybe" }, AT)).toThrow("Invalid verdict");
    expect(() => normaliseReview({ handle: "ok", verdict: "beat", teamAbbrevs: [] }, AT)).toThrow("at least one team");
    expect(() => normaliseReview({ handle: "ok", verdict: "beat", teamAbbrevs: ["TORONTO"] }, AT)).toThrow("Invalid team");
  });

  it("refuses a file without its markers", () => {
    expect(() => parseReviews("export const X = 1;")).toThrow("markers");
  });
});
