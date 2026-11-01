import type { BoardConflict, BoardGoalieEvidence, DailyBoardEvidence } from "lib/projections/dailyBoardEvidence";
import type { StartChartParticipation } from "lib/projections/startChartContract";
import { currentSeason } from "lib/socialShare/schedule";
import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import { SHARE_POST_DEFAULT_TTL_SECONDS, type SharePostEvidence, type SharePostReadClient } from "../contract";
import { competitionRanks, editionDate } from "./definitions";
import { GOALIE_INVENTORY_VERSION, type GoalieConfirmation, type GoalieForecast, type GoalieGameSignals, type GoalieInventory, type GoalieInventoryEntry, type GoalieInventoryGame, type GoalieInventoryRequest, type GoalieInventorySource, type InventoryMetric, type LoadGoalieInventory, type SearchGoalieInventory } from "./goalieInventory";
import { TEAM_GAME_COLUMNS, teamStartShare, toCompletedTeamGames, type CompletedTeamGame, type GoalieAppearance, type TeamGameRow } from "./goalieLedger";

/**
 * Adapter for `goalie-inventory-v1` (CONTRACT.md §5). The mapping is pure and every Supabase-backed reader is imported
 * lazily inside the loader, so a card can use `searchGoalieInventory` and consumers can import this file with no client.
 */
export const INVENTORY_LENS_COLUMNS = ["goals_for", "goals_against", "pp_opportunities", "power_play_goals_for", "times_shorthanded", "pp_goals_against"] as const satisfies readonly (keyof Database["public"]["Tables"]["wgo_team_stats"]["Row"])[];
export const INVENTORY_NST_COLUMNS = ["team_abbreviation", "date", "season_id", "situation", "sf", "sa", "xgf", "xga", "scf", "sca", "updated_at"] as const satisfies readonly (keyof Database["public"]["Tables"]["nst_team_gamelogs_as_counts"]["Row"])[];
/** Only what the starter-board resolver needs. Raw report text and metadata never leave the database. */
export const INVENTORY_OBSERVATION_COLUMNS = ["id", "game_id", "team_id", "player_id", "observation_status", "source_key", "source_account", "source_url", "observed_at", "available_at", "created_at", "expires_at", "accepted"] as const satisfies readonly (keyof BoardGoalieEvidence)[];
export type InventoryTeamGameRow = TeamGameRow & Pick<Database["public"]["Tables"]["wgo_team_stats"]["Row"], typeof INVENTORY_LENS_COLUMNS[number]>;
export type InventoryNstRow = Pick<Database["public"]["Tables"]["nst_team_gamelogs_as_counts"]["Row"], typeof INVENTORY_NST_COLUMNS[number]>;
export type InventoryConfirmationInput = {
  /** The starter-board resolver's output. It applies source, timing, supersession, conflict and correction rules. */
  evidence: DailyBoardEvidence;
  expiresAt: ReadonlyMap<string, string | null>;
  /** Known limits of what was read, printed with the source. */
  gaps?: readonly string[];
};
export type InventoryScheduleRow = { id: number; date: string; startTime: string | null; homeTeamId: number; awayTeamId: number };
/** One goalie-game from Start Chart. `startProbability` is that row's own head, which a participation must equal. */
export type InventoryForecastInput = { gameId: number; goalieId: number; startProbability: number | null; startParticipation?: StartChartParticipation | null };
export type InventoryCoverage = { observed: number; expected: number; missing: number };
export type GoalieInventoryDetail = { inventory: GoalieInventory; coverage: InventoryCoverage | null; conflicts: readonly InventoryConflict[]; lowFirstRanks: InventoryLowFirstRanks };

export const CONFIRMATION_CLOSED_REASON = "Goalie start observations could not be read, so every goalie is unknown. That does not mean not starting.";
export const CONFIRMATION_ABSENT_NOTE = "Unknown means no current observation, not that the goalie is not starting. Observations cover part of the slate.";
export const CONFIRMATION_REPORTER_GAP = "Reports aren't separated by reporter, so conflicts between sources can't be detected.";
export const CONFIRMATION_LINK_GAP = "No source link or expiry exists for these reports.";
/** Limits of the rows read, stated on the card. A row with no account counts as one shared reporter in the resolver. */
export const observationGaps = (rows: readonly Pick<BoardGoalieEvidence, "source_account" | "source_url" | "expires_at">[]) => [
  ...(rows.some(row => !row.source_account) ? [CONFIRMATION_REPORTER_GAP] : []),
  ...(rows.length && rows.every(row => !row.source_url && !row.expires_at) ? [CONFIRMATION_LINK_GAP] : []),
];
export const FORECAST_CLOSED_REASON = "No admitted Start Chart start participation is available, so every forecast is unavailable. A raw start_probability is not admitted.";
const METRIC_WINDOW = "Season to date";

const DAY_MS = 86400000;
const shiftDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** Schedule window from the edition's New York date; rates stop at the day before, whose games are final. */
export function inventoryWindow(generatedAt: string, days: number) {
  const from = editionDate(generatedAt);
  return { from, through: shiftDays(from, days - 1), season: currentSeason(from) };
}
const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

/* Lenses */
export const TEAM_LENS_METRICS = ["shotsFor", "shotsAgainst", "xgf", "xga", "chancesFor", "chancesAgainst", "powerPlayPct", "penaltyKillPct", "timesShorthanded", "goalsFor", "goalsAgainst", "goalDifferential"] as const;
export type TeamLensMetric = typeof TEAM_LENS_METRICS[number];
export type TeamLens = Record<TeamLensMetric, InventoryMetric>;
/** Every metric ranks #1 at its highest value. Allowing the most shots, xG, chances or goals, or being shorthanded the most, is the weakest; the highest PK% is the strongest. */
const HIGH_IS_WEAK: ReadonlySet<TeamLensMetric> = new Set<TeamLensMetric>(["shotsAgainst", "xga", "chancesAgainst", "goalsAgainst", "timesShorthanded"]);
/** Competition ranks from the lowest value, by metric and team, for the `HIGH_IS_WEAK` metrics. Not in `goalie-inventory-v1`; posts read them from the detail, because a high-first rank can't be reversed across a tie. */
export type InventoryLowFirstRanks = Partial<Record<TeamLensMetric, Record<string, number>>>;
const METRIC_UNITS: Record<TeamLensMetric, string> = {
  shotsFor: "shots per game", shotsAgainst: "shots against per game", xgf: "NST xG per game", xga: "NST xG against per game", chancesFor: "NST scoring chances per game", chancesAgainst: "NST scoring chances against per game",
  powerPlayPct: "% of opportunities", penaltyKillPct: "% of times shorthanded", timesShorthanded: "times shorthanded per game", goalsFor: "goals per game", goalsAgainst: "goals against per game", goalDifferential: "goal differential per game",
};
const known = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const pooled = (numerators: readonly (number | null)[], denominators: readonly (number | null)[] | null, scale = 1) => {
  const pairs = numerators.flatMap((value, index) => { const denominator = denominators ? denominators[index] : 1; return known(value) && known(denominator) ? [[value, denominator]] : []; });
  const bottom = sum(pairs.map(pair => pair[1]));
  return { value: bottom > 0 ? sum(pairs.map(pair => pair[0])) * scale / bottom : null, sample: pairs.length };
};
const metric = (id: TeamLensMetric, value: number | null, sampleGames: number, leagueRank: number | null = null, leagueCohort: number | null = null): InventoryMetric => ({ value, unit: METRIC_UNITS[id], window: METRIC_WINDOW, sampleGames, leagueRank, leagueCohort });

/**
 * Season-to-date team rates, pooled from each game's counts (never a mean of rates). Shots, xG and chances are NST all
 * situations; goals, PP, PK and times shorthanded are WGO, whose zeros are known. A rank (1 = highest value) exists only
 * when every team has that value over all its completed games.
 */
export function buildTeamLenses(input: { teamGames: readonly InventoryTeamGameRow[]; nst: readonly InventoryNstRow[]; teams: readonly string[]; season: number; cutoff: string }): { lenses: Map<string, TeamLens>; lowFirstRanks: InventoryLowFirstRanks; nstCovered: number; updatedAt: string | null; asOf: string | null } {
  const byTeam = new Map(input.teams.map(team => [team, [] as InventoryTeamGameRow[]]));
  for (const row of input.teamGames) {
    const team = teamById.get(row.team_id ?? -1);
    if (team && row.season_id === input.season && row.game_id != null && row.date <= input.cutoff) byTeam.get(team)?.push(row);
  }
  const nstByKey = new Map<string, InventoryNstRow>();
  let updatedAt: string | null = null, asOf: string | null = null;
  for (const row of input.nst) {
    if (row.season_id !== input.season || row.situation !== "all" || row.date > input.cutoff) continue;
    const key = `${row.team_abbreviation}:${row.date}`;
    if (nstByKey.has(key)) throw new Error("NST team read returned a duplicate team date.");
    nstByKey.set(key, row);
    if (!asOf || row.date > asOf) asOf = row.date;
    if (row.updated_at && (!updatedAt || row.updated_at > updatedAt)) updatedAt = row.updated_at;
  }
  let nstCovered = 0;
  const raw = input.teams.map(team => {
    const games = byTeam.get(team) ?? [];
    const nst = games.flatMap(game => { const row = nstByKey.get(`${team}:${game.date}`); return row ? [row] : []; });
    nstCovered += nst.length;
    const nstOf = (key: "sf" | "sa" | "xgf" | "xga" | "scf" | "sca") => games.map(game => nstByKey.get(`${team}:${game.date}`)?.[key] ?? null);
    const differential = games.map(game => known(game.goals_for) && known(game.goals_against) ? game.goals_for - game.goals_against : null);
    const saved = games.map(game => known(game.times_shorthanded) && known(game.pp_goals_against) ? game.times_shorthanded - game.pp_goals_against : null);
    const values: Record<TeamLensMetric, { value: number | null; sample: number }> = {
      shotsFor: pooled(nstOf("sf"), null), shotsAgainst: pooled(nstOf("sa"), null), xgf: pooled(nstOf("xgf"), null), xga: pooled(nstOf("xga"), null), chancesFor: pooled(nstOf("scf"), null), chancesAgainst: pooled(nstOf("sca"), null),
      powerPlayPct: pooled(games.map(game => game.power_play_goals_for), games.map(game => game.pp_opportunities), 100),
      penaltyKillPct: pooled(saved, games.map(game => game.times_shorthanded), 100),
      timesShorthanded: pooled(games.map(game => game.times_shorthanded), null),
      goalsFor: pooled(games.map(game => game.goals_for), null), goalsAgainst: pooled(games.map(game => game.goals_against), null), goalDifferential: pooled(differential, null),
    };
    // A count's denominator is games, and each game is one; `pooled` with null denominators divides by the known games.
    return { team, games: games.length, values };
  });
  const ranks = new Map<TeamLensMetric, Map<string, number>>(), lowFirstRanks: InventoryLowFirstRanks = {};
  for (const id of TEAM_LENS_METRICS) {
    const complete = raw.length > 0 && raw.every(row => row.values[id].value !== null && row.games > 0 && row.values[id].sample === row.games);
    if (!complete) continue;
    ranks.set(id, new Map(competitionRanks(raw, row => row.values[id].value, row => row.team).map(({ row, rank }) => [row.team, rank])));
    if (HIGH_IS_WEAK.has(id)) lowFirstRanks[id] = Object.fromEntries(competitionRanks(raw, row => row.values[id].value, row => row.team, "low").map(({ row, rank }) => [row.team, rank]));
  }
  const lenses = new Map(raw.map(row => [row.team, Object.fromEntries(TEAM_LENS_METRICS.map(id => {
    const rank = ranks.get(id)?.get(row.team) ?? null;
    return [id, metric(id, row.values[id].value, row.values[id].sample, rank, rank === null ? null : raw.length)];
  })) as TeamLens]));
  return { lenses, lowFirstRanks, nstCovered, updatedAt, asOf };
}
/** The frozen signal shape for one side of a game. Each lens stays its own object, and nothing here adds them. */
export function gameSignals(team: TeamLens, opponent: TeamLens): GoalieGameSignals {
  return {
    volume: { opponentShotsForPerGame: opponent.shotsFor, teamShotsAgainstPerGame: team.shotsAgainst },
    ratioExposure: { opponentXgfPerGame: opponent.xgf, teamXgaPerGame: team.xga, opponentScoringChancesPerGame: opponent.chancesFor, teamScoringChancesAgainstPerGame: team.chancesAgainst, opponentPowerPlayPct: opponent.powerPlayPct, teamPenaltyKillPct: team.penaltyKillPct, teamTimesShorthandedPerGame: team.timesShorthanded },
    winSupport: { teamGoalsForPerGame: team.goalsFor, opponentGoalsAgainstPerGame: opponent.goalsAgainst, teamGoalDifferentialPerGame: team.goalDifferential },
  };
}

/* Confirmation */
const NO_CONFIRMATION: GoalieConfirmation = { state: "none", source: null, observedAt: null, expiresAt: null, sourceUrl: null };
/**
 * Maps the starter-board resolver's output to v1 and applies no rule of its own. A team game gets at most one assertion,
 * for one goalie; every other goalie there is unknown. `likely`, `unconfirmed` and `ruled_out` have no v1 state, so they
 * are unknown. v1 has no conflicting state, so a conflict is `none` here and is listed in `conflicts`.
 */
export function mapBoardEvidence({ evidence, expiresAt }: InventoryConfirmationInput) {
  const confirmations = new Map<string, GoalieConfirmation>(), conflicts = new Set<string>();
  for (const assertion of evidence.assertions) {
    if (assertion.dimension !== "goalie" || (assertion.value !== "confirmed" && assertion.value !== "projected")) continue;
    confirmations.set(`${assertion.gameId}:${assertion.teamId}:${assertion.playerId}`, { state: assertion.value, source: assertion.sourceKey, observedAt: assertion.publishedAt, expiresAt: expiresAt.get(assertion.evidenceId) ?? null, sourceUrl: assertion.sourceUrl });
  }
  for (const conflict of evidence.conflicts) if (conflict.dimension === "goalie") conflicts.add(`${conflict.gameId}:${conflict.teamId}`);
  return { confirmations, conflicts };
}
/** Conflicting start reports, by game and team. Not in `goalie-inventory-v1`; posts read it from the detail. */
export type InventoryConflict = { gameId: number; team: string };

/* Forecast */
/** Only a Start Chart `startParticipation` qualifies. Everything else, including a bare probability, is unavailable. */
export function admitStartParticipation(input: InventoryForecastInput | undefined, generatedAt: string): GoalieForecast {
  const participation = input?.startParticipation;
  if (!input || !participation) return { state: "unavailable", reason: input?.startProbability != null ? "A raw start probability is not an admitted forecast." : "No admitted Start Chart start participation for this game." };
  const refuse = (reason: string): GoalieForecast => ({ state: "unavailable", reason });
  if (participation.basis !== "start") return refuse("The participation is not on a start basis.");
  if (participation.model?.event !== "official_starter") return refuse("The participation does not model an official starter.");
  const { probability, cutoffAt, issuedAt, expiresAt, revisionId } = participation;
  if (!revisionId || !known(probability) || probability < 0 || probability > 1) return refuse("The participation has no valid probability or revision.");
  if (probability !== input.startProbability) return refuse("The participation probability does not match the row's start probability.");
  const [cutoff, issued, expires, now] = [cutoffAt, issuedAt, expiresAt, generatedAt].map(value => Date.parse(value));
  if (![cutoff, issued, expires].every(Number.isFinite) || cutoff > issued || issued >= expires || issued > now) return refuse("The participation's cutoff, issue and expiry times are not valid.");
  if (expires <= now) return refuse("The participation has expired.");
  return { state: "qualified", startProbability: probability, revisionId, modelLabel: participation.model.version, issuedAt, expiresAt };
}

/* Inventory */
export type GoalieInventoryInput = {
  request: GoalieInventoryRequest; teams: readonly string[];
  /** Season schedule through `request.through`. Dates before `scheduleFrom` were not read, so back-to-backs there are unknown. */
  schedule: readonly InventoryScheduleRow[]; scheduleFrom: string;
  teamGames: readonly InventoryTeamGameRow[]; nst: readonly InventoryNstRow[]; appearances: readonly GoalieAppearance[];
  /** Null means the source could not be read; `observationReason` then says why. Empty evidence is a real read with none. */
  confirmations: InventoryConfirmationInput | null; observationReason?: string;
  /** Null means no Start Chart input was available. */
  forecasts: readonly InventoryForecastInput[] | null;
};
export function buildGoalieInventory(input: GoalieInventoryInput): GoalieInventoryDetail {
  const { request } = input, cutoff = shiftDays(editionDate(request.generatedAt), -1), reasons: string[] = [];
  const ledger: CompletedTeamGame[] = toCompletedTeamGames(input.teamGames, { season: request.season, through: cutoff });
  const expected = input.schedule.filter(game => game.date <= cutoff).length * 2, observed = ledger.length;
  const coverage: InventoryCoverage = { observed, expected, missing: Math.max(0, expected - observed) };
  if (observed !== expected) reasons.push(`${coverage.missing} of ${expected} scheduled team games through ${cutoff} have no reported result.`);
  const { lenses, lowFirstRanks, nstCovered, updatedAt: nstUpdatedAt, asOf: nstAsOf } = buildTeamLenses({ teamGames: input.teamGames, nst: input.nst, teams: input.teams, season: request.season, cutoff });
  const nstComplete = nstCovered === observed;
  if (!nstComplete) reasons.push(`NST team logs cover ${nstCovered} of ${observed} completed team games, so shot, xG and chance ranks are withheld.`);

  const scheduled = input.schedule.filter(game => game.date >= request.from && game.date <= request.through);
  let unknownTeams = 0;
  const played = new Set(input.schedule.flatMap(game => [`${game.homeTeamId}:${game.date}`, `${game.awayTeamId}:${game.date}`]));
  const secondNight = (teamId: number, date: string) => shiftDays(date, -1) < input.scheduleFrom ? null : played.has(`${teamId}:${shiftDays(date, -1)}`);
  const sides = new Map<string, Omit<GoalieInventoryGame, "confirmation" | "forecast">[]>();
  for (const game of scheduled) {
    const home = teamById.get(game.homeTeamId), away = teamById.get(game.awayTeamId);
    const homeLens = home ? lenses.get(home) : undefined, awayLens = away ? lenses.get(away) : undefined;
    if (!home || !away || !homeLens || !awayLens) { unknownTeams++; continue; }
    for (const [team, opponent, isHome, lens, other, teamId, opponentId] of [[home, away, true, homeLens, awayLens, game.homeTeamId, game.awayTeamId], [away, home, false, awayLens, homeLens, game.awayTeamId, game.homeTeamId]] as const) {
      sides.set(team, [...(sides.get(team) ?? []), { gameId: game.id, date: game.date, startTimeUtc: game.startTime, team, opponent, home: isHome, teamSecondNight: secondNight(teamId, game.date), opponentSecondNight: secondNight(opponentId, game.date), signals: gameSignals(lens, other) }]);
    }
  }
  if (unknownTeams) reasons.push(`${unknownTeams} scheduled games name a team this inventory cannot place.`);

  const { confirmations, conflicts } = input.confirmations ? mapBoardEvidence(input.confirmations) : { confirmations: new Map<string, GoalieConfirmation>(), conflicts: new Set<string>() };
  const forecasts = new Map((input.forecasts ?? []).map(row => [`${row.gameId}:${row.goalieId}`, row]));
  const latestTeam = new Map(input.appearances.map(row => [row.goalieId, row.team]));
  const goalies: GoalieInventoryEntry[] = [];
  let incompleteShares = 0;
  for (const team of [...sides.keys()].sort()) {
    const games = sides.get(team)!.sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
    const share = teamStartShare(team, ledger, input.appearances, 10);
    if (!share.complete) incompleteShares++;
    // A traded goalie is listed with the team of their latest game only.
    const roster = share.goalies.filter(goalie => latestTeam.get(goalie.goalieId) === team);
    if (!roster.length) reasons.push(`${team} has no goalie appearance in its last 10 games.`);
    for (const goalie of roster) goalies.push({
      goalieId: goalie.goalieId, name: goalie.name ?? `Goalie ${goalie.goalieId}`, team,
      recentStarts: { window: "L10", teamGames: share.teamGames, starts: share.complete ? goalie.starts : null, reliefAppearances: goalie.reliefAppearances, share: share.complete ? goalie.share : null, complete: share.complete },
      games: games.map(game => ({ ...game, confirmation: confirmations.get(`${game.gameId}:${teamsInfo[team].id}:${goalie.goalieId}`) ?? NO_CONFIRMATION, forecast: admitStartParticipation(forecasts.get(`${game.gameId}:${goalie.goalieId}`), request.generatedAt) })),
    });
  }
  if (incompleteShares) reasons.push(`${incompleteShares} teams have an L10 game without exactly one labeled starter, so their start shares are unknown.`);
  const noRoster = reasons.some(reason => reason.endsWith("in its last 10 games."));
  const degraded = observed !== expected || !nstComplete || unknownTeams > 0 || incompleteShares > 0 || noRoster;

  const newest = (values: readonly (string | null)[]) => values.reduce<string | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
  const listed = new Set(goalies.map(goalie => `${teamsInfo[goalie.team].id}:${goalie.goalieId}`));
  const unlisted = [...confirmations.keys()].filter(key => { const [gameId, teamId, goalieId] = key.split(":"); return scheduled.some(game => String(game.id) === gameId) && !listed.has(`${teamId}:${goalieId}`); }).length;
  const conflictList = [...conflicts].flatMap(key => { const [gameId, teamId] = key.split(":").map(Number), team = teamById.get(teamId); return team && scheduled.some(game => game.id === gameId) ? [{ gameId, team }] : []; });
  const confirmationReasons = input.confirmations ? [
    CONFIRMATION_ABSENT_NOTE, ...(input.confirmations.gaps ?? []),
    ...(conflictList.length ? [`${conflictList.length} team ${conflictList.length === 1 ? "game has" : "games have"} conflicting start reports, shown as unknown here.`] : []),
    ...(unlisted ? [unlisted === 1 ? "1 observed goalie has no appearance in their team's last 10 games, so this inventory does not list them." : `${unlisted} observed goalies have no appearance in their team's last 10 games, so this inventory does not list them.`] : []),
  ] : [input.observationReason ?? CONFIRMATION_CLOSED_REASON];
  const forecastReasons = input.forecasts ? [] : [FORECAST_CLOSED_REASON];
  // A New York date like every other source; the exact time of the newest report goes in `updatedAt`.
  const newestObservation = (input.confirmations?.evidence.assertions ?? []).map(row => row.publishedAt).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
  const sources: GoalieInventorySource[] = [
    { name: "NHL schedule", tables: ["games"], state: "ready", asOf: newest(scheduled.map(game => game.date)), updatedAt: null, reasons: [] },
    { name: "NHL.com team game stats", tables: ["wgo_team_stats"], state: observed === expected ? "ready" : "partial", asOf: newest(ledger.map(game => game.date)), updatedAt: null, reasons: [] },
    { name: "NST team game logs (all situations)", tables: ["nst_team_gamelogs_as_counts"], state: nstComplete ? "ready" : "partial", asOf: nstAsOf, updatedAt: nstUpdatedAt ? asUtc(nstUpdatedAt) : null, reasons: [] },
    { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: incompleteShares ? "partial" : "ready", asOf: newest(input.appearances.map(row => row.date)), updatedAt: null, reasons: [] },
    { name: "Goalie start observations", tables: ["player_forecast_goalie_start_observations"], state: input.confirmations ? "ready" : "blocked", asOf: newestObservation ? editionDate(newestObservation) : null, updatedAt: newestObservation, reasons: confirmationReasons },
    { name: "Start Chart start participation", tables: [], state: input.forecasts ? "ready" : "blocked", asOf: null, updatedAt: null, reasons: forecastReasons },
  ];
  return {
    coverage, conflicts: conflictList, lowFirstRanks,
    inventory: { version: GOALIE_INVENTORY_VERSION, season: request.season, generatedAt: request.generatedAt, from: request.from, through: request.through, state: degraded ? "partial" : "ready", reasons: [...reasons, ...confirmationReasons, ...forecastReasons], sources, goalies },
  };
}
/** NST `updated_at` has no zone and is written in UTC. */
const asUtc = (value: string) => /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value) ? value : `${value.replace(" ", "T")}Z`;

/* Search */
const FOLDED: Record<string, string> = { ø: "o", ł: "l", đ: "d", æ: "ae", œ: "oe", ß: "ss", ı: "i" };
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[øłđæœßı]/g, letter => FOLDED[letter]).trim();
export const searchGoalieInventory: SearchGoalieInventory = (inventory, query) => {
  const wanted = fold(query);
  if (!wanted) return inventory.goalies;
  return inventory.goalies.filter(goalie => [goalie.name, goalie.team, teamsInfo[goalie.team]?.name ?? ""].some(text => fold(text).includes(wanted)));
};

/* Display labels, one wording for every card. */
export const confirmationLabel = (confirmation: GoalieConfirmation, conflicting = false) => conflicting ? "Conflicting reports" : confirmation.state === "confirmed" ? "Source: confirmed" : confirmation.state === "projected" ? "Source: projected" : "Unknown";
/** The pipeline's internal key, in reader-facing words. v1 keeps the raw key. */
export const confirmationSourceLabel = (source: string | null) => source === "validated_events" ? "Validated" : source;
/** How old the claim is at the edition. Absent for an unknown, which has no claim to age. */
export function confirmationFreshness(confirmation: GoalieConfirmation, generatedAt: string) {
  if (confirmation.state === "none") return null;
  return ageLabel(confirmation.observedAt, generatedAt);
}
export function ageLabel(at: string, generatedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(at)) / 60000));
  return minutes < 60 ? `${minutes}m ago` : minutes < 2880 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
export const forecastLabel = (forecast: GoalieForecast) => forecast.state === "qualified" ? `Conditional forecast ${Math.round(forecast.startProbability * 100)}%` : "Forecast unavailable";
export const metricLabel = (value: InventoryMetric, digits: number) => value.value === null ? "—" : `${value.value.toFixed(digits)}${value.unit.startsWith("%") ? "%" : ""}${value.leagueRank === null ? "" : ` (#${value.leagueRank})`}`;
/** The Risky Starts flag's cut. Null without a value or a complete league's rank, so a missing metric can never read as low. */
export function rankBand({ value, leagueRank, leagueCohort }: InventoryMetric): "top" | "middle" | "bottom" | null {
  if (value === null || leagueRank === null || leagueCohort === null) return null;
  const third = Math.ceil(leagueCohort / 3);
  return leagueRank <= third ? "top" : leagueRank > leagueCohort - third ? "bottom" : "middle";
}
export type RankedSide = { metricId: TeamLensMetric; metric: InventoryMetric; lowFirstRank: number | null };
export const rankedSide = (ranks: InventoryLowFirstRanks, team: string, metricId: TeamLensMetric, metric: InventoryMetric): RankedSide => ({ metricId, metric, lowFirstRank: ranks[metricId]?.[team] ?? null });
/** A side's rank as strength, where 1 is the league's strongest and tied teams share a rank. Null follows `rankBand`, or a `HIGH_IS_WEAK` metric with no low-first rank. */
export const strengthRank = ({ metricId, metric, lowFirstRank }: RankedSide) => rankBand(metric) === null ? null : HIGH_IS_WEAK.has(metricId) ? lowFirstRank : metric.leagueRank!;
/** Strength as a share of the league: the strongest fills a bar, and each rank down is one step less. */
export function strengthShare(side: RankedSide) {
  const rank = strengthRank(side);
  return rank === null ? null : (side.metric.leagueCohort! - rank + 1) / side.metric.leagueCohort!;
}
/** The stronger of two sides by league rank, the one winner rule for both posts. Equal strength or a missing side has no winner. */
export function headToHeadWinner(first: RankedSide, second: RankedSide): 0 | 1 | null {
  const a = strengthRank(first), b = strengthRank(second);
  return a === null || b === null || a === b ? null : a < b ? 0 : 1;
}
/** Winner and loser chip colours, and the triangle's. Inline or as attributes so the PNG keeps them. */
export const HEAD_TO_HEAD_COLORS = { winner: "#12805c", loser: "#b3364f", ink: "#ffffff" } as const;
/** Source status colours. An unknown has none: no report is not a bad report. */
export const CONFIRMATION_TONES = { confirmed: { fill: "#0e5c46", ink: "#ffffff", border: null }, projected: { fill: "#6b5213", ink: "#ffffff", border: null }, conflicting: { fill: "#7a1f52", ink: "#ffffff", border: "1px dashed #ff6384" } } as const;
/** A game with no start time stays listed; one already under way is no longer a start decision. */
export const isUpcomingGame = (game: Pick<GoalieInventoryGame, "startTimeUtc">, generatedAt: string) => game.startTimeUtc === null || Date.parse(game.startTimeUtc) > Date.parse(generatedAt);
/** An edition's lifetime when a listed game starts inside the default one, so it expires by that puck drop. A game with no start time sets nothing. */
export function puckDropTtlSeconds(startTimes: readonly (string | null)[], generatedAt: string) {
  const seconds = Math.floor((Math.min(...startTimes.flatMap(at => at === null ? [] : [Date.parse(at)])) - Date.parse(generatedAt)) / 1000);
  return seconds < SHARE_POST_DEFAULT_TTL_SECONDS ? Math.max(0, seconds) : undefined;
}
/** The few words a card keeps; the full notes print with the evidence beside the preview. */
export function confirmationLegend(inventory: GoalieInventory) {
  const source = inventory.sources.find(item => item.tables.includes("player_forecast_goalie_start_observations"));
  if (!source || source.state === "blocked") return "Unknown = reports unreadable.";
  return source.reasons.includes(CONFIRMATION_REPORTER_GAP) ? "Unknown = no report yet. Reports aren't split by reporter." : "Unknown = no report yet.";
}
export const confirmationNote = (inventory: GoalieInventory) => inventory.sources.find(source => source.tables.includes("player_forecast_goalie_start_observations"))?.reasons.join(" ") ?? CONFIRMATION_ABSENT_NOTE;

/** The shell's evidence block for a post built on the inventory. A blocked source was not read, so it is not listed as one. */
export function inventoryEvidence({ inventory, coverage }: Pick<GoalieInventoryDetail, "inventory" | "coverage">, cohort: string, teamGames: number, notes: readonly string[] = []): SharePostEvidence {
  return {
    sources: inventory.sources.filter(source => source.state === "ready" || source.state === "partial").map(({ name, tables, state, asOf, updatedAt, reasons }) => ({ name, tables, state, asOf, updatedAt, reasons })),
    sample: `${inventory.from} to ${inventory.through}: ${teamGames} upcoming team games; rates are season to date through ${shiftDays(editionDate(inventory.generatedAt), -1)}. ${[confirmationNote(inventory), ...notes].join(" ")}`,
    strength: "All situations (shots, xG, chances); PP and PK as labeled", cohort,
    coverage: coverage ? { observed: coverage.observed, expected: coverage.expected, missing: coverage.missing, unit: "completed team games" } : null,
  };
}

/* Live reads. Row ceilings fail closed; a season has 1,312 to 1,344 games and two team rows per game. */
const LIMITS = { schedule: 1400, teamGames: 2800, nst: 2800, appearances: 1200, observations: 2000, conflicts: 500 } as const;
const MAX_RANGE_DAYS = 31;
export type GoalieInventoryOptions = {
  /** A client allowed to read the observation tables, server only (`serverObservationClient`). Without one, every goalie is unknown. */
  observationClient?: SharePostReadClient;
  readStartParticipations?: (request: GoalieInventoryRequest, gameIds: readonly number[]) => Promise<readonly InventoryForecastInput[]>;
};
type BoundedRead = <T>(what: string, limit: number, page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>) => Promise<T[]>;
/**
 * The service credential stays on the server: this guarded import is dropped from browser bundles, and the anon client
 * is never used for these tables. Only the post route's server-side loader calls it.
 */
export async function serverObservationClient(): Promise<SharePostReadClient | undefined> {
  return typeof window === "undefined" ? (await import("lib/supabase/server")).default as unknown as SharePostReadClient : undefined;
}
/** The starter board's goalie evidence, read narrowly, through the board's own resolver. A failed conflict read fails it all. */
async function readBoardConfirmations(client: SharePostReadClient, gameIds: readonly number[], cutoff: string, bounded: BoundedRead): Promise<InventoryConfirmationInput> {
  if (!gameIds.length) return { evidence: { assertions: [], conflicts: [] }, expiresAt: new Map() };
  const resolver = typeof window === "undefined" ? await import("lib/projections/dailyBoardEvidence") : null;
  if (!resolver) throw new Error("Goalie confirmation is server only.");
  const goalies = await bounded<BoardGoalieEvidence>("Goalie start observations", LIMITS.observations, (from, to) => client.from("player_forecast_goalie_start_observations").select(INVENTORY_OBSERVATION_COLUMNS.join(","), { count: "exact" }).in("game_id", [...gameIds]).eq("accepted", true).lte("available_at", cutoff).lte("created_at", cutoff).order("id", { ascending: true }).range(from, to));
  type ConflictRow = Omit<BoardConflict, "player_forecast_conflict_resolutions">;
  type ResolutionRow = BoardConflict["player_forecast_conflict_resolutions"][number] & { conflict_id: string };
  const conflictRows = await bounded<ConflictRow>("Goalie start conflicts", LIMITS.conflicts, (from, to) => client.from("player_forecast_observation_conflicts").select("id,conflict_key,conflict_version,game_id,team_id,player_id,conflict_type,detected_at,created_at", { count: "exact" }).in("game_id", [...gameIds]).eq("conflict_type", "goalie_start").lte("detected_at", cutoff).order("id", { ascending: true }).range(from, to));
  const resolutions = conflictRows.length ? await bounded<ResolutionRow>("Goalie conflict resolutions", LIMITS.conflicts, (from, to) => client.from("player_forecast_conflict_resolutions").select("id,conflict_id,action,selected_observation_id,resolved_at,created_at", { count: "exact" }).in("conflict_id", conflictRows.map(row => row.id)).lte("resolved_at", cutoff).order("id", { ascending: true }).range(from, to)) : [];
  const evidence = resolver.resolveDailyBoardEvidence({ cutoff, lineups: [], goalies, conflicts: conflictRows.map(row => ({ ...row, player_forecast_conflict_resolutions: resolutions.filter(item => item.conflict_id === row.id) })) });
  return { evidence, expiresAt: new Map(goalies.map(row => [row.id, row.expires_at ?? null])), gaps: observationGaps(goalies) };
}
export async function loadGoalieInventoryDetail(client: { from: (table: string) => any }, request: GoalieInventoryRequest, options: GoalieInventoryOptions = {}): Promise<GoalieInventoryDetail> {
  try {
    if ((Date.parse(request.through) - Date.parse(request.from)) / DAY_MS >= MAX_RANGE_DAYS) throw new Error("Inventory range is too long.");
    const [{ bounded }, { readGoalieAppearances }, { activeTeamAbbreviations }] = await Promise.all([import("lib/socialShare/trendSources"), import("./goalieLedger.sources"), import("lib/teamsInfo")]);
    const cutoff = shiftDays(editionDate(request.generatedAt), -1), seasonStart = `${String(request.season).slice(0, 4)}-08-01`;
    const schedule = await bounded<InventoryScheduleRow>("Schedule", LIMITS.schedule, (from, to) => client.from("games").select("id,date,startTime,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", request.season).eq("type", 2).lte("date", request.through).order("date", { ascending: true }).order("id", { ascending: true }).range(from, to));
    const teamGames = await bounded<InventoryTeamGameRow>("Team game stats", LIMITS.teamGames, (from, to) => client.from("wgo_team_stats").select([...TEAM_GAME_COLUMNS, ...INVENTORY_LENS_COLUMNS].join(","), { count: "exact" }).eq("season_id", request.season).lte("date", cutoff).order("date", { ascending: true }).order("game_id", { ascending: true }).order("team_id", { ascending: true }).range(from, to));
    const nst = await bounded<InventoryNstRow>("NST team logs", LIMITS.nst, (from, to) => client.from("nst_team_gamelogs_as_counts").select(INVENTORY_NST_COLUMNS.join(","), { count: "exact" }).eq("season_id", request.season).eq("situation", "all").lte("date", cutoff).order("date", { ascending: true }).order("team_abbreviation", { ascending: true }).range(from, to));
    const ledger = toCompletedTeamGames(teamGames, { season: request.season, through: cutoff });
    const teams = [...activeTeamAbbreviations].map(String).sort();
    const windowStart = teams.reduce((earliest, team) => { const games = ledger.filter(game => game.team === team), first = games[Math.max(0, games.length - 10)]?.date; return first && first < earliest ? first : earliest; }, cutoff);
    const appearances = await readGoalieAppearances(client, { season: request.season, from: windowStart, through: cutoff, limit: LIMITS.appearances });
    const gameIds = schedule.filter(game => game.date >= request.from).map(game => game.id);
    let confirmations: InventoryConfirmationInput | null = null, observationReason: string | undefined;
    if (options.observationClient) {
      try { confirmations = await readBoardConfirmations(options.observationClient, gameIds, request.generatedAt, bounded); }
      catch { observationReason = CONFIRMATION_CLOSED_REASON; }
    }
    let forecasts: readonly InventoryForecastInput[] | null = null;
    if (options.readStartParticipations) { try { forecasts = await options.readStartParticipations(request, gameIds); } catch { forecasts = null; } }
    return buildGoalieInventory({ request, teams, schedule, scheduleFrom: seasonStart, teamGames, nst, appearances, confirmations, observationReason, forecasts });
  } catch {
    const reason = "The goalie inventory's sources could not be read.";
    return { coverage: null, conflicts: [], lowFirstRanks: {}, inventory: { version: GOALIE_INVENTORY_VERSION, season: request.season, generatedAt: request.generatedAt, from: request.from, through: request.through, state: "missing", reasons: [reason], sources: [], goalies: [] } };
  }
}
export const loadGoalieInventory: LoadGoalieInventory = async (client, request) => (await loadGoalieInventoryDetail(client as SharePostReadClient, request, { observationClient: await serverObservationClient() })).inventory;
