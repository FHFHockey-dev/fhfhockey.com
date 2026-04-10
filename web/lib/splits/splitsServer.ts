import serviceRoleClient from "lib/supabase/server";
import { teamsInfo } from "lib/teamsInfo";

import {
  buildSplitTeamOptions,
  normalizeTeamAbbreviation,
  resolveDefaultOpponentAbbreviation,
  toRounded,
  type SplitGoalieRow,
  type SplitLandingGoalieLeader,
  type SplitLandingSkaterLeader,
  type SplitPpShotShareRow,
  type SplitSkaterRow,
  type SplitTeamOption,
  type SplitsApiResponse,
} from "./splitsSurface";

type TeamLookup = {
  abbreviation: string;
  id: number;
  name: string;
};

type RosterRow = {
  playerId: number;
  teamId: number;
  players: {
    fullName: string | null;
    position: string | null;
  } | null;
};

type StrengthGameRow = {
  player_id: number;
  team_id: number;
  opponent_team_id: number | null;
  goals_es: number | null;
  goals_pk: number | null;
  goals_pp: number | null;
  assists_es: number | null;
  assists_pk: number | null;
  assists_pp: number | null;
  shots_es: number | null;
  shots_pk: number | null;
  shots_pp: number | null;
  plus_minus: number | null;
  pim: number | null;
  hits: number | null;
  blocks: number | null;
  toi_es_seconds: number | null;
  toi_pk_seconds: number | null;
  toi_pp_seconds: number | null;
};

type TeamStrengthGameRow = {
  team_id: number;
  opponent_team_id: number | null;
  toi_pp_seconds: number | null;
};

type GoalieGameRow = {
  playerId: number;
  gameId: number;
  goalsAgainst: number;
  saveShotsAgainst: string;
  toi: string | null;
};

type GameRow = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
};

type GameOutcomeRow = {
  gameId: number | null;
  outcome: string | null;
};

type PlayerDirectoryEntry = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
  teamId: number;
};

type PlayerDirectory = {
  byPlayerId: Map<number, PlayerDirectoryEntry>;
  byTeamId: Map<number, PlayerDirectoryEntry[]>;
};

type CurrentSeasonContext = {
  id: number;
  startDate: string;
  endDate: string;
};

function getAllTeamOptions(): SplitTeamOption[] {
  return buildSplitTeamOptions(
    Object.entries(teamsInfo).map(([abbreviation, team]) => ({
      abbreviation,
      name: team.name,
    }))
  );
}

function resolveTeamLookup(
  abbreviation: string | null | undefined
): TeamLookup | null {
  const normalized = normalizeTeamAbbreviation(abbreviation);
  if (!normalized) {
    return null;
  }

  const team = teamsInfo[normalized];
  if (!team) {
    return null;
  }

  return {
    abbreviation: normalized,
    id: team.id,
    name: team.name,
  };
}

function safeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function findTeamAbbreviationById(teamId: number | null | undefined): string | null {
  if (!Number.isFinite(teamId)) {
    return null;
  }

  return (
    Object.keys(teamsInfo).find(
      (abbreviation) => teamsInfo[abbreviation]?.id === teamId
    ) ?? null
  );
}

function parseToiToSeconds(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

function parseSaveShotsAgainst(value: string | null | undefined) {
  if (!value) {
    return {
      saves: 0,
      shotsAgainst: 0,
    };
  }

  const [savesRaw, shotsRaw] = value.split(/[/-]/);
  const saves = Number.parseInt(savesRaw ?? "0", 10);
  const shotsAgainst = Number.parseInt(shotsRaw ?? "0", 10);

  return {
    saves: Number.isFinite(saves) ? saves : 0,
    shotsAgainst: Number.isFinite(shotsAgainst) ? shotsAgainst : 0,
  };
}

async function fetchCurrentSeasonContext(): Promise<CurrentSeasonContext> {
  const { data: currentSeasonRows, error: currentSeasonError } = await serviceRoleClient
    .from("vw_current_season")
    .select("season_id")
    .limit(1);

  if (currentSeasonError) {
    throw new Error(`Unable to load current season id: ${currentSeasonError.message}`);
  }

  const currentSeasonId = Number(currentSeasonRows?.[0]?.season_id ?? 0);
  if (!Number.isFinite(currentSeasonId) || currentSeasonId <= 0) {
    throw new Error("Current season id is unavailable.");
  }

  const { data: seasonRow, error: seasonError } = await serviceRoleClient
    .from("seasons")
    .select("id, startDate, endDate")
    .eq("id", currentSeasonId)
    .maybeSingle();

  if (seasonError) {
    throw new Error(`Unable to load current season dates: ${seasonError.message}`);
  }

  if (!seasonRow?.startDate || !seasonRow?.endDate) {
    throw new Error("Current season dates are unavailable.");
  }

  return {
    id: currentSeasonId,
    startDate: seasonRow.startDate,
    endDate: seasonRow.endDate,
  };
}

async function fetchPlayerDirectory(currentSeasonId: number): Promise<PlayerDirectory> {
  return fetchPlayerDirectoryForTeam({ currentSeasonId });
}

async function fetchPlayerDirectoryForTeam(args: {
  currentSeasonId: number;
  teamId?: number;
}): Promise<PlayerDirectory> {
  const { data, error } = await serviceRoleClient
    .from("rosters")
    .select("playerId, teamId, players:playerId(fullName, position)")
    .eq("seasonId", args.currentSeasonId)
    .match(args.teamId == null ? {} : { teamId: args.teamId });

  if (error) {
    throw new Error(`Unable to load roster directory: ${error.message}`);
  }

  const byPlayerId = new Map<number, PlayerDirectoryEntry>();
  const byTeamId = new Map<number, PlayerDirectoryEntry[]>();

  for (const row of ((data ?? []) as RosterRow[])) {
    const entry: PlayerDirectoryEntry = {
      playerId: row.playerId,
      playerName: row.players?.fullName ?? `Player ${row.playerId}`,
      positionCode: row.players?.position ?? null,
      teamId: row.teamId,
    };
    byPlayerId.set(entry.playerId, entry);
    const existing = byTeamId.get(entry.teamId) ?? [];
    existing.push(entry);
    byTeamId.set(entry.teamId, existing);
  }

  byTeamId.forEach((entries) =>
    entries.sort((left, right) => left.playerName.localeCompare(right.playerName))
  );

  return {
    byPlayerId,
    byTeamId,
  };
}

async function fetchCurrentSeasonGames(currentSeasonId: number) {
  const { data, error } = await serviceRoleClient
    .from("games")
    .select("id, homeTeamId, awayTeamId")
    .eq("seasonId", currentSeasonId);

  if (error) {
    throw new Error(`Unable to load season games: ${error.message}`);
  }

  return ((data ?? []) as GameRow[]).filter(
    (row) =>
      Number.isFinite(row.id) &&
      Number.isFinite(row.homeTeamId) &&
      Number.isFinite(row.awayTeamId)
  );
}

async function fetchStrengthRowsForSeason(args: {
  seasonStartDate: string;
  seasonEndDate: string;
  teamId?: number;
}) {
  const { data, error } = await serviceRoleClient
    .from("forge_player_game_strength")
    .select(
      [
        "player_id",
        "team_id",
        "opponent_team_id",
        "goals_es",
        "goals_pk",
        "goals_pp",
        "assists_es",
        "assists_pk",
        "assists_pp",
        "shots_es",
        "shots_pk",
        "shots_pp",
        "plus_minus",
        "pim",
        "hits",
        "blocks",
        "toi_es_seconds",
        "toi_pk_seconds",
        "toi_pp_seconds",
      ].join(",")
    )
    .gte("game_date", args.seasonStartDate)
    .lte("game_date", args.seasonEndDate)
    .match(args.teamId == null ? {} : { team_id: args.teamId });

  if (error) {
    throw new Error(`Unable to load skater split rows: ${error.message}`);
  }

  return ((data ?? []) as unknown) as StrengthGameRow[];
}

async function fetchTeamStrengthRowsForSeason(args: {
  seasonStartDate: string;
  seasonEndDate: string;
  teamId?: number;
}) {
  const { data, error } = await serviceRoleClient
    .from("forge_team_game_strength")
    .select("team_id, opponent_team_id, toi_pp_seconds")
    .gte("game_date", args.seasonStartDate)
    .lte("game_date", args.seasonEndDate)
    .match(args.teamId == null ? {} : { team_id: args.teamId });

  if (error) {
    throw new Error(`Unable to load team skater split rows: ${error.message}`);
  }

  return ((data ?? []) as unknown) as TeamStrengthGameRow[];
}

async function fetchGoalieRowsForGames(gameIds: number[]) {
  if (gameIds.length === 0) {
    return [] as GoalieGameRow[];
  }

  const { data, error } = await serviceRoleClient
    .from("goaliesGameStats")
    .select("playerId, gameId, goalsAgainst, saveShotsAgainst, toi")
    .in("gameId", gameIds);

  if (error) {
    throw new Error(`Unable to load goalie game rows: ${error.message}`);
  }

  return (data ?? []) as GoalieGameRow[];
}

async function fetchGameOutcomesForTeam(args: {
  teamId: number;
  gameIds: number[];
}) {
  if (args.gameIds.length === 0) {
    return new Map<number, string>();
  }

  const { data, error } = await serviceRoleClient
    .from("gameOutcomes")
    .select("gameId, outcome")
    .eq("teamId", args.teamId)
    .in("gameId", args.gameIds);

  if (error) {
    throw new Error(`Unable to load game outcomes: ${error.message}`);
  }

  const outcomeByGameId = new Map<number, string>();
  for (const row of (data ?? []) as GameOutcomeRow[]) {
    if (row.gameId != null && row.outcome) {
      outcomeByGameId.set(row.gameId, row.outcome);
    }
  }

  return outcomeByGameId;
}

function resolveEffectiveOpponentAbbreviation(args: {
  selectedTeam: TeamLookup | null;
  selectedOpponent: TeamLookup | null;
  teamOptions: readonly SplitTeamOption[];
  strengthRows: readonly StrengthGameRow[];
}) {
  if (args.selectedTeam == null) {
    return null;
  }

  if (args.selectedOpponent != null) {
    return args.selectedOpponent.abbreviation;
  }

  const availableOpponentAbbreviations = new Set(
    args.strengthRows
      .filter(
        (row) =>
          row.team_id === args.selectedTeam?.id &&
          row.opponent_team_id != null &&
          row.opponent_team_id !== args.selectedTeam?.id
      )
      .map((row) => findTeamAbbreviationById(row.opponent_team_id))
      .filter((abbreviation): abbreviation is string => abbreviation != null)
  );

  const firstAvailableAlphabetical = args.teamOptions.find(
    (team) =>
      team.abbreviation !== args.selectedTeam?.abbreviation &&
      availableOpponentAbbreviations.has(team.abbreviation)
  );

  return (
    firstAvailableAlphabetical?.abbreviation ??
    resolveDefaultOpponentAbbreviation({
      selectedTeamAbbreviation: args.selectedTeam.abbreviation,
      teamOptions: args.teamOptions,
    })
  );
}

function buildLandingSkaterLeaders(args: {
  strengthRows: readonly StrengthGameRow[];
  playerDirectory: PlayerDirectory;
}): SplitLandingSkaterLeader[] {
  const grouped = new Map<
    string,
    {
      playerId: number;
      teamId: number;
      opponentTeamId: number;
      gamesPlayed: number;
      goals: number;
      assists: number;
    }
  >();

  for (const row of args.strengthRows) {
    const player = args.playerDirectory.byPlayerId.get(row.player_id);
    if (!player || player.positionCode === "G" || row.opponent_team_id == null) {
      continue;
    }

    if (player.teamId !== row.team_id) {
      continue;
    }

    const key = `${row.player_id}:${row.opponent_team_id}`;
    const current =
      grouped.get(key) ?? {
        playerId: row.player_id,
        teamId: row.team_id,
        opponentTeamId: row.opponent_team_id,
        gamesPlayed: 0,
        goals: 0,
        assists: 0,
      };

    current.gamesPlayed += 1;
    current.goals +=
      safeNumber(row.goals_es) +
      safeNumber(row.goals_pp) +
      safeNumber(row.goals_pk);
    current.assists +=
      safeNumber(row.assists_es) +
      safeNumber(row.assists_pp) +
      safeNumber(row.assists_pk);

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((row) => {
      const player = args.playerDirectory.byPlayerId.get(row.playerId);
      const teamAbbreviation = Object.keys(teamsInfo).find(
        (abbreviation) => teamsInfo[abbreviation]?.id === row.teamId
      );
      const opponentAbbreviation = Object.keys(teamsInfo).find(
        (abbreviation) => teamsInfo[abbreviation]?.id === row.opponentTeamId
      );
      const points = row.goals + row.assists;

      if (!player || !teamAbbreviation || !opponentAbbreviation) {
        return null;
      }

      return {
        playerId: row.playerId,
        playerName: player.playerName,
        teamAbbreviation,
        opponentAbbreviation,
        positionCode: player.positionCode,
        gamesPlayed: row.gamesPlayed,
        goals: row.goals,
        assists: row.assists,
        points,
        pointsPerGame:
          row.gamesPlayed > 0 ? toRounded(points / row.gamesPlayed) : null,
      } satisfies SplitLandingSkaterLeader;
    })
    .filter((row): row is SplitLandingSkaterLeader => row != null)
    .sort((left, right) => {
      const byPpg = (right.pointsPerGame ?? -1) - (left.pointsPerGame ?? -1);
      if (byPpg !== 0) {
        return byPpg;
      }

      const byPoints = right.points - left.points;
      if (byPoints !== 0) {
        return byPoints;
      }

      return right.gamesPlayed - left.gamesPlayed;
    })
    .slice(0, 10);
}

function buildLandingGoalieLeaders(args: {
  goalieRows: readonly GoalieGameRow[];
  gamesById: Map<number, GameRow>;
  playerDirectory: PlayerDirectory;
}): SplitLandingGoalieLeader[] {
  const grouped = new Map<
    string,
    {
      playerId: number;
      opponentTeamId: number;
      gamesPlayed: number;
      shotsAgainst: number;
      goalsAgainst: number;
      saves: number;
    }
  >();

  for (const row of args.goalieRows) {
    const player = args.playerDirectory.byPlayerId.get(row.playerId);
    const game = args.gamesById.get(row.gameId);
    if (!player || player.positionCode !== "G" || !game) {
      continue;
    }

    const teamId = player.teamId;
    const teamPlayed =
      game.homeTeamId === teamId || game.awayTeamId === teamId;
    if (!teamPlayed) {
      continue;
    }

    const opponentTeamId =
      game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
    const { saves, shotsAgainst } = parseSaveShotsAgainst(row.saveShotsAgainst);
    const key = `${row.playerId}:${opponentTeamId}`;
    const current =
      grouped.get(key) ?? {
        playerId: row.playerId,
        opponentTeamId,
        gamesPlayed: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        saves: 0,
      };

    current.gamesPlayed += parseToiToSeconds(row.toi) > 0 ? 1 : 0;
    current.shotsAgainst += shotsAgainst;
    current.goalsAgainst += safeNumber(row.goalsAgainst);
    current.saves += saves;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((row) => {
      const player = args.playerDirectory.byPlayerId.get(row.playerId);
      const teamAbbreviation = Object.keys(teamsInfo).find(
        (abbreviation) => teamsInfo[abbreviation]?.id === player?.teamId
      );
      const opponentAbbreviation = Object.keys(teamsInfo).find(
        (abbreviation) => teamsInfo[abbreviation]?.id === row.opponentTeamId
      );

      if (!player || !teamAbbreviation || !opponentAbbreviation || row.gamesPlayed <= 0) {
        return null;
      }

      return {
        playerId: row.playerId,
        playerName: player.playerName,
        teamAbbreviation,
        opponentAbbreviation,
        gamesPlayed: row.gamesPlayed,
        shotsAgainst: row.shotsAgainst,
        goalsAgainst: row.goalsAgainst,
        savePct:
          row.shotsAgainst > 0 ? toRounded(row.saves / row.shotsAgainst) : null,
      } satisfies SplitLandingGoalieLeader;
    })
    .filter((row): row is SplitLandingGoalieLeader => row != null)
    .sort((left, right) => {
      const bySavePct = (right.savePct ?? -1) - (left.savePct ?? -1);
      if (bySavePct !== 0) {
        return bySavePct;
      }

      return right.shotsAgainst - left.shotsAgainst;
    })
    .slice(0, 10);
}

function buildTeamPpShotShare(args: {
  rosterPlayers: readonly PlayerDirectoryEntry[];
  strengthRows: readonly StrengthGameRow[];
  teamId: number;
}): SplitPpShotShareRow[] {
  const rosterPlayerIds = new Set(args.rosterPlayers.map((player) => player.playerId));
  const ppShotsByPlayerId = new Map<number, number>();

  for (const row of args.strengthRows) {
    if (row.team_id !== args.teamId || !rosterPlayerIds.has(row.player_id)) {
      continue;
    }

    ppShotsByPlayerId.set(
      row.player_id,
      (ppShotsByPlayerId.get(row.player_id) ?? 0) + safeNumber(row.shots_pp)
    );
  }

  const totalShots = [...ppShotsByPlayerId.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  return args.rosterPlayers
    .map((player) => {
      const shots = ppShotsByPlayerId.get(player.playerId) ?? 0;
      if (shots <= 0) {
        return null;
      }

      return {
        playerId: player.playerId,
        playerName: player.playerName,
        positionCode: player.positionCode,
        ppShotSharePct: totalShots > 0 ? toRounded(shots / totalShots) : null,
      } satisfies SplitPpShotShareRow;
    })
    .filter((row): row is SplitPpShotShareRow => row != null)
    .sort((left, right) => (right.ppShotSharePct ?? -1) - (left.ppShotSharePct ?? -1));
}

async function buildSkaterRows(args: {
  rosterPlayers: readonly PlayerDirectoryEntry[];
  opponentTeamId: number;
  strengthRows: readonly StrengthGameRow[];
  teamStrengthRows: readonly TeamStrengthGameRow[];
}): Promise<SplitSkaterRow[]> {
  const skaters = args.rosterPlayers.filter((player) => player.positionCode !== "G");
  const playerIds = new Set(skaters.map((player) => player.playerId));
  const teamPowerPlayToiSeconds = args.teamStrengthRows.reduce((sum, row) => {
    if (row.opponent_team_id !== args.opponentTeamId) {
      return sum;
    }

    return sum + safeNumber(row.toi_pp_seconds);
  }, 0);

  const rawByPlayerId = new Map<
    number,
    {
      gamesPlayed: number;
      totalToiSeconds: number;
      goals: number;
      assists: number;
      shots: number;
      ppToiSeconds: number;
      ppGoals: number;
      ppAssists: number;
      plusMinus: number;
      pim: number;
      hits: number;
      blocks: number;
    }
  >();

  for (const row of args.strengthRows) {
    if (
      row.opponent_team_id !== args.opponentTeamId ||
      !playerIds.has(row.player_id)
    ) {
      continue;
    }

    const current =
      rawByPlayerId.get(row.player_id) ?? {
        gamesPlayed: 0,
        totalToiSeconds: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        ppToiSeconds: 0,
        ppGoals: 0,
        ppAssists: 0,
        plusMinus: 0,
        pim: 0,
        hits: 0,
        blocks: 0,
      };

    current.gamesPlayed += 1;
    current.totalToiSeconds +=
      safeNumber(row.toi_es_seconds) +
      safeNumber(row.toi_pp_seconds) +
      safeNumber(row.toi_pk_seconds);
    current.goals +=
      safeNumber(row.goals_es) +
      safeNumber(row.goals_pp) +
      safeNumber(row.goals_pk);
    current.assists +=
      safeNumber(row.assists_es) +
      safeNumber(row.assists_pp) +
      safeNumber(row.assists_pk);
    current.shots +=
      safeNumber(row.shots_es) +
      safeNumber(row.shots_pp) +
      safeNumber(row.shots_pk);
    current.ppToiSeconds += safeNumber(row.toi_pp_seconds);
    current.ppGoals += safeNumber(row.goals_pp);
    current.ppAssists += safeNumber(row.assists_pp);
    current.plusMinus += safeNumber(row.plus_minus);
    current.pim += safeNumber(row.pim);
    current.hits += safeNumber(row.hits);
    current.blocks += safeNumber(row.blocks);
    rawByPlayerId.set(row.player_id, current);
  }

  return skaters
    .map((player) => {
      const raw =
        rawByPlayerId.get(player.playerId) ?? {
          gamesPlayed: 0,
          totalToiSeconds: 0,
          goals: 0,
          assists: 0,
          shots: 0,
          ppToiSeconds: 0,
          ppGoals: 0,
          ppAssists: 0,
          plusMinus: 0,
          pim: 0,
          hits: 0,
          blocks: 0,
        };

      const points = raw.goals + raw.assists;
      const powerPlayPoints = raw.ppGoals + raw.ppAssists;
      const shootingPct =
        raw.shots > 0 ? toRounded(raw.goals / raw.shots) : null;
      const averageToiSeconds =
        raw.gamesPlayed > 0 ? raw.totalToiSeconds / raw.gamesPlayed : null;
      const powerPlayToiSecondsPerGame =
        raw.gamesPlayed > 0 ? raw.ppToiSeconds / raw.gamesPlayed : null;
      const powerPlayPct =
        teamPowerPlayToiSeconds > 0 ? raw.ppToiSeconds / teamPowerPlayToiSeconds : null;

      return {
        playerId: player.playerId,
        playerName: player.playerName,
        positionCode: player.positionCode,
        gamesPlayed: raw.gamesPlayed,
        averageToiSeconds: averageToiSeconds == null ? null : Math.round(averageToiSeconds),
        goals: raw.goals,
        assists: raw.assists,
        points,
        pointsPerGame:
          raw.gamesPlayed > 0 ? toRounded(points / raw.gamesPlayed) : 0,
        shotsOnGoal: raw.shots,
        shootingPct,
        powerPlayToiSecondsPerGame:
          powerPlayToiSecondsPerGame == null
            ? null
            : Math.round(powerPlayToiSecondsPerGame),
        powerPlayPct: toRounded(powerPlayPct),
        powerPlayGoals: raw.ppGoals,
        powerPlayAssists: raw.ppAssists,
        powerPlayPoints,
        plusMinus: raw.plusMinus,
        pim: raw.pim,
        faceoffWinPct: null,
        hits: raw.hits,
        blocks: raw.blocks,
      } satisfies SplitSkaterRow;
    })
    .sort((left, right) => {
      const byPpg = (right.pointsPerGame ?? -1) - (left.pointsPerGame ?? -1);
      if (byPpg !== 0) {
        return byPpg;
      }

      const byPoints = right.points - left.points;
      if (byPoints !== 0) {
        return byPoints;
      }

      return left.playerName.localeCompare(right.playerName);
    });
}

function isQualityStart(shotsAgainst: number, saves: number) {
  if (shotsAgainst <= 0) {
    return false;
  }

  const savePct = saves / shotsAgainst;
  return savePct > 0.91 || (shotsAgainst <= 20 && savePct >= 0.885);
}

async function buildGoalieRows(args: {
  teamId: number;
  rosterPlayers: readonly PlayerDirectoryEntry[];
  opponentTeamId: number;
  games: readonly GameRow[];
}): Promise<SplitGoalieRow[]> {
  const goalies = args.rosterPlayers.filter((player) => player.positionCode === "G");
  const teamGameIds = args.games
    .filter(
      (game) =>
        ((game.homeTeamId === args.teamId &&
          game.awayTeamId === args.opponentTeamId) ||
          (game.awayTeamId === args.teamId &&
            game.homeTeamId === args.opponentTeamId))
    )
    .map((game) => game.id);

  const [goalieRows, outcomeByGameId] = await Promise.all([
    fetchGoalieRowsForGames(teamGameIds),
    fetchGameOutcomesForTeam({
      teamId: args.teamId,
      gameIds: teamGameIds,
    }),
  ]);
  const goalieIds = new Set(goalies.map((goalie) => goalie.playerId));

  const rowsByGame = new Map<number, GoalieGameRow[]>();
  for (const row of goalieRows) {
    if (!goalieIds.has(row.playerId) || parseToiToSeconds(row.toi) <= 0) {
      continue;
    }

    const existing = rowsByGame.get(row.gameId) ?? [];
    existing.push(row);
    rowsByGame.set(row.gameId, existing);
  }

  const aggregateByPlayerId = new Map<
    number,
    {
      gamesPlayed: number;
      gamesStarted: number;
      wins: number;
      losses: number;
      otl: number;
      shutouts: number;
      qualityStarts: number;
    }
  >();

  rowsByGame.forEach((rows, gameId) => {
    const sortedRows = [...rows].sort(
      (left, right) => parseToiToSeconds(right.toi) - parseToiToSeconds(left.toi)
    );
    const starter = sortedRows[0] ?? null;

    for (const row of sortedRows) {
      const current =
        aggregateByPlayerId.get(row.playerId) ?? {
          gamesPlayed: 0,
          gamesStarted: 0,
          wins: 0,
          losses: 0,
          otl: 0,
          shutouts: 0,
          qualityStarts: 0,
        };

      current.gamesPlayed += 1;

      if (starter?.playerId === row.playerId) {
        current.gamesStarted += 1;
        const { saves, shotsAgainst } = parseSaveShotsAgainst(row.saveShotsAgainst);

        if (safeNumber(row.goalsAgainst) === 0 && sortedRows.length === 1) {
          current.shutouts += 1;
        }

        if (isQualityStart(shotsAgainst, saves)) {
          current.qualityStarts += 1;
        }

        const outcome = outcomeByGameId.get(gameId);
        if (outcome === "WIN") {
          current.wins += 1;
        } else if (outcome === "LOSS") {
          current.losses += 1;
        } else if (outcome === "TIE") {
          current.otl += 1;
        }
      }

      aggregateByPlayerId.set(row.playerId, current);
    }
  });

  return goalies
    .map((goalie) => {
      const aggregate = aggregateByPlayerId.get(goalie.playerId);
      const gamesPlayed = aggregate?.gamesPlayed ?? 0;
      const gamesStarted = aggregate?.gamesStarted ?? 0;

      const rawRows = goalieRows.filter(
        (row) => row.playerId === goalie.playerId && parseToiToSeconds(row.toi) > 0
      );
      const totals = rawRows.reduce(
        (acc, row) => {
          const { saves, shotsAgainst } = parseSaveShotsAgainst(row.saveShotsAgainst);
          acc.shotsAgainst += shotsAgainst;
          acc.saves += saves;
          acc.goalsAgainst += safeNumber(row.goalsAgainst);
          acc.toiSeconds += parseToiToSeconds(row.toi);
          return acc;
        },
        {
          shotsAgainst: 0,
          saves: 0,
          goalsAgainst: 0,
          toiSeconds: 0,
        }
      );

      return {
        playerId: goalie.playerId,
        playerName: goalie.playerName,
        gamesPlayed,
        gamesStarted,
        wins: aggregate?.wins ?? 0,
        losses: aggregate?.losses ?? 0,
        otl: aggregate?.otl ?? 0,
        goalsAllowed: totals.goalsAgainst,
        shotsAgainst: totals.shotsAgainst,
        savePct:
          totals.shotsAgainst > 0 ? toRounded(totals.saves / totals.shotsAgainst) : null,
        goalsAllowedAverage:
          totals.toiSeconds > 0
            ? toRounded((totals.goalsAgainst * 3600) / totals.toiSeconds)
            : null,
        shutouts: aggregate?.shutouts ?? 0,
        qualityStarts: aggregate?.qualityStarts ?? 0,
        qualityStartsPct:
          gamesStarted > 0
            ? toRounded((aggregate?.qualityStarts ?? 0) / gamesStarted)
            : null,
      } satisfies SplitGoalieRow;
    })
    .sort((left, right) => {
      const bySavePct = (right.savePct ?? -1) - (left.savePct ?? -1);
      if (bySavePct !== 0) {
        return bySavePct;
      }

      const byShotsAgainst = right.shotsAgainst - left.shotsAgainst;
      if (byShotsAgainst !== 0) {
        return byShotsAgainst;
      }

      return left.playerName.localeCompare(right.playerName);
    });
}

export async function buildSplitsSurface(args: {
  teamAbbreviation?: string | null;
  opponentAbbreviation?: string | null;
  includeLanding?: boolean;
}): Promise<SplitsApiResponse> {
  const teamOptions = getAllTeamOptions();
  const selectedTeam = resolveTeamLookup(args.teamAbbreviation);
  const selectedOpponent = resolveTeamLookup(args.opponentAbbreviation);
  const includeLanding = args.includeLanding ?? true;

  if (args.teamAbbreviation != null && !selectedTeam) {
    throw new Error("Unknown team abbreviation.");
  }

  if (args.opponentAbbreviation != null && !selectedOpponent) {
    throw new Error("Unknown opponent abbreviation.");
  }

  if (
    selectedTeam &&
    selectedOpponent &&
    selectedTeam.abbreviation === selectedOpponent.abbreviation
  ) {
    throw new Error("Team and opponent must be different.");
  }

  const currentSeason = await fetchCurrentSeasonContext();
  const [playerDirectory, games, strengthRows, teamStrengthRows] = await Promise.all([
    fetchPlayerDirectoryForTeam({
      currentSeasonId: currentSeason.id,
      teamId: includeLanding ? undefined : selectedTeam?.id,
    }),
    fetchCurrentSeasonGames(currentSeason.id),
    fetchStrengthRowsForSeason({
      seasonStartDate: currentSeason.startDate,
      seasonEndDate: currentSeason.endDate,
      teamId: includeLanding ? undefined : selectedTeam?.id,
    }),
    fetchTeamStrengthRowsForSeason({
      seasonStartDate: currentSeason.startDate,
      seasonEndDate: currentSeason.endDate,
      teamId: includeLanding ? undefined : selectedTeam?.id,
    }),
  ]);

  const effectiveOpponentAbbreviation = resolveEffectiveOpponentAbbreviation({
    selectedTeam,
    selectedOpponent,
    teamOptions,
    strengthRows,
  });
  const effectiveOpponent =
    effectiveOpponentAbbreviation == null
      ? null
      : resolveTeamLookup(effectiveOpponentAbbreviation);

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const allGoalieRows = includeLanding
    ? await fetchGoalieRowsForGames(games.map((game) => game.id))
    : [];

  const rosterPlayers =
    selectedTeam == null
      ? []
      : playerDirectory.byTeamId.get(selectedTeam.id) ?? [];

  const roster =
    selectedTeam != null && effectiveOpponent != null
      ? {
          skaters: await buildSkaterRows({
            rosterPlayers,
            opponentTeamId: effectiveOpponent.id,
            strengthRows,
            teamStrengthRows,
          }),
          goalies: await buildGoalieRows({
            teamId: selectedTeam.id,
            rosterPlayers,
            opponentTeamId: effectiveOpponent.id,
            games,
          }),
        }
      : null;

  return {
    generatedAt: new Date().toISOString(),
    seasonId: currentSeason.id,
    teamOptions,
    selection: {
      teamAbbreviation: selectedTeam?.abbreviation ?? null,
      opponentAbbreviation: selectedOpponent?.abbreviation ?? null,
      effectiveOpponentAbbreviation,
    },
    landing: {
      topSkaters: includeLanding
        ? buildLandingSkaterLeaders({
            strengthRows,
            playerDirectory,
          })
        : [],
      topGoalies: includeLanding
        ? buildLandingGoalieLeaders({
            goalieRows: allGoalieRows,
            gamesById,
            playerDirectory,
          })
        : [],
    },
    ppShotShare:
      selectedTeam == null
        ? []
        : buildTeamPpShotShare({
            rosterPlayers,
            strengthRows,
            teamId: selectedTeam.id,
          }),
    roster,
  };
}

export function getSplitsTeamOptions() {
  return getAllTeamOptions();
}
