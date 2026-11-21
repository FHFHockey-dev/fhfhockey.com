/**
 * The labels Detailed RSO policy rows carry (TJ 2026-11-21). Pure and dependency-free so the RSO UI can read a row's
 * participation basis and availability changes without loading server modules. The text travels in
 * `GameForecast.limitations`, which the planning transport and saved snapshots already keep.
 */
export type RsoParticipationBasis = "confirmed_playing" | "confirmed_out" | "assumed_playing" | "assumed_out";
export type OverlayChange = { at: string; source: string; effect: RsoParticipationBasis | "no_change"; detail: string };

export const DETAILED_PARTICIPATION_NOTES: Record<RsoParticipationBasis, string> = {
  confirmed_playing: "Participation confirmed: a credible report confirms him in this game's lineup, so his line counts in full.",
  confirmed_out: "Participation confirmed out: a scratch, suspension, other roster exclusion or ruled-out report keeps him out of this game, so it counts 0; his 'if he plays' line is kept separately.",
  assumed_playing: "Participation assumed, not confirmed: he is on his team's active roster with no active injury or confirmed exclusion, so he is assumed to play and his line counts.",
  assumed_out: "Participation assumed out, not confirmed: he has an active injury status and no credible report confirms him back for this game, so he is assumed out and counts 0; his 'if he plays' line is kept separately.",
};
/** Plain words for the RSO UI. */
export const PARTICIPATION_BASIS_LABELS: Record<RsoParticipationBasis, string> = {
  assumed_playing: "Assumed playing", assumed_out: "Assumed out (injured)", confirmed_playing: "Confirmed playing", confirmed_out: "Confirmed out",
};
export const DETAILED_PARTICIPATION_CONFLICT_NOTE = "Lineup or availability reports for this game conflict; the latest applicable status stands until a report confirms.";
export const DETAILED_PARTICIPATION_LINE_ROLE_NOTE = "Line or PP roles were reported after this forecast; the saved line is kept and FORGE is not re-run.";

const CHANGE_PREFIX = "Availability update ";
/** One availability change, recorded apart from the issued forecast. */
export const overlayChangeNote = (change: Pick<OverlayChange, "at" | "source" | "detail">) =>
  `${CHANGE_PREFIX}${change.at} · ${change.source}: ${change.detail}.`;
const CHANGE_PATTERN = /^Availability update (\S+) · (.+?): (.+)\.$/;

const BASIS_BY_NOTE = new Map(Object.entries(DETAILED_PARTICIPATION_NOTES).map(([basis, note]) => [note, basis as RsoParticipationBasis]));
/** The participation basis a Detailed RSO row carries, found by membership in its limitations; null when none. */
export function detailedParticipationBasisOf(forecast: { limitations: readonly string[] }): RsoParticipationBasis | null {
  for (const note of forecast.limitations) { const basis = BASIS_BY_NOTE.get(note); if (basis) return basis; }
  return null;
}

/** What the UI shows for a policy row: its basis in plain words and each recorded change in order. Null for other rows. */
export function participationDisplay(forecast: { limitations: readonly string[] }) {
  const basis = detailedParticipationBasisOf(forecast);
  if (!basis) return null;
  const changes = forecast.limitations.flatMap(note => {
    const match = note.startsWith(CHANGE_PREFIX) ? CHANGE_PATTERN.exec(note) : null;
    return match ? [{ at: match[1], source: match[2], detail: match[3] }] : [];
  });
  return { basis, label: PARTICIPATION_BASIS_LABELS[basis], changes,
    conflict: forecast.limitations.includes(DETAILED_PARTICIPATION_CONFLICT_NOTE),
    lineRoleChanged: forecast.limitations.includes(DETAILED_PARTICIPATION_LINE_ROLE_NOTE) };
}
