import { teamStartShare, type CompletedTeamGame, type GoalieAppearance } from "lib/socialShare/modules/shared/goalieLedger";

export const GOALIE_WORKLOAD_VERSION = "goalie-workload-view-v1" as const;
export type GoalieLookback = { kind: "team_games"; count: 5 | 10 | 20 }
  | { kind: "calendar_days"; count: 7 | 14 | 30 } | { kind: "season" };
export const DEFAULT_GOALIE_LOOKBACK: GoalieLookback = { kind: "team_games", count: 10 };
export type GoalieWorkloadSnapshot = {
  version: typeof GOALIE_WORKLOAD_VERSION; seasonId: number; seasonStartsOn: string;
  source: string; revision: string; observedAt: string; dataThrough: string | null;
  /** Retrospective results, never pregame as-issued information or predictive evidence. */
  basis: "current_recorded_results";
  scheduleVerifiedThrough: string | null; scheduleComplete: boolean; appearancesComplete: boolean;
  coverageBasis?: "stored_regular_season_schedule";
  /** Complete reconciliation of the bounded stored schedule, including every unresolved game. */
  scheduleCoverage?: { version: "stored-team-schedule-v1"; from: string; through: string; scheduledGames: number;
    gaps: { gameId: number; date: string; reason: "unreported" | "not_final" }[] };
  teamId?: number;
  games: readonly (CompletedTeamGame & { seasonId: number; state: "final"; completedAt: string | null;
    finality?: { basis: "single_stored_game_end"; observedAt: string } })[];
  appearances: readonly GoalieAppearance[];
};
export type GoalieWorkloadView = {
  state: "complete" | "partial" | "unavailable" | "no_games";
  from: string | null; through: string; firstGameDate: string | null; lastGameDate: string | null;
  dataThrough: string | null; requestedGames: number | null; observedTeamGames: number; denominator: number | null;
  resolvedStarts: number; unresolvedStarts: number | null; shortSample: boolean;
  goalies: { playerId: number; name: string | null; starts: number; knownStartShare: number | null; appearances: number; reliefAppearances: number; unknownLabels: number }[];
  reasons: string[];
};
const dateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const shiftDate = (s: string, days: number) => new Date(Date.parse(`${s}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const goalieNewYorkDate = (instant: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function goalieHistoryWindow(lookback: GoalieLookback, dates: { today: string; selectedFrom: string; selectedThrough: string; seasonStartsOn: string }) {
  if (![dates.today, dates.selectedFrom, dates.selectedThrough, dates.seasonStartsOn].every(dateOnly) || dates.selectedFrom > dates.selectedThrough) throw new Error("Invalid goalie history dates.");
  // The historical lookback and the future schedule are different windows.
  const through = dates.selectedThrough < dates.today ? shiftDate(dates.selectedFrom, -1) : dates.today;
  const from = lookback.kind === "calendar_days" ? [shiftDate(through, 1 - lookback.count), dates.seasonStartsOn].sort().at(-1)!
    : lookback.kind === "season" ? dates.seasonStartsOn : null;
  return { from, through, requestedGames: lookback.kind === "team_games" ? lookback.count : null };
}

/** Descriptive official starts only. Existing ledger math remains unchanged. */
export function buildGoalieWorkloadView(team: string, lookback: GoalieLookback, snapshot: GoalieWorkloadSnapshot | null,
  dates: { today: string; selectedFrom: string; selectedThrough: string; seasonStartsOn: string; seasonId: number; asOf?: string }): GoalieWorkloadView {
  const window = goalieHistoryWindow(lookback, dates);
  const result: GoalieWorkloadView = { ...window, state: "unavailable", firstGameDate: null, lastGameDate: null,
    dataThrough: snapshot?.dataThrough ?? null, observedTeamGames: 0, denominator: null, resolvedStarts: 0, unresolvedStarts: null,
    shortSample: false, goalies: [], reasons: [] };
  const fail = (reason: string) => ({ ...result, reasons: [reason] });
  if (!snapshot || snapshot.version !== GOALIE_WORKLOAD_VERSION) return fail("Historical workload source unavailable.");
  if (snapshot.seasonId !== dates.seasonId || snapshot.seasonStartsOn !== dates.seasonStartsOn) return fail("History does not match the selected season.");
  if (!snapshot.source || !snapshot.revision || !Number.isFinite(Date.parse(snapshot.observedAt))
    || snapshot.basis !== "current_recorded_results") return fail("Historical source lineage unavailable.");
  if (dates.asOf && (!Number.isFinite(Date.parse(dates.asOf)) || Date.parse(snapshot.observedAt) > Date.parse(dates.asOf))) return fail("Historical source observation is after this view's cutoff.");
  if (window.through < dates.seasonStartsOn) return fail("The lookback is before this season; prior-season games are not included.");
  const games = snapshot.games.filter(g => g.team === team && g.seasonId === dates.seasonId && g.state === "final"
    && dateOnly(g.date) && g.date >= dates.seasonStartsOn && g.date <= window.through && (!window.from || g.date >= window.from)
    && (g.completedAt !== null
      ? Number.isFinite(Date.parse(g.completedAt)) && Date.parse(g.completedAt) <= Date.parse(snapshot.observedAt) && goalieNewYorkDate(g.completedAt) <= window.through
      : g.finality?.basis === "single_stored_game_end" && Number.isFinite(Date.parse(g.finality.observedAt))
        && Date.parse(g.finality.observedAt) <= Date.parse(snapshot.observedAt)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
  if (new Set(games.map(g => g.gameId)).size !== games.length) return fail("Duplicate completed team games; denominator unavailable.");
  const selected = window.requestedGames == null ? games : games.slice(-window.requestedGames);
  const ids = new Map(selected.map(g => [g.gameId, g]));
  const appearances = snapshot.appearances.filter(a => a.team === team && ids.get(a.gameId)?.date === a.date);
  if (new Set(appearances.map(a => `${a.goalieId}:${a.gameId}`)).size !== appearances.length) return fail("Duplicate goalie appearances; workload unavailable.");
  const ledger = teamStartShare(team, selected, appearances, null);
  const unresolved = new Set(ledger.unresolvedGames);
  const coverageFrom = window.from ?? (selected.length === window.requestedGames ? selected[0].date : dates.seasonStartsOn);
  const evidence = snapshot.scheduleCoverage;
  const teamGames = snapshot.games.filter(g => g.team === team);
  // Full last-N windows only depend on gaps from their earliest date onward. Short samples still depend on the whole season.
  // Dates, rather than game-id ordering, keep an unresolved game on the boundary date conservative.
  const scopedCoverage = evidence !== undefined && evidence.version === "stored-team-schedule-v1"
    && dateOnly(evidence.from) && dateOnly(evidence.through) && evidence.from <= coverageFrom && evidence.through >= window.through
    && Number.isSafeInteger(evidence.scheduledGames) && evidence.scheduledGames > 0 && evidence.scheduledGames <= 100
    && evidence.scheduledGames === teamGames.length + evidence.gaps.length
    && new Set([...teamGames.map(g => g.gameId), ...evidence.gaps.map(g => g.gameId)]).size === evidence.scheduledGames
    && teamGames.every(g => g.seasonId === dates.seasonId && g.state === "final" && dateOnly(g.date) && g.date >= evidence.from && g.date <= evidence.through)
    && evidence.gaps.every(g => Number.isSafeInteger(g.gameId) && g.gameId > 0 && dateOnly(g.date) && g.date >= evidence.from && g.date <= evidence.through
      && ["unreported", "not_final"].includes(g.reason))
    && !evidence.gaps.some(g => g.date >= coverageFrom && g.date <= window.through)
    && teamGames.filter(g => g.date >= coverageFrom && g.date <= window.through).every(g => games.some(verified => verified.gameId === g.gameId));
  const coverage = (evidence ? scopedCoverage : snapshot.scheduleComplete) && snapshot.appearancesComplete
    && snapshot.scheduleVerifiedThrough != null && dateOnly(snapshot.scheduleVerifiedThrough) && snapshot.scheduleVerifiedThrough >= window.through;
  const goalies = ledger.goalies.map(g => {
    const rows = appearances.filter(a => a.goalieId === g.goalieId);
    const starts = rows.filter(a => a.started === true && !unresolved.has(a.gameId)).length;
    return { playerId: g.goalieId, name: g.name, starts,
      knownStartShare: coverage && selected.length ? starts / selected.length : null,
      appearances: rows.length, reliefAppearances: rows.filter(a => a.started === false).length,
      unknownLabels: rows.filter(a => a.started === null).length };
  }).sort((a, b) => b.starts - a.starts || a.playerId - b.playerId);
  return { ...result, state: !coverage ? "partial" : !selected.length ? "no_games" : unresolved.size ? "partial" : "complete",
    firstGameDate: selected[0]?.date ?? null, lastGameDate: selected.at(-1)?.date ?? null,
    observedTeamGames: selected.length, denominator: coverage ? selected.length : null,
    resolvedStarts: goalies.reduce((n, g) => n + g.starts, 0), unresolvedStarts: coverage ? unresolved.size : null,
    shortSample: window.requestedGames != null && selected.length < window.requestedGames, goalies,
    reasons: [...(!coverage ? ["Schedule or appearance coverage is incomplete; shares and the full denominator are unavailable."] : []),
      ...(unresolved.size ? ["Some completed games lack exactly one official starter. Their start share remains unresolved."] : []),
      "Historical workload uses current recorded results. It is not a calibrated forecast or an as-issued historical snapshot."] };
}
