import type { NextApiRequestQuery } from "next/dist/server/api-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import serverReadonlyClient from "lib/supabase/serverReadonly";
import {
  createDefaultTeamLandingFilterState,
  parseTeamStatsFilterStateFromQuery,
  resolveTeamStatsTableFamily,
  type TeamStatsLandingFilterState,
  type TeamStatsSortState,
  validateTeamStatsFilterState,
} from "./teamStatsFilters";
import type { PlayerStatsDisplayMode, PlayerStatsSeasonType } from "./playerStatsTypes";
import {
  createEmptyTeamStatsLandingResponse,
  type TeamStatsLandingApiError,
  type TeamStatsLandingApiResponse,
  type TeamStatsLandingApiRow,
} from "./teamStatsLandingApi";

type TeamStatsSupabaseClient = SupabaseClient<Database>;
const TEAM_STATS_SUMMARY_TABLE = "team_underlying_stats_summary";

type TeamSummaryTableRow = {
  game_id: number;
  season_id: number;
  game_type: number;
  game_date: string;
  team_id: number;
  opponent_team_id: number;
  venue: "home" | "away";
  is_home: boolean;
  strength: string;
  score_state: string;
  toi_seconds: number;
  wins: number;
  losses: number;
  otl: number;
  row_wins: number;
  points: number;
  cf: number;
  ca: number;
  ff: number;
  fa: number;
  sf: number;
  sa: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  scf: number;
  sca: number;
  scsf: number;
  scsa: number;
  scgf: number;
  scga: number;
  hdcf: number;
  hdca: number;
  hdsf: number;
  hdsa: number;
  hdgf: number;
  hdga: number;
  mdcf: number;
  mdca: number;
  mdsf: number;
  mdsa: number;
  mdgf: number;
  mdga: number;
  ldcf: number;
  ldca: number;
  ldsf: number;
  ldsa: number;
  ldgf: number;
  ldga: number;
};

type TeamRow = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "abbreviation">;

type TeamAggregationAccumulator = {
  rowKey: string;
  teamId: number;
  teamLabel: string;
  gameIds: Set<number>;
  toiSeconds: number;
  wins: number;
  losses: number;
  otl: number;
  rowWins: number;
  points: number;
  cf: number;
  ca: number;
  ff: number;
  fa: number;
  sf: number;
  sa: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  scf: number;
  sca: number;
  scsf: number;
  scsa: number;
  scgf: number;
  scga: number;
  hdcf: number;
  hdca: number;
  hdsf: number;
  hdsa: number;
  hdgf: number;
  hdga: number;
  mdcf: number;
  mdca: number;
  mdsf: number;
  mdsa: number;
  mdgf: number;
  mdga: number;
  ldcf: number;
  ldca: number;
  ldsf: number;
  ldsa: number;
  ldgf: number;
  ldga: number;
};

type OfficialSeasonSummaryRow = {
  teamId: number;
  gamesPlayed: number | null;
  wins: number | null;
  losses: number | null;
  otLosses: number | null;
  points: number | null;
  regulationAndOtWins: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  shotsForPerGame: number | null;
  shotsAgainstPerGame: number | null;
};

type OfficialFiveOnFiveRow = {
  teamId: number;
  gamesPlayed: number | null;
  shots5v5: number | null;
  satFor: number | null;
  satAgainst: number | null;
  usatFor: number | null;
  usatAgainst: number | null;
};

type OfficialShotTypeRow = {
  teamId: number;
  shotsOnNet: number | null;
};

type OfficialTeamMetricsSnapshot = {
  seasonSummaryByTeamId: Map<number, OfficialSeasonSummaryRow>;
  fiveOnFiveByTeamId: Map<number, OfficialFiveOnFiveRow>;
  shotTypeByTeamId: Map<number, OfficialShotTypeRow>;
};

const SUPABASE_PAGE_SIZE = 1000;
const TEAM_SUMMARY_SELECT = [
  "game_id",
  "season_id",
  "game_type",
  "game_date",
  "team_id",
  "opponent_team_id",
  "venue",
  "is_home",
  "strength",
  "score_state",
  "toi_seconds",
  "wins",
  "losses",
  "otl",
  "row_wins",
  "points",
  "cf",
  "ca",
  "ff",
  "fa",
  "sf",
  "sa",
  "gf",
  "ga",
  "xgf",
  "xga",
  "scf",
  "sca",
  "scsf",
  "scsa",
  "scgf",
  "scga",
  "hdcf",
  "hdca",
  "hdsf",
  "hdsa",
  "hdgf",
  "hdga",
  "mdcf",
  "mdca",
  "mdsf",
  "mdsa",
  "mdgf",
  "mdga",
  "ldcf",
  "ldca",
  "ldsf",
  "ldsa",
  "ldgf",
  "ldga",
].join(",");

function resolveSeasonGameType(seasonType: PlayerStatsSeasonType): number {
  if (seasonType === "preSeason") return 1;
  if (seasonType === "playoffs") return 3;
  return 2;
}

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      throw error;
    }

    const pageRows = (data ?? []) as TRow[];
    if (!pageRows.length) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function toPer60(value: number | null | undefined, toiSeconds: number | null | undefined) {
  if (value == null || toiSeconds == null || toiSeconds <= 0) {
    return null;
  }

  return (value * 3600) / toiSeconds;
}

function toPctDecimal(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (numerator == null || denominator == null || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function toPdo(shPct: number | null, svPct: number | null) {
  if (shPct == null || svPct == null) {
    return null;
  }

  return (shPct + svPct) * 100;
}

function createAccumulator(teamId: number, teamLabel: string): TeamAggregationAccumulator {
  return {
    rowKey: `landing:team:${teamId}`,
    teamId,
    teamLabel,
    gameIds: new Set<number>(),
    toiSeconds: 0,
    wins: 0,
    losses: 0,
    otl: 0,
    rowWins: 0,
    points: 0,
    cf: 0,
    ca: 0,
    ff: 0,
    fa: 0,
    sf: 0,
    sa: 0,
    gf: 0,
    ga: 0,
    xgf: 0,
    xga: 0,
    scf: 0,
    sca: 0,
    scsf: 0,
    scsa: 0,
    scgf: 0,
    scga: 0,
    hdcf: 0,
    hdca: 0,
    hdsf: 0,
    hdsa: 0,
    hdgf: 0,
    hdga: 0,
    mdcf: 0,
    mdca: 0,
    mdsf: 0,
    mdsa: 0,
    mdgf: 0,
    mdga: 0,
    ldcf: 0,
    ldca: 0,
    ldsf: 0,
    ldsa: 0,
    ldgf: 0,
    ldga: 0,
  };
}

function addSummaryRow(accumulator: TeamAggregationAccumulator, row: TeamSummaryTableRow) {
  accumulator.gameIds.add(row.game_id);
  accumulator.toiSeconds += row.toi_seconds;
  accumulator.wins += row.wins;
  accumulator.losses += row.losses;
  accumulator.otl += row.otl;
  accumulator.rowWins += row.row_wins;
  accumulator.points += row.points;
  accumulator.cf += row.cf;
  accumulator.ca += row.ca;
  accumulator.ff += row.ff;
  accumulator.fa += row.fa;
  accumulator.sf += row.sf;
  accumulator.sa += row.sa;
  accumulator.gf += row.gf;
  accumulator.ga += row.ga;
  accumulator.xgf += row.xgf;
  accumulator.xga += row.xga;
  accumulator.scf += row.scf;
  accumulator.sca += row.sca;
  accumulator.scsf += row.scsf;
  accumulator.scsa += row.scsa;
  accumulator.scgf += row.scgf;
  accumulator.scga += row.scga;
  accumulator.hdcf += row.hdcf;
  accumulator.hdca += row.hdca;
  accumulator.hdsf += row.hdsf;
  accumulator.hdsa += row.hdsa;
  accumulator.hdgf += row.hdgf;
  accumulator.hdga += row.hdga;
  accumulator.mdcf += row.mdcf;
  accumulator.mdca += row.mdca;
  accumulator.mdsf += row.mdsf;
  accumulator.mdsa += row.mdsa;
  accumulator.mdgf += row.mdgf;
  accumulator.mdga += row.mdga;
  accumulator.ldcf += row.ldcf;
  accumulator.ldca += row.ldca;
  accumulator.ldsf += row.ldsf;
  accumulator.ldsa += row.ldsa;
  accumulator.ldgf += row.ldgf;
  accumulator.ldga += row.ldga;
}

function hasSampledTeamSummaryRow(row: TeamSummaryTableRow) {
  if (row.toi_seconds > 0) {
    return true;
  }

  return (
    row.cf > 0 ||
    row.ca > 0 ||
    row.ff > 0 ||
    row.fa > 0 ||
    row.sf > 0 ||
    row.sa > 0 ||
    row.gf > 0 ||
    row.ga > 0 ||
    row.xgf > 0 ||
    row.xga > 0 ||
    row.scf > 0 ||
    row.sca > 0 ||
    row.scsf > 0 ||
    row.scsa > 0 ||
    row.scgf > 0 ||
    row.scga > 0 ||
    row.hdcf > 0 ||
    row.hdca > 0 ||
    row.hdsf > 0 ||
    row.hdsa > 0 ||
    row.hdgf > 0 ||
    row.hdga > 0 ||
    row.mdcf > 0 ||
    row.mdca > 0 ||
    row.mdsf > 0 ||
    row.mdsa > 0 ||
    row.mdgf > 0 ||
    row.mdga > 0 ||
    row.ldcf > 0 ||
    row.ldca > 0 ||
    row.ldsf > 0 ||
    row.ldsa > 0 ||
    row.ldgf > 0 ||
    row.ldga > 0
  );
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function canApplyOfficialMetricOverlay(state: TeamStatsLandingFilterState) {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;

  return (
    fromSeasonId != null &&
    throughSeasonId != null &&
    fromSeasonId === throughSeasonId &&
    state.expandable.scope.kind === "none" &&
    state.expandable.venue === "all" &&
    state.expandable.againstTeamId == null &&
    state.primary.scoreState === "allScores" &&
    (state.primary.strength === "allStrengths" || state.primary.strength === "fiveOnFive")
  );
}

function roundSeasonTotal(perGame: number | null | undefined, gamesPlayed: number | null | undefined) {
  if (perGame == null || gamesPlayed == null) {
    return null;
  }

  return Math.round(perGame * gamesPlayed);
}

async function fetchOfficialTeamMetricsSnapshot(args: {
  seasonId: number;
  gameType: number;
  supabase: TeamStatsSupabaseClient;
}): Promise<OfficialTeamMetricsSnapshot> {
  const seasonSummaryUrl =
    "https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false" +
    "&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D" +
    `&start=0&limit=50&cayenneExp=gameTypeId=${args.gameType}%20and%20seasonId%3C=${args.seasonId}%20and%20seasonId%3E=${args.seasonId}`;
  const fiveOnFiveUrl =
    "https://api.nhle.com/stats/rest/en/team/summaryshooting?isAggregate=false&isGame=false" +
    "&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D" +
    `&start=0&limit=50&cayenneExp=gameTypeId=${args.gameType}%20and%20seasonId%3C=${args.seasonId}%20and%20seasonId%3E=${args.seasonId}`;
  const shotTypeUrl =
    "https://api.nhle.com/stats/rest/en/team/shottype?isAggregate=false&isGame=false" +
    "&sort=%5B%7B%22property%22:%22shotsOnNet%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D" +
    `&start=0&limit=50&cayenneExp=gameTypeId=${args.gameType}%20and%20seasonId%3C=${args.seasonId}%20and%20seasonId%3E=${args.seasonId}`;

  const [seasonSummaryResponse, fiveOnFiveResponse, shotTypeResponse] = await Promise.all([
    fetchJson<{ data?: OfficialSeasonSummaryRow[] }>(seasonSummaryUrl),
    fetchJson<{ data?: OfficialFiveOnFiveRow[] }>(fiveOnFiveUrl),
    fetchJson<{ data?: OfficialShotTypeRow[] }>(shotTypeUrl),
  ]);

  return {
    seasonSummaryByTeamId: new Map(
      (seasonSummaryResponse.data ?? [])
        .filter((row) => Number.isFinite(row.teamId))
        .map((row) => [row.teamId, row])
    ),
    fiveOnFiveByTeamId: new Map(
      (fiveOnFiveResponse.data ?? [])
        .filter((row) => Number.isFinite(row.teamId))
        .map((row) => [row.teamId, row])
    ),
    shotTypeByTeamId: new Map(
      (shotTypeResponse.data ?? [])
        .filter((row) => Number.isFinite(row.teamId))
        .map((row) => [row.teamId, row])
    ),
  };
}

function applyOfficialRowOverrides(args: {
  row: TeamStatsLandingApiRow;
  state: TeamStatsLandingFilterState;
  official: OfficialTeamMetricsSnapshot;
}): TeamStatsLandingApiRow {
  const { row, state, official } = args;
  const seasonSummary = official.seasonSummaryByTeamId.get(row.teamId);
  const fiveOnFive = official.fiveOnFiveByTeamId.get(row.teamId);

  let nextRow: TeamStatsLandingApiRow = { ...row };

  if (state.primary.strength === "allStrengths" && seasonSummary != null) {
    const shotType = official.shotTypeByTeamId.get(row.teamId);
    const gamesPlayed = seasonSummary.gamesPlayed ?? nextRow.gamesPlayed;
    const toiPerGameSeconds = gamesPlayed > 0 ? nextRow.toiSeconds / gamesPlayed : nextRow.toiPerGameSeconds;
    const wins = seasonSummary.wins ?? nextRow.wins;
    const losses = seasonSummary.losses ?? nextRow.losses;
    const otl = seasonSummary.otLosses ?? nextRow.otl;
    const points = seasonSummary.points ?? nextRow.points;
    const rowWins = seasonSummary.regulationAndOtWins ?? nextRow.rowWins;
    const gf = seasonSummary.goalsFor ?? nextRow.gf;
    const ga = seasonSummary.goalsAgainst ?? nextRow.ga;
    const sf = shotType?.shotsOnNet ?? roundSeasonTotal(seasonSummary.shotsForPerGame, seasonSummary.gamesPlayed) ?? nextRow.sf;
    const sa = roundSeasonTotal(seasonSummary.shotsAgainstPerGame, seasonSummary.gamesPlayed) ?? nextRow.sa;
    const pointPct = toPctDecimal(points, gamesPlayed * 2);
    const sfPct = toPctDecimal(sf, sf + sa);
    const gfPct = toPctDecimal(gf, gf + ga);
    const shPct = toPctDecimal(gf, sf);
    const svPct = toPctDecimal(sa - ga, sa);

    nextRow = {
      ...nextRow,
      gamesPlayed,
      toiPerGameSeconds,
      wins,
      losses,
      otl,
      rowWins,
      points,
      pointPct,
      sf,
      sa,
      sfPct,
      gf,
      ga,
      gfPct,
      shPct,
      svPct,
      pdo: toPdo(shPct, svPct),
      sfPer60: nextRow.sfPer60 == null ? nextRow.sfPer60 : toPer60(sf, nextRow.toiSeconds),
      saPer60: nextRow.saPer60 == null ? nextRow.saPer60 : toPer60(sa, nextRow.toiSeconds),
      gfPer60: nextRow.gfPer60 == null ? nextRow.gfPer60 : toPer60(gf, nextRow.toiSeconds),
      gaPer60: nextRow.gaPer60 == null ? nextRow.gaPer60 : toPer60(ga, nextRow.toiSeconds),
    };
  }

  if (state.primary.strength === "fiveOnFive" && fiveOnFive != null) {
    const gamesPlayed = fiveOnFive.gamesPlayed ?? nextRow.gamesPlayed;
    const toiPerGameSeconds = gamesPlayed > 0 ? nextRow.toiSeconds / gamesPlayed : nextRow.toiPerGameSeconds;
    const cf = fiveOnFive.satFor ?? nextRow.cf;
    const ca = fiveOnFive.satAgainst ?? nextRow.ca;
    const ff = fiveOnFive.usatFor ?? nextRow.ff;
    const fa = fiveOnFive.usatAgainst ?? nextRow.fa;
    const sf = fiveOnFive.shots5v5 ?? nextRow.sf;
    const cfPct = toPctDecimal(cf, cf + ca);
    const ffPct = toPctDecimal(ff, ff + fa);
    const sfPct = toPctDecimal(sf, sf + nextRow.sa);
    const shPct = toPctDecimal(nextRow.gf, sf);
    const pdo = toPdo(shPct, nextRow.svPct as number | null);

    nextRow = {
      ...nextRow,
      gamesPlayed,
      toiPerGameSeconds,
      cf,
      ca,
      cfPct,
      ff,
      fa,
      ffPct,
      sf,
      sfPct,
      shPct,
      pdo,
      cfPer60: nextRow.cfPer60 == null ? nextRow.cfPer60 : toPer60(cf, nextRow.toiSeconds),
      caPer60: nextRow.caPer60 == null ? nextRow.caPer60 : toPer60(ca, nextRow.toiSeconds),
      ffPer60: nextRow.ffPer60 == null ? nextRow.ffPer60 : toPer60(ff, nextRow.toiSeconds),
      faPer60: nextRow.faPer60 == null ? nextRow.faPer60 : toPer60(fa, nextRow.toiSeconds),
      sfPer60: nextRow.sfPer60 == null ? nextRow.sfPer60 : toPer60(sf, nextRow.toiSeconds),
    };
  }

  return nextRow;
}

async function maybeApplyOfficialMetricOverlay(args: {
  rows: TeamStatsLandingApiRow[];
  state: TeamStatsLandingFilterState;
  supabase: TeamStatsSupabaseClient;
}): Promise<TeamStatsLandingApiRow[]> {
  if (args.supabase !== serverReadonlyClient || !canApplyOfficialMetricOverlay(args.state)) {
    return args.rows;
  }

  const seasonId = args.state.primary.seasonRange.fromSeasonId;
  if (seasonId == null) {
    return args.rows;
  }

  try {
    const official = await fetchOfficialTeamMetricsSnapshot({
      seasonId,
      gameType: resolveSeasonGameType(args.state.primary.seasonType),
      supabase: serverReadonlyClient,
    });

    return args.rows.map((row) =>
      applyOfficialRowOverrides({
        row,
        state: args.state,
        official,
      })
    );
  } catch {
    return args.rows;
  }
}

function mapAccumulatorToApiRow(
  accumulator: TeamAggregationAccumulator,
  displayMode: PlayerStatsDisplayMode
): TeamStatsLandingApiRow {
  const gamesPlayed = accumulator.gameIds.size;
  const toiPerGameSeconds = gamesPlayed > 0 ? accumulator.toiSeconds / gamesPlayed : null;
  const pointPct = toPctDecimal(accumulator.points, gamesPlayed * 2);
  const cfPct = toPctDecimal(accumulator.cf, accumulator.cf + accumulator.ca);
  const ffPct = toPctDecimal(accumulator.ff, accumulator.ff + accumulator.fa);
  const sfPct = toPctDecimal(accumulator.sf, accumulator.sf + accumulator.sa);
  const gfPct = toPctDecimal(accumulator.gf, accumulator.gf + accumulator.ga);
  const xgfPct = toPctDecimal(accumulator.xgf, accumulator.xgf + accumulator.xga);
  const scfPct = toPctDecimal(accumulator.scf, accumulator.scf + accumulator.sca);
  const scsfPct = toPctDecimal(accumulator.scsf, accumulator.scsf + accumulator.scsa);
  const scgfPct = toPctDecimal(accumulator.scgf, accumulator.scgf + accumulator.scga);
  const scshPct = toPctDecimal(accumulator.scgf, accumulator.scsf);
  const scsvPct = toPctDecimal(accumulator.scsa - accumulator.scga, accumulator.scsa);
  const hdcfPct = toPctDecimal(accumulator.hdcf, accumulator.hdcf + accumulator.hdca);
  const hdsfPct = toPctDecimal(accumulator.hdsf, accumulator.hdsf + accumulator.hdsa);
  const hdgfPct = toPctDecimal(accumulator.hdgf, accumulator.hdgf + accumulator.hdga);
  const hdshPct = toPctDecimal(accumulator.hdgf, accumulator.hdsf);
  const hdsvPct = toPctDecimal(accumulator.hdsa - accumulator.hdga, accumulator.hdsa);
  const mdcfPct = toPctDecimal(accumulator.mdcf, accumulator.mdcf + accumulator.mdca);
  const mdsfPct = toPctDecimal(accumulator.mdsf, accumulator.mdsf + accumulator.mdsa);
  const mdgfPct = toPctDecimal(accumulator.mdgf, accumulator.mdgf + accumulator.mdga);
  const mdshPct = toPctDecimal(accumulator.mdgf, accumulator.mdsf);
  const mdsvPct = toPctDecimal(accumulator.mdsa - accumulator.mdga, accumulator.mdsa);
  const ldcfPct = toPctDecimal(accumulator.ldcf, accumulator.ldcf + accumulator.ldca);
  const ldsfPct = toPctDecimal(accumulator.ldsf, accumulator.ldsf + accumulator.ldsa);
  const ldgfPct = toPctDecimal(accumulator.ldgf, accumulator.ldgf + accumulator.ldga);
  const ldshPct = toPctDecimal(accumulator.ldgf, accumulator.ldsf);
  const ldsvPct = toPctDecimal(accumulator.ldsa - accumulator.ldga, accumulator.ldsa);
  const shPct = toPctDecimal(accumulator.gf, accumulator.sf);
  const svPct = toPctDecimal(accumulator.sa - accumulator.ga, accumulator.sa);
  const baseRow: TeamStatsLandingApiRow = {
    rowKey: accumulator.rowKey,
    teamId: accumulator.teamId,
    teamLabel: accumulator.teamLabel,
    gamesPlayed,
    toiSeconds: accumulator.toiSeconds,
    toiPerGameSeconds,
    wins: accumulator.wins,
    losses: accumulator.losses,
    otl: accumulator.otl,
    rowWins: accumulator.rowWins,
    points: accumulator.points,
    pointPct,
    cf: accumulator.cf,
    ca: accumulator.ca,
    cfPct,
    ff: accumulator.ff,
    fa: accumulator.fa,
    ffPct,
    sf: accumulator.sf,
    sa: accumulator.sa,
    sfPct,
    gf: accumulator.gf,
    ga: accumulator.ga,
    gfPct,
    xgf: accumulator.xgf,
    xga: accumulator.xga,
    xgfPct,
    scf: accumulator.scf,
    sca: accumulator.sca,
    scfPct,
    scsf: accumulator.scsf,
    scsa: accumulator.scsa,
    scsfPct,
    scgf: accumulator.scgf,
    scga: accumulator.scga,
    scgfPct,
    scshPct,
    scsvPct,
    hdcf: accumulator.hdcf,
    hdca: accumulator.hdca,
    hdcfPct,
    hdsf: accumulator.hdsf,
    hdsa: accumulator.hdsa,
    hdsfPct,
    hdgf: accumulator.hdgf,
    hdga: accumulator.hdga,
    hdgfPct,
    hdshPct,
    hdsvPct,
    mdcf: accumulator.mdcf,
    mdca: accumulator.mdca,
    mdcfPct,
    mdsf: accumulator.mdsf,
    mdsa: accumulator.mdsa,
    mdsfPct,
    mdgf: accumulator.mdgf,
    mdga: accumulator.mdga,
    mdgfPct,
    mdshPct,
    mdsvPct,
    ldcf: accumulator.ldcf,
    ldca: accumulator.ldca,
    ldcfPct,
    ldsf: accumulator.ldsf,
    ldsa: accumulator.ldsa,
    ldsfPct,
    ldgf: accumulator.ldgf,
    ldga: accumulator.ldga,
    ldgfPct,
    ldshPct,
    ldsvPct,
    shPct,
    svPct,
    pdo: toPdo(shPct, svPct),
  };

  if (displayMode === "counts") {
    return baseRow;
  }

  return {
    ...baseRow,
    cfPer60: toPer60(accumulator.cf, accumulator.toiSeconds),
    caPer60: toPer60(accumulator.ca, accumulator.toiSeconds),
    ffPer60: toPer60(accumulator.ff, accumulator.toiSeconds),
    faPer60: toPer60(accumulator.fa, accumulator.toiSeconds),
    sfPer60: toPer60(accumulator.sf, accumulator.toiSeconds),
    saPer60: toPer60(accumulator.sa, accumulator.toiSeconds),
    gfPer60: toPer60(accumulator.gf, accumulator.toiSeconds),
    gaPer60: toPer60(accumulator.ga, accumulator.toiSeconds),
    xgfPer60: toPer60(accumulator.xgf, accumulator.toiSeconds),
    xgaPer60: toPer60(accumulator.xga, accumulator.toiSeconds),
    scfPer60: toPer60(accumulator.scf, accumulator.toiSeconds),
    scaPer60: toPer60(accumulator.sca, accumulator.toiSeconds),
    scsfPer60: toPer60(accumulator.scsf, accumulator.toiSeconds),
    scsaPer60: toPer60(accumulator.scsa, accumulator.toiSeconds),
    scgfPer60: toPer60(accumulator.scgf, accumulator.toiSeconds),
    scgaPer60: toPer60(accumulator.scga, accumulator.toiSeconds),
    hdcfPer60: toPer60(accumulator.hdcf, accumulator.toiSeconds),
    hdcaPer60: toPer60(accumulator.hdca, accumulator.toiSeconds),
    hdsfPer60: toPer60(accumulator.hdsf, accumulator.toiSeconds),
    hdsaPer60: toPer60(accumulator.hdsa, accumulator.toiSeconds),
    hdgfPer60: toPer60(accumulator.hdgf, accumulator.toiSeconds),
    hdgaPer60: toPer60(accumulator.hdga, accumulator.toiSeconds),
    mdcfPer60: toPer60(accumulator.mdcf, accumulator.toiSeconds),
    mdcaPer60: toPer60(accumulator.mdca, accumulator.toiSeconds),
    mdsfPer60: toPer60(accumulator.mdsf, accumulator.toiSeconds),
    mdsaPer60: toPer60(accumulator.mdsa, accumulator.toiSeconds),
    mdgfPer60: toPer60(accumulator.mdgf, accumulator.toiSeconds),
    mdgaPer60: toPer60(accumulator.mdga, accumulator.toiSeconds),
    ldcfPer60: toPer60(accumulator.ldcf, accumulator.toiSeconds),
    ldcaPer60: toPer60(accumulator.ldca, accumulator.toiSeconds),
    ldsfPer60: toPer60(accumulator.ldsf, accumulator.toiSeconds),
    ldsaPer60: toPer60(accumulator.ldsa, accumulator.toiSeconds),
    ldgfPer60: toPer60(accumulator.ldgf, accumulator.toiSeconds),
    ldgaPer60: toPer60(accumulator.ldga, accumulator.toiSeconds),
  };
}

function sortRows(rows: TeamStatsLandingApiRow[], sort: TeamStatsSortState) {
  return [...rows].sort((left, right) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    const comparison = compareValues(left[sort.sortKey ?? "teamLabel"], right[sort.sortKey ?? "teamLabel"]);
    if (comparison !== 0) {
      return comparison * direction;
    }

    return left.teamLabel.localeCompare(right.teamLabel);
  });
}

async function fetchTeamMap(args: {
  supabase: TeamStatsSupabaseClient;
  teamIds: number[];
}): Promise<Map<number, TeamRow>> {
  if (args.teamIds.length === 0) {
    return new Map();
  }

  const { data, error } = await args.supabase
    .from("teams")
    .select("id,abbreviation")
    .in("id", args.teamIds);

  if (error) {
    throw error;
  }

  const map = new Map<number, TeamRow>();
  for (const team of (data ?? []) as TeamRow[]) {
    map.set(team.id, team);
  }
  return map;
}

async function fetchSummaryRows(args: {
  state: TeamStatsLandingFilterState;
  supabase: TeamStatsSupabaseClient;
}): Promise<TeamSummaryTableRow[]> {
  const requestedGameType = resolveSeasonGameType(args.state.primary.seasonType);
  const fromSeasonId = args.state.primary.seasonRange.fromSeasonId ?? 0;
  const throughSeasonId = args.state.primary.seasonRange.throughSeasonId ?? 0;
  const databaseClient = args.supabase as any;

  return fetchAllRows<TeamSummaryTableRow>((from, to) => {
    let query = databaseClient
      .from(TEAM_STATS_SUMMARY_TABLE)
      .select(TEAM_SUMMARY_SELECT)
      .gte("season_id", fromSeasonId)
      .lte("season_id", throughSeasonId)
      .eq("game_type", requestedGameType)
      .eq("strength", args.state.primary.strength)
      .eq("score_state", args.state.primary.scoreState)
      .order("game_date", { ascending: false })
      .order("game_id", { ascending: false });

    if (args.state.expandable.teamId != null) {
      query = query.eq("team_id", args.state.expandable.teamId);
    }

    if (args.state.expandable.againstTeamId != null) {
      query = query.eq("opponent_team_id", args.state.expandable.againstTeamId);
    }

    if (args.state.expandable.venue !== "all") {
      query = query.eq("venue", args.state.expandable.venue);
    }

    if (args.state.expandable.scope.kind === "dateRange") {
      if (args.state.expandable.scope.startDate) {
        query = query.gte("game_date", args.state.expandable.scope.startDate);
      }
      if (args.state.expandable.scope.endDate) {
        query = query.lte("game_date", args.state.expandable.scope.endDate);
      }
    }

    return query.range(from, to);
  });
}

function applyScopedRowWindow(
  state: TeamStatsLandingFilterState,
  rows: TeamSummaryTableRow[]
): TeamSummaryTableRow[] {
  if (state.expandable.scope.kind === "none" || state.expandable.scope.kind === "dateRange") {
    return rows;
  }

  const limit = state.expandable.scope.value;
  if (limit == null || limit <= 0) {
    return rows;
  }

  if (state.expandable.scope.kind === "gameRange") {
    const selectedGameIds = [...new Set(rows.map((row) => row.game_id))]
      .sort((left, right) => right - left)
      .slice(0, limit);
    const allowed = new Set(selectedGameIds);
    return rows.filter((row) => allowed.has(row.game_id));
  }

  const rowsByTeam = new Map<number, TeamSummaryTableRow[]>();
  for (const row of rows) {
    const bucket = rowsByTeam.get(row.team_id) ?? [];
    bucket.push(row);
    rowsByTeam.set(row.team_id, bucket);
  }

  const filtered: TeamSummaryTableRow[] = [];
  for (const teamRows of rowsByTeam.values()) {
    const allowedGameIds = [...new Set(teamRows.map((row) => row.game_id))]
      .sort((left, right) => right - left)
      .slice(0, limit);
    const allowed = new Set(allowedGameIds);
    filtered.push(...teamRows.filter((row) => allowed.has(row.game_id)));
  }

  return filtered;
}

function applyMinimumToiFilter(
  rows: TeamStatsLandingApiRow[],
  minimumToiSeconds: number | null
): TeamStatsLandingApiRow[] {
  if (minimumToiSeconds == null || minimumToiSeconds <= 0) {
    return rows;
  }

  return rows.filter((row) => row.toiSeconds >= minimumToiSeconds);
}

export function parseTeamLandingApiRequest(
  query: NextApiRequestQuery
):
  | { ok: true; state: TeamStatsLandingFilterState }
  | { ok: false; error: TeamStatsLandingApiError; statusCode: number } {
  const fallbackState = createDefaultTeamLandingFilterState();
  const state = parseTeamStatsFilterStateFromQuery(query, fallbackState);
  const validation = validateTeamStatsFilterState(state);

  if (!validation.isValid) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid team stats filter combination.",
        issues: validation.issues,
      },
    };
  }

  return {
    ok: true,
    state,
  };
}

export async function queryTeamStatsLanding(args: {
  state: TeamStatsLandingFilterState;
  supabase?: TeamStatsSupabaseClient;
}): Promise<TeamStatsLandingApiResponse> {
  const supabase = args.supabase ?? serverReadonlyClient;
  const summaryRows = applyScopedRowWindow(
    args.state,
    await fetchSummaryRows({ state: args.state, supabase })
  ).filter(hasSampledTeamSummaryRow);

  if (summaryRows.length === 0) {
    return createEmptyTeamStatsLandingResponse(args.state);
  }

  const teamIds = [...new Set(summaryRows.map((row) => row.team_id))];
  const teamMap = await fetchTeamMap({ supabase, teamIds });
  const aggregates = new Map<number, TeamAggregationAccumulator>();

  for (const row of summaryRows) {
    const teamLabel = teamMap.get(row.team_id)?.abbreviation ?? String(row.team_id);
    const accumulator = aggregates.get(row.team_id) ?? createAccumulator(row.team_id, teamLabel);
    addSummaryRow(accumulator, row);
    aggregates.set(row.team_id, accumulator);
  }

  const mappedRows = await maybeApplyOfficialMetricOverlay({
    rows: [...aggregates.values()].map((accumulator) =>
      mapAccumulatorToApiRow(accumulator, args.state.primary.displayMode)
    ),
    state: args.state,
    supabase,
  });
  const filteredRows = applyMinimumToiFilter(
    mappedRows,
    args.state.expandable.minimumToiSeconds
  );
  const sortedRows = sortRows(filteredRows, args.state.view.sort).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  const page = args.state.view.pagination.page;
  const pageSize = args.state.view.pagination.pageSize;
  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
  const start = Math.max(page - 1, 0) * pageSize;

  return {
    family: resolveTeamStatsTableFamily(args.state.primary.displayMode),
    rows: sortedRows.slice(start, start + pageSize),
    sort: args.state.view.sort,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
    placeholder: false,
    generatedAt: new Date().toISOString(),
  };
}