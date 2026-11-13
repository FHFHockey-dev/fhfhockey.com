import { resolveOfficialStarter, type OfficialStartAppearance } from "./historyLedger";

export type GoalieMembershipStint = {
  stintId: string; team: string;
  /** Inclusive membership start / exclusive end. Null end means still a member, not missing data. */
  fromAt: string | null; untilAt: string | null;
  boundaryStatus: "verified" | "unknown"; evidenceIds: string[];
};
export type GoalieHistoryGame = {
  gameId: number; team: string; seasonId: number; gameType: number; date: string; startsAt: string;
  /** Derived from the canonical final-state predicate and independently reconciled team report. */
  final: boolean; reported: boolean; appearancesComplete: boolean; evidenceIds: string[];
};
export type GoalieHistoryAppearance = OfficialStartAppearance & { gameId: number; team: string; evidenceIds: string[] };
export type GoalieStintWorkloadInput = {
  goalieId: number;
  scope: { seasonId: number; gameType: number; fromAt: string; throughAt: string };
  observedAt: string;
  /** Complete for the entire requested scope, not merely for games with an appearance. */
  scheduleComplete: boolean; membershipComplete: boolean;
  scheduleEvidenceIds: string[]; membershipEvidenceIds: string[];
  stints: GoalieMembershipStint[]; games: GoalieHistoryGame[]; appearances: GoalieHistoryAppearance[];
};
export type WorkloadCounts = {
  starts: number; appearances: number; reliefAppearances: number;
  knownEligibleTeamGames: number; eligibleTeamGames: number | null;
  startShare: number | null; appearanceShare: number | null;
  selectedGameIds: number[]; unresolvedStartGameIds: number[]; unresolvedAppearanceGameIds: number[];
  reasons: string[];
};
const unique = <T extends string | number>(values: T[]): T[] => [...new Set(values)].sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
function clock(value: string): number {
  if (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Goalie history requires an unambiguous timestamp.");
  return Date.parse(value);
}
function finalize(counts: Omit<WorkloadCounts, "startShare" | "appearanceShare">): WorkloadCounts {
  const denominator = counts.eligibleTeamGames;
  return { ...counts,
    startShare: denominator !== null && denominator > 0 && counts.unresolvedStartGameIds.length === 0 ? counts.starts / denominator : null,
    appearanceShare: denominator !== null && denominator > 0 && counts.unresolvedAppearanceGameIds.length === 0 ? counts.appearances / denominator : null };
}

/**
 * Player workload across membership episodes. This does NOT sum whole-season team GP or average
 * stint percentages. A traded player's denominator is the union of his clubs' team games while he
 * belonged to each club, including injury/scratch absences. The adapter must supply membership
 * evidence: a first appearance, current team field or last observed roster is not a trade timestamp.
 *
 * This is current-recorded descriptive history. It makes no as-issued/replay or calibrated forecast
 * claim, and cannot fabricate membership/finality/completeness to turn missing information into 0.
 */
export function buildGoalieStintWorkload(input: GoalieStintWorkloadInput) {
  const from = clock(input.scope.fromAt), through = clock(input.scope.throughAt), observed = clock(input.observedAt);
  if (from >= through || through > observed || !Number.isInteger(input.goalieId) || input.goalieId <= 0) throw new Error("Invalid goalie workload scope.");
  const boundaryTime = (stint: GoalieMembershipStint) => stint.boundaryStatus === "verified" && stint.fromAt !== null ? clock(stint.fromAt) : Infinity;
  const stints = [...input.stints].sort((a, b) => {
    const aTime = boundaryTime(a), bTime = boundaryTime(b);
    return aTime === bTime ? a.stintId.localeCompare(b.stintId) : aTime - bTime;
  });
  if (new Set(stints.map(s => s.stintId)).size !== stints.length) throw new Error("Duplicate membership stint.");
  let previousEnd = -Infinity;
  for (const stint of stints) {
    if (stint.boundaryStatus !== "verified" || stint.fromAt === null) continue;
    const start = clock(stint.fromAt), end = stint.untilAt === null ? Infinity : clock(stint.untilAt);
    if (start >= end || start < previousEnd) throw new Error("Invalid or overlapping goalie membership stints.");
    previousEnd = end;
  }
  const games = input.games.filter(g => g.seasonId === input.scope.seasonId && g.gameType === input.scope.gameType
    && clock(g.startsAt) >= from && clock(g.startsAt) < through).sort((a, b) => clock(a.startsAt) - clock(b.startsAt) || a.gameId - b.gameId);
  if (new Set(games.map(g => `${g.team}:${g.gameId}`)).size !== games.length) throw new Error("Duplicate team-game identity.");
  const globalReasons = [
    ...(!input.scheduleComplete || !input.scheduleEvidenceIds.length ? ["schedule_coverage_incomplete"] : []),
    ...(!input.membershipComplete || !input.membershipEvidenceIds.length || !stints.length ? ["membership_coverage_incomplete"] : [])
  ];
  const ownObservedGames = games.filter(g => input.appearances.some(a => a.goalieId === input.goalieId && a.gameId === g.gameId && a.team === g.team));
  if (ownObservedGames.some(g => !stints.some(s => s.team === g.team && s.boundaryStatus === "verified" && s.fromAt !== null
    && clock(g.startsAt) >= clock(s.fromAt) && (s.untilAt === null || clock(g.startsAt) < clock(s.untilAt))))) {
    globalReasons.push("appearance_outside_verified_membership");
  }
  const results = stints.map(stint => {
    const boundaryKnown = stint.boundaryStatus === "verified" && stint.fromAt !== null && stint.evidenceIds.length > 0;
    const start = boundaryKnown ? clock(stint.fromAt!) : Infinity;
    const end = stint.untilAt === null ? Infinity : clock(stint.untilAt);
    const opportunities = games.filter(g => g.team === stint.team && clock(g.startsAt) >= start && clock(g.startsAt) < end);
    const completed = opportunities.filter(g => g.final && g.reported && g.evidenceIds.length > 0);
    const reasons = [...globalReasons, ...(!boundaryKnown ? ["membership_boundary_unknown"] : []),
      ...(completed.length !== opportunities.length ? ["team_game_evidence_incomplete"] : [])];
    let starts = 0, appearances = 0, reliefAppearances = 0;
    const unresolvedStartGameIds: number[] = [], unresolvedAppearanceGameIds: number[] = [];
    for (const game of completed) {
      const rows = input.appearances.filter(a => a.gameId === game.gameId && a.team === game.team);
      const starter = game.appearancesComplete && rows.every(r => r.evidenceIds.length > 0) ? resolveOfficialStarter(rows) : null;
      if (starter === null) unresolvedStartGameIds.push(game.gameId);
      else if (starter === input.goalieId) starts++;
      const own = rows.filter(r => r.goalieId === input.goalieId);
      if (own.length === 1 && own[0].evidenceIds.length > 0) {
        appearances++;
        if (own[0].started === false) reliefAppearances++;
      }
      if (!game.appearancesComplete || rows.length === 0 || own.length > 1 || own.some(r => !r.evidenceIds.length)) unresolvedAppearanceGameIds.push(game.gameId);
    }
    if (unresolvedStartGameIds.length) reasons.push("official_start_labels_unresolved");
    if (unresolvedAppearanceGameIds.length) reasons.push("appearance_coverage_incomplete");
    return { stintId: stint.stintId, team: stint.team, fromAt: stint.fromAt, untilAt: stint.untilAt,
      ...finalize({ starts, appearances, reliefAppearances, knownEligibleTeamGames: completed.length,
        eligibleTeamGames: boundaryKnown && globalReasons.length === 0 && completed.length === opportunities.length ? completed.length : null,
        selectedGameIds: completed.map(g => g.gameId), unresolvedStartGameIds, unresolvedAppearanceGameIds, reasons: unique(reasons) }) };
  });
  const selectedGameIds = results.flatMap(s => s.selectedGameIds);
  // A game cannot be credited twice even if a membership feed describes both teams at puck drop.
  if (new Set(selectedGameIds).size !== selectedGameIds.length) throw new Error("A game belongs to multiple goalie membership stints.");
  const total = finalize({ starts: results.reduce((n, s) => n + s.starts, 0), appearances: results.reduce((n, s) => n + s.appearances, 0),
    reliefAppearances: results.reduce((n, s) => n + s.reliefAppearances, 0), knownEligibleTeamGames: results.reduce((n, s) => n + s.knownEligibleTeamGames, 0),
    eligibleTeamGames: globalReasons.length === 0 && results.every(s => s.eligibleTeamGames !== null) ? results.reduce((n, s) => n + s.eligibleTeamGames!, 0) : null,
    selectedGameIds: unique(selectedGameIds), unresolvedStartGameIds: unique(results.flatMap(s => s.unresolvedStartGameIds)),
    unresolvedAppearanceGameIds: unique(results.flatMap(s => s.unresolvedAppearanceGameIds)), reasons: unique([...globalReasons, ...results.flatMap(s => s.reasons)]) });
  return { contract: "goalie-stint-workload-v1" as const, goalieId: input.goalieId, scope: { ...input.scope }, observedAt: input.observedAt,
    basis: "current_recorded_history" as const, denominator: "team_games_during_club_membership" as const,
    stints: results, total,
    evidenceIds: unique([...input.scheduleEvidenceIds, ...input.membershipEvidenceIds, ...stints.flatMap(s => s.evidenceIds),
      ...games.filter(g => selectedGameIds.includes(g.gameId)).flatMap(g => g.evidenceIds),
      ...input.appearances.filter(a => selectedGameIds.includes(a.gameId)).flatMap(a => a.evidenceIds)]),
    forecast: { startProbability: null, status: "not_a_forecast" as const } };
}
