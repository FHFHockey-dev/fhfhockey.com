import type { BeatReporterReview, BeatReporterVerdict } from "./beatReporters";

const BEGIN = "// BEGIN BEAT_REPORTER_REVIEWS";
const END = "// END BEAT_REPORTER_REVIEWS";
const DECLARATION = "export const BEAT_REPORTER_REVIEWS: BeatReporterReview[] = ";
const HANDLE = /^[a-z0-9_]{1,15}$/;
const TEAM = /^[A-Z]{3}$/;

function block(source: string): { start: number; end: number } {
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start < 0 || end < start) throw new Error("beatReporters.ts is missing its BEGIN/END review markers.");
  return { start: start + BEGIN.length, end };
}

/** Reads the reviews array out of beatReporters.ts source. */
export function parseReviews(source: string): BeatReporterReview[] {
  const { start, end } = block(source);
  const body = source.slice(start, end).trim();
  if (!body.startsWith(DECLARATION) || !body.endsWith(";")) throw new Error("beatReporters.ts review block is not in the expected shape.");
  return JSON.parse(body.slice(DECLARATION.length, -1)) as BeatReporterReview[];
}

/** Validates and normalises one decision; throws on a bad handle, verdict or team. */
export function normaliseReview(input: { handle: unknown; verdict: unknown; teamAbbrevs?: unknown; evidenceCount?: unknown }, reviewedAt: string): BeatReporterReview {
  const handle = typeof input.handle === "string" ? input.handle.replace(/^@/, "").toLowerCase() : "";
  if (!HANDLE.test(handle)) throw new Error("Invalid handle.");
  const verdict = input.verdict as BeatReporterVerdict;
  if (verdict !== "beat" && verdict !== "not_beat") throw new Error("Invalid verdict.");
  const teams = Array.isArray(input.teamAbbrevs) ? [...new Set(input.teamAbbrevs.map((team) => String(team).toUpperCase()))] : [];
  if (teams.some((team) => !TEAM.test(team))) throw new Error("Invalid team abbreviation.");
  if (verdict === "beat" && !teams.length) throw new Error("A beat reporter needs at least one team.");
  const evidenceCount = Number.isSafeInteger(input.evidenceCount) && (input.evidenceCount as number) >= 0 ? (input.evidenceCount as number) : 0;
  return { handle, verdict, teamAbbrevs: verdict === "beat" ? teams : [], reviewedAt, evidenceCount };
}

/** Replaces any earlier review of the handle; keeps the list sorted by handle so diffs stay small. */
export function upsertReview(reviews: BeatReporterReview[], review: BeatReporterReview): BeatReporterReview[] {
  return [...reviews.filter((entry) => entry.handle !== review.handle), review].sort((a, b) => a.handle.localeCompare(b.handle));
}

export function removeReview(reviews: BeatReporterReview[], handle: string): BeatReporterReview[] {
  const key = handle.replace(/^@/, "").toLowerCase();
  return reviews.filter((entry) => entry.handle !== key);
}

/** beatReporters.ts source with the review block replaced; everything outside the markers is kept byte for byte. */
export function renderReviews(source: string, reviews: BeatReporterReview[]): string {
  const { start, end } = block(source);
  const rows = reviews.map((review) => `  ${JSON.stringify(review)}`).join(",\n");
  const array = reviews.length ? `[\n${rows}\n]` : "[]";
  return `${source.slice(0, start)}\n${DECLARATION}${array};\n${source.slice(end)}`;
}
