/**
 * Beat reporters reviewed one at a time by TJ at /db/beat-reporter-review (inferred from stored lineup posts).
 * The reviews block between the markers is rewritten by that page's dev-only route (lib/lines/beatReporterFile.ts):
 * edit by hand only in the same JSON shape. "not_beat" entries stay so the account is not offered again.
 */
export type BeatReporterVerdict = "beat" | "not_beat";
export type BeatReporterReview = {
  /** Lowercase X handle, no "@". */
  handle: string;
  verdict: BeatReporterVerdict;
  /** Team(s) the reporter covers (NHL abbreviations); empty for "not_beat". */
  teamAbbrevs: string[];
  reviewedAt: string;
  /** Stored lineup/goalie/practice posts attributed to the account when it was reviewed. */
  evidenceCount: number;
};

// BEGIN BEAT_REPORTER_REVIEWS
export const BEAT_REPORTER_REVIEWS: BeatReporterReview[] = [];
// END BEAT_REPORTER_REVIEWS

/** Confirmed beat reporters only. */
export const BEAT_REPORTERS: BeatReporterReview[] = BEAT_REPORTER_REVIEWS.filter((review) => review.verdict === "beat");
/** Lowercase handles of confirmed beat reporters, for the authority seed. */
export const BEAT_REPORTER_HANDLES: string[] = BEAT_REPORTERS.map((review) => review.handle);
