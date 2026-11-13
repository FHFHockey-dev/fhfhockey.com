import { DESCRIPTIVE_SOS_VERSION } from "./strengthOfScheduleContract";
import type { TeamSosSnapshotRow } from "./teamSosSnapshot";

/** v1 `sos_standings` row: issued history (rule 21), no longer served. */
export type SosStandingRow = {
  season_id: number;
  game_date: string;
  team_id: number;
  team_name: string | null;
  team_abbrev: string | null;
  past_opponent_total_wins: number | null;
  past_opponent_total_losses: number | null;
  past_opponent_total_ot_losses: number | null;
  future_opponent_total_wins: number | null;
  future_opponent_total_losses: number | null;
  future_opponent_total_ot_losses: number | null;
};

export type SosRating = {
  team: string;
  teamId: number;
  date: string;
  past: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  future: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  combinedWinPct: number;
  sosScore: number; // 0-100 scale: combinedWinPct * 100
};

export type CanonicalSosTeam = {
  id: number;
  name: string;
  abbreviation: string;
};

export type CanonicalSosRanking = {
  teamId: number;
  team: string;
  abbreviation: string;
  /** Opponents' win% (0-1); null when unknown, never 0. */
  sos: number | null;
};

export type CanonicalSosRankings = {
  past: CanonicalSosRanking[];
  future: CanonicalSosRanking[];
};

const pct = (wins: number, losses: number, otl: number): number => {
  const total = wins + losses + otl;
  if (total <= 0) return 0;
  // Use straight win percentage so the league-wide mean sits at ~0.500.
  // Counting OT losses as half-wins inflates the average because every OT game
  // adds an extra half-win but no extra game.
  return wins / total;
};

/** v1 reader (sos_standings history). Served readers use computeSosRatingsV2. */
export function computeSosRatings(rows: SosStandingRow[]): SosRating[] {
  // Take the latest row per team_abbrev
  const latestByTeam = new Map<string, SosStandingRow>();

  rows.forEach((row) => {
    const team = row.team_abbrev ?? String(row.team_id);
    const existing = latestByTeam.get(team);
    if (!existing || row.game_date > existing.game_date) {
      latestByTeam.set(team, row);
    }
  });

  const ratings: SosRating[] = [];
  latestByTeam.forEach((row, team) => {
    const pastWins = row.past_opponent_total_wins ?? 0;
    const pastLosses = row.past_opponent_total_losses ?? 0;
    const pastOtl = row.past_opponent_total_ot_losses ?? 0;
    const futureWins = row.future_opponent_total_wins ?? 0;
    const futureLosses = row.future_opponent_total_losses ?? 0;
    const futureOtl = row.future_opponent_total_ot_losses ?? 0;

    const pastPct = pct(pastWins, pastLosses, pastOtl);
    const futurePct = pct(futureWins, futureLosses, futureOtl);
    const pastGames = pastWins + pastLosses + pastOtl;
    const futureGames = futureWins + futureLosses + futureOtl;
    const combinedWinPct =
      pastGames + futureGames > 0
        ? (pastPct * pastGames + futurePct * futureGames) /
          (pastGames + futureGames)
        : (pastPct + futurePct) / 2;

    ratings.push({
      team,
      teamId: row.team_id,
      date: row.game_date,
      past: {
        wins: pastWins,
        losses: pastLosses,
        otl: pastOtl,
        winPct: pastPct,
      },
      future: {
        wins: futureWins,
        losses: futureLosses,
        otl: futureOtl,
        winPct: futurePct,
      },
      combinedWinPct,
      sosScore: Number((combinedWinPct * 100).toFixed(2)),
    });
  });

  return ratings.sort((a, b) => b.sosScore - a.sosScore);
}

/** v1 reader (sos_standings history). Served readers use buildCanonicalSosRankingsV2. */
export function buildCanonicalSosRankings(
  rows: SosStandingRow[],
  teams: CanonicalSosTeam[],
): CanonicalSosRankings {
  const currentTeamsById = new Map(teams.map((team) => [team.id, team]));
  const currentRows = rows.filter((row) => currentTeamsById.has(row.team_id));
  const latestValidByTeamId = new Map<number, SosStandingRow>();

  for (const row of currentRows) {
    const pastTotal =
      (row.past_opponent_total_wins ?? 0) +
      (row.past_opponent_total_losses ?? 0) +
      (row.past_opponent_total_ot_losses ?? 0);
    const futureTotal =
      (row.future_opponent_total_wins ?? 0) +
      (row.future_opponent_total_losses ?? 0) +
      (row.future_opponent_total_ot_losses ?? 0);
    if (pastTotal === 0 && futureTotal === 0) continue;

    const existing = latestValidByTeamId.get(row.team_id);
    if (!existing || row.game_date > existing.game_date) {
      latestValidByTeamId.set(row.team_id, row);
    }
  }

  const past: CanonicalSosRanking[] = [];
  const future: CanonicalSosRanking[] = [];

  for (const [teamId, row] of latestValidByTeamId) {
    const team = currentTeamsById.get(teamId);
    if (!team) continue;

    const pastWins = row.past_opponent_total_wins ?? 0;
    const pastLosses = row.past_opponent_total_losses ?? 0;
    const pastOtl = row.past_opponent_total_ot_losses ?? 0;
    const futureWins = row.future_opponent_total_wins ?? 0;
    const futureLosses = row.future_opponent_total_losses ?? 0;
    const futureOtl = row.future_opponent_total_ot_losses ?? 0;

    past.push({
      teamId,
      team: team.name,
      abbreviation: team.abbreviation,
      sos: Number(pct(pastWins, pastLosses, pastOtl).toFixed(3)),
    });
    future.push({
      teamId,
      team: team.name,
      abbreviation: team.abbreviation,
      sos: Number(pct(futureWins, futureLosses, futureOtl).toFixed(3)),
    });
  }

  // v1 always sets a number.
  past.sort((a, b) => b.sos! - a.sos!);
  future.sort((a, b) => b.sos! - a.sos!);
  return { past, future };
}

// ---------------------------------------------------------------------------
// descriptive-sos-v2 readers (team_sos_daily). Values are means over fixtures
// of opponents' records excluding games against the team; past counts final
// games only and started or postponed fixtures are reported as pending.

export const TEAM_SOS_READER_COLUMNS = [
  "season_id",
  "snapshot_date",
  "team_id",
  "team_abbrev",
  "sos_version",
  "past_view",
  "cutoff_at",
  "past_fixtures",
  "pending_fixtures",
  "future_fixtures",
  "past_direct_supported",
  "future_direct_supported",
  "past_direct_win_pct",
  "past_indirect_win_pct",
  "past_direct_points_pct",
  "past_indirect_points_pct",
  "future_direct_win_pct",
  "future_indirect_win_pct",
  "future_direct_points_pct",
  "future_indirect_points_pct",
].join(",");

export type TeamSosReaderRow = Pick<
  TeamSosSnapshotRow,
  | "season_id"
  | "snapshot_date"
  | "team_id"
  | "team_abbrev"
  | "sos_version"
  | "past_view"
  | "cutoff_at"
  | "past_fixtures"
  | "pending_fixtures"
  | "future_fixtures"
  | "past_direct_supported"
  | "future_direct_supported"
  | "past_direct_win_pct"
  | "past_indirect_win_pct"
  | "past_direct_points_pct"
  | "past_indirect_points_pct"
  | "future_direct_win_pct"
  | "future_indirect_win_pct"
  | "future_direct_points_pct"
  | "future_indirect_points_pct"
>;

export type SosBucketV2 = {
  /** Mean over fixtures of the opponent's win% (W / GP). */
  winPct: number | null;
  /** Mean over fixtures of the opponent's points% ((2W + OTL) / 2GP). */
  pointsPct: number | null;
  indirectWinPct: number | null;
  indirectPointsPct: number | null;
  fixtures: number;
  directSupported: number;
};

export type SosRatingV2 = {
  team: string;
  teamId: number;
  date: string;
  cutoffAt: string;
  version: typeof DESCRIPTIVE_SOS_VERSION;
  past: SosBucketV2 & { pendingFixtures: number };
  future: SosBucketV2;
  /** Fixture-weighted mean of past and future win%; null if either is unknown. */
  combinedWinPct: number | null;
  sosScore: number | null;
};

const finite = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

const servedV2Rows = (rows: TeamSosReaderRow[]) =>
  rows.filter((row) => row.sos_version === DESCRIPTIVE_SOS_VERSION);

/** Both means are over fixtures, so the combination weights by fixture counts. */
const combineFixtureMeans = (
  past: number | null,
  pastFixtures: number,
  future: number | null,
  futureFixtures: number,
): number | null => {
  if (pastFixtures + futureFixtures === 0) return null;
  if ((pastFixtures > 0 && past === null) || (futureFixtures > 0 && future === null)) {
    return null;
  }
  return ((past ?? 0) * pastFixtures + (future ?? 0) * futureFixtures) /
    (pastFixtures + futureFixtures);
};

/** Known values first (descending), unknown last; ties by team, never input order. */
const compareNullableDesc = (
  a: number | null,
  b: number | null,
  aKey: string,
  bKey: string,
) => {
  if (a === null || b === null) {
    if (a !== b) return a === null ? 1 : -1;
  } else if (a !== b) {
    return b - a;
  }
  return aKey.localeCompare(bKey);
};

export function computeSosRatingsV2(rows: TeamSosReaderRow[]): SosRatingV2[] {
  return servedV2Rows(rows)
    .map((row) => {
      const pastFixtures = row.past_fixtures ?? 0;
      const futureFixtures = row.future_fixtures ?? 0;
      const past = {
        winPct: finite(row.past_direct_win_pct),
        pointsPct: finite(row.past_direct_points_pct),
        indirectWinPct: finite(row.past_indirect_win_pct),
        indirectPointsPct: finite(row.past_indirect_points_pct),
        fixtures: pastFixtures,
        directSupported: row.past_direct_supported ?? 0,
        pendingFixtures: row.pending_fixtures ?? 0,
      };
      const future = {
        winPct: finite(row.future_direct_win_pct),
        pointsPct: finite(row.future_direct_points_pct),
        indirectWinPct: finite(row.future_indirect_win_pct),
        indirectPointsPct: finite(row.future_indirect_points_pct),
        fixtures: futureFixtures,
        directSupported: row.future_direct_supported ?? 0,
      };
      const combinedWinPct = combineFixtureMeans(
        past.winPct,
        pastFixtures,
        future.winPct,
        futureFixtures,
      );
      return {
        team: row.team_abbrev,
        teamId: row.team_id,
        date: row.snapshot_date,
        cutoffAt: row.cutoff_at,
        version: DESCRIPTIVE_SOS_VERSION,
        past,
        future,
        combinedWinPct,
        sosScore: combinedWinPct === null ? null : Number((combinedWinPct * 100).toFixed(2)),
      };
    })
    .sort((a, b) => compareNullableDesc(a.sosScore, b.sosScore, a.team, b.team));
}

export function buildCanonicalSosRankingsV2(
  rows: TeamSosReaderRow[],
  teams: CanonicalSosTeam[],
): CanonicalSosRankings {
  const currentTeamsById = new Map(teams.map((team) => [team.id, team]));
  const latestByTeamId = new Map<number, TeamSosReaderRow>();
  for (const row of servedV2Rows(rows)) {
    if (!currentTeamsById.has(row.team_id)) continue;
    const existing = latestByTeamId.get(row.team_id);
    if (!existing || row.cutoff_at > existing.cutoff_at) {
      latestByTeamId.set(row.team_id, row);
    }
  }
  const past: CanonicalSosRanking[] = [];
  const future: CanonicalSosRanking[] = [];
  for (const [teamId, row] of latestByTeamId) {
    const team = currentTeamsById.get(teamId)!;
    const base = { teamId, team: team.name, abbreviation: team.abbreviation };
    const round = (value: number | null) => (value === null ? null : Number(value.toFixed(3)));
    past.push({ ...base, sos: round(finite(row.past_direct_win_pct)) });
    future.push({ ...base, sos: round(finite(row.future_direct_win_pct)) });
  }
  const order = (a: CanonicalSosRanking, b: CanonicalSosRanking) =>
    compareNullableDesc(a.sos, b.sos, a.abbreviation, b.abbreviation);
  past.sort(order);
  future.sort(order);
  return { past, future };
}
