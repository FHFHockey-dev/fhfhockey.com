import type { StartChartParticipation } from "lib/projections/startChartContract";
import { currentSeason } from "lib/socialShare/schedule";
import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import type { SharePostEvidence, SharePostReadClient } from "../contract";
import { competitionRanks, editionDate } from "./definitions";
import { GOALIE_INVENTORY_VERSION, type GoalieConfirmation, type GoalieForecast, type GoalieGameSignals, type GoalieInventory, type GoalieInventoryEntry, type GoalieInventoryGame, type GoalieInventoryRequest, type GoalieInventorySource, type InventoryMetric, type LoadGoalieInventory, type SearchGoalieInventory } from "./goalieInventory";
import { TEAM_GAME_COLUMNS, teamStartShare, toCompletedTeamGames, type CompletedTeamGame, type GoalieAppearance, type TeamGameRow } from "./goalieLedger";

/**
 * Adapter for `goalie-inventory-v1` (CONTRACT.md §5). The mapping is pure and every Supabase-backed reader is imported
 * lazily inside the loader, so a card can use `searchGoalieInventory` and consumers can import this file with no client.
 */
export const INVENTORY_LENS_COLUMNS = ["goals_for", "goals_against", "pp_opportunities", "power_play_goals_for", "times_shorthanded", "pp_goals_against"] as const satisfies readonly (keyof Database["public"]["Tables"]["wgo_team_stats"]["Row"])[];
export const INVENTORY_NST_COLUMNS = ["team_abbreviation", "date", "season_id", "situation", "sf", "sa", "xgf", "xga", "scf", "sca", "updated_at"] as const satisfies readonly (keyof Database["public"]["Tables"]["nst_team_gamelogs_as_counts"]["Row"])[];
export const INVENTORY_OBSERVATION_COLUMNS = ["id", "game_id", "team_id", "player_id", "observation_status", "source_group", "source_url", "observed_at", "available_at", "expires_at", "supersedes_id", "accepted"] as const satisfies readonly (keyof Database["public"]["Tables"]["player_forecast_goalie_start_observations"]["Row"])[];
export type InventoryTeamGameRow = TeamGameRow & Pick<Database["public"]["Tables"]["wgo_team_stats"]["Row"], typeof INVENTORY_LENS_COLUMNS[number]>;
export type InventoryNstRow = Pick<Database["public"]["Tables"]["nst_team_gamelogs_as_counts"]["Row"], typeof INVENTORY_NST_COLUMNS[number]>;
export type InventoryObservationRow = Pick<Database["public"]["Tables"]["player_forecast_goalie_start_observations"]["Row"], typeof INVENTORY_OBSERVATION_COLUMNS[number]>;
export type InventoryScheduleRow = { id: number; date: string; startTime: string | null; homeTeamId: number; awayTeamId: number };
/** One goalie-game from Start Chart. `startProbability` is that row's own head, which a participation must equal. */
export type InventoryForecastInput = { gameId: number; goalieId: number; startProbability: number | null; startParticipation?: StartChartParticipation | null };
export type InventoryCoverage = { observed: number; expected: number; missing: number };
export type GoalieInventoryDetail = { inventory: GoalieInventory; coverage: InventoryCoverage | null };

export const CONFIRMATION_CLOSED_REASON = "Goalie confirmation is not readable by this route yet: player_forecast_goalie_start_observations has no read access here. Every goalie shows no observation, which does not mean not starting.";
export const CONFIRMATION_ABSENT_NOTE = "Observations cover part of the slate; an absent observation means none was recorded, not that the goalie is not starting.";
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
export function buildTeamLenses(input: { teamGames: readonly InventoryTeamGameRow[]; nst: readonly InventoryNstRow[]; teams: readonly string[]; season: number; cutoff: string }): { lenses: Map<string, TeamLens>; nstCovered: number; updatedAt: string | null; asOf: string | null } {
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
  const ranks = new Map<TeamLensMetric, Map<string, number>>();
  for (const id of TEAM_LENS_METRICS) {
    const complete = raw.length > 0 && raw.every(row => row.values[id].value !== null && row.games > 0 && row.values[id].sample === row.games);
    if (complete) ranks.set(id, new Map(competitionRanks(raw, row => row.values[id].value, row => row.team).map(({ row, rank }) => [row.team, rank])));
  }
  const lenses = new Map(raw.map(row => [row.team, Object.fromEntries(TEAM_LENS_METRICS.map(id => {
    const rank = ranks.get(id)?.get(row.team) ?? null;
    return [id, metric(id, row.values[id].value, row.values[id].sample, rank, rank === null ? null : raw.length)];
  })) as TeamLens]));
  return { lenses, nstCovered, updatedAt, asOf };
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
const claimTime = (row: InventoryObservationRow) => Date.parse(row.observed_at);
/**
 * Newest usable claim per goalie and team game. Rejected, future, expired and superseded rows are dropped; a newest
 * claim other than confirmed or projected shows none; a newer confirmation of another goalie displaces older claims,
 * and two goalies confirmed at the same moment are a conflict that confirms neither. Absent stays `none`.
 */
export function resolveConfirmations(rows: readonly InventoryObservationRow[], generatedAt: string): Map<string, GoalieConfirmation> {
  const now = Date.parse(generatedAt), superseded = new Set(rows.flatMap(row => row.accepted && row.supersedes_id ? [row.supersedes_id] : []));
  const games = new Map<string, Map<number, InventoryObservationRow>>();
  for (const row of rows) {
    if (!row.accepted || row.player_id == null || superseded.has(row.id) || Date.parse(row.available_at) > now || (row.expires_at && Date.parse(row.expires_at) <= now)) continue;
    const key = `${row.game_id}:${row.team_id}`, goalies = games.get(key) ?? new Map<number, InventoryObservationRow>();
    const held = goalies.get(row.player_id);
    if (!held || claimTime(row) > claimTime(held) || (claimTime(row) === claimTime(held) && row.available_at > held.available_at)) goalies.set(row.player_id, row);
    games.set(key, goalies);
  }
  const confirmations = new Map<string, GoalieConfirmation>();
  for (const goalies of games.values()) {
    const confirmed = [...goalies.values()].filter(row => row.observation_status === "confirmed");
    const newest = confirmed.length ? Math.max(...confirmed.map(claimTime)) : null;
    const conflict = confirmed.filter(row => claimTime(row) === newest).length > 1;
    for (const [goalieId, row] of goalies) {
      if (row.observation_status !== "confirmed" && row.observation_status !== "projected") continue;
      if (conflict || (newest !== null && claimTime(row) < newest)) continue;
      confirmations.set(`${row.game_id}:${goalieId}`, { state: row.observation_status, source: row.source_group, observedAt: row.observed_at, expiresAt: row.expires_at, sourceUrl: row.source_url });
    }
  }
  return confirmations;
}

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
  /** Null means the source could not be read; `observationReason` then says why. An empty array is a real read with none. */
  observations: readonly InventoryObservationRow[] | null; observationReason?: string;
  /** Null means no Start Chart input was available. */
  forecasts: readonly InventoryForecastInput[] | null;
};
export function buildGoalieInventory(input: GoalieInventoryInput): GoalieInventoryDetail {
  const { request } = input, cutoff = shiftDays(editionDate(request.generatedAt), -1), reasons: string[] = [];
  const ledger: CompletedTeamGame[] = toCompletedTeamGames(input.teamGames, { season: request.season, through: cutoff });
  const expected = input.schedule.filter(game => game.date <= cutoff).length * 2, observed = ledger.length;
  const coverage: InventoryCoverage = { observed, expected, missing: Math.max(0, expected - observed) };
  if (observed !== expected) reasons.push(`${coverage.missing} of ${expected} scheduled team games through ${cutoff} have no reported result.`);
  const { lenses, nstCovered, updatedAt: nstUpdatedAt, asOf: nstAsOf } = buildTeamLenses({ teamGames: input.teamGames, nst: input.nst, teams: input.teams, season: request.season, cutoff });
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

  const confirmations = input.observations ? resolveConfirmations(input.observations, request.generatedAt) : new Map<string, GoalieConfirmation>();
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
      games: games.map(game => ({ ...game, confirmation: confirmations.get(`${game.gameId}:${goalie.goalieId}`) ?? NO_CONFIRMATION, forecast: admitStartParticipation(forecasts.get(`${game.gameId}:${goalie.goalieId}`), request.generatedAt) })),
    });
  }
  if (incompleteShares) reasons.push(`${incompleteShares} teams have an L10 game without exactly one labeled starter, so their start shares are unknown.`);
  const noRoster = reasons.some(reason => reason.endsWith("in its last 10 games."));
  const degraded = observed !== expected || !nstComplete || unknownTeams > 0 || incompleteShares > 0 || noRoster;

  const newest = (values: readonly (string | null)[]) => values.reduce<string | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
  const confirmationReasons = input.observations ? [CONFIRMATION_ABSENT_NOTE] : [input.observationReason ?? CONFIRMATION_CLOSED_REASON];
  const forecastReasons = input.forecasts ? [] : [FORECAST_CLOSED_REASON];
  const sources: GoalieInventorySource[] = [
    { name: "NHL schedule", tables: ["games"], state: "ready", asOf: newest(scheduled.map(game => game.date)), updatedAt: null, reasons: [] },
    { name: "NHL.com team game stats", tables: ["wgo_team_stats"], state: observed === expected ? "ready" : "partial", asOf: newest(ledger.map(game => game.date)), updatedAt: null, reasons: [] },
    { name: "NST team game logs (all situations)", tables: ["nst_team_gamelogs_as_counts"], state: nstComplete ? "ready" : "partial", asOf: nstAsOf, updatedAt: nstUpdatedAt ? asUtc(nstUpdatedAt) : null, reasons: [] },
    { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: incompleteShares ? "partial" : "ready", asOf: newest(input.appearances.map(row => row.date)), updatedAt: null, reasons: [] },
    { name: "Goalie start observations", tables: ["player_forecast_goalie_start_observations"], state: input.observations ? "ready" : "blocked", asOf: newest((input.observations ?? []).map(row => row.observed_at)), updatedAt: null, reasons: confirmationReasons },
    { name: "Start Chart start participation", tables: [], state: input.forecasts ? "ready" : "blocked", asOf: null, updatedAt: null, reasons: forecastReasons },
  ];
  return {
    coverage,
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
export const confirmationLabel = (confirmation: GoalieConfirmation) => confirmation.state === "confirmed" ? "Source: confirmed" : confirmation.state === "projected" ? "Source: projected" : "No observation";
export const forecastLabel = (forecast: GoalieForecast) => forecast.state === "qualified" ? `Conditional forecast ${Math.round(forecast.startProbability * 100)}%` : "Forecast unavailable";
export const metricLabel = (value: InventoryMetric, digits: number) => value.value === null ? "—" : `${value.value.toFixed(digits)}${value.unit.startsWith("%") ? "%" : ""}${value.leagueRank === null ? "" : ` (#${value.leagueRank})`}`;
/** A game with no start time stays listed; one already under way is no longer a start decision. */
export const isUpcomingGame = (game: Pick<GoalieInventoryGame, "startTimeUtc">, generatedAt: string) => game.startTimeUtc === null || Date.parse(game.startTimeUtc) > Date.parse(generatedAt);
export const inventoryNote = (inventory: GoalieInventory, tables: string, fallback: string) => inventory.sources.find(source => source.tables.includes(tables))?.reasons[0] ?? fallback;

/** The shell's evidence block for a post built on the inventory. A blocked source was not read, so it is not listed as one. */
export function inventoryEvidence({ inventory, coverage }: GoalieInventoryDetail, cohort: string, teamGames: number): SharePostEvidence {
  return {
    sources: inventory.sources.filter(source => source.state === "ready" || source.state === "partial").map(({ name, tables, state, asOf, updatedAt, reasons }) => ({ name, tables, state, asOf, updatedAt, reasons })),
    sample: `${inventory.from} to ${inventory.through}: ${teamGames} upcoming team games; rates are season to date through ${shiftDays(editionDate(inventory.generatedAt), -1)}`,
    strength: "All situations (shots, xG, chances); PP and PK as labeled", cohort,
    coverage: coverage ? { observed: coverage.observed, expected: coverage.expected, missing: coverage.missing, unit: "completed team games" } : null,
  };
}

/* Live reads. Row ceilings fail closed; a season has 1,312 to 1,344 games and two team rows per game. */
const LIMITS = { schedule: 1400, teamGames: 2800, nst: 2800, appearances: 1200, observations: 2000 } as const;
const MAX_RANGE_DAYS = 31;
export type GoalieInventoryOptions = {
  /** A client allowed to read the observation table. Until TJ decides that access (SOURCES fact 3) the post routes pass none. */
  observationClient?: SharePostReadClient;
  readStartParticipations?: (request: GoalieInventoryRequest, gameIds: readonly number[]) => Promise<readonly InventoryForecastInput[]>;
};
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
    let observations: InventoryObservationRow[] | null = null, observationReason: string | undefined;
    const reader = options.observationClient;
    if (reader && gameIds.length) {
      try { observations = await bounded<InventoryObservationRow>("Goalie start observations", LIMITS.observations, (from, to) => reader.from("player_forecast_goalie_start_observations").select(INVENTORY_OBSERVATION_COLUMNS.join(","), { count: "exact" }).in("game_id", gameIds).order("observed_at", { ascending: true }).order("id", { ascending: true }).range(from, to)); }
      catch { observationReason = "Goalie start observations could not be read, so every goalie shows no observation."; }
    } else if (reader) observations = [];
    let forecasts: readonly InventoryForecastInput[] | null = null;
    if (options.readStartParticipations) { try { forecasts = await options.readStartParticipations(request, gameIds); } catch { forecasts = null; } }
    return buildGoalieInventory({ request, teams, schedule, scheduleFrom: seasonStart, teamGames, nst, appearances, observations, observationReason, forecasts });
  } catch {
    const reason = "The goalie inventory's sources could not be read.";
    return { coverage: null, inventory: { version: GOALIE_INVENTORY_VERSION, season: request.season, generatedAt: request.generatedAt, from: request.from, through: request.through, state: "missing", reasons: [reason], sources: [], goalies: [] } };
  }
}
export const loadGoalieInventory: LoadGoalieInventory = (client, request) => loadGoalieInventoryDetail(client as SharePostReadClient, request).then(detail => detail.inventory);
