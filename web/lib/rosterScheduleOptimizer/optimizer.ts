import { CANONICAL_POSITION_ORDER, normalizeEligibility } from "./eligibility";
import { assignPlayersToActiveSlots } from "./matching";
import { expandActiveSlots } from "./slots";
import type {
  CandidateDustEvaluation,
  CandidateWeeklyDust,
  DailyAssignment,
  OptimizerDiagnostic,
  OptimizerPlayer,
  PlayerBenchGames,
  PositionCongestion,
  PrepareScheduleOptions,
  PreparedSchedule,
  PreparedScheduleGame,
  RosterEvaluation,
  RosterEvaluationInput,
  TeamScheduleGame,
  WeeklyBenchGames,
} from "./types";
import { isIsoDate, mapDateToYahooWeek } from "./weeks";

const PLAYABLE_STATUSES = new Set(["scheduled", "live", "final"]);

function normalizeTeam(value: string): string {
  return value.trim().toUpperCase();
}

function diagnosticKey(diagnostic: OptimizerDiagnostic): string {
  return [
    diagnostic.code,
    diagnostic.playerId ?? "",
    diagnostic.date ?? "",
    diagnostic.teamAbbreviation ?? "",
    diagnostic.position ?? "",
    diagnostic.message,
  ].join("|");
}

function uniqueDiagnostics(
  diagnostics: readonly OptimizerDiagnostic[],
): OptimizerDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function prepareTeamSchedule(
  games: readonly TeamScheduleGame[],
  options: PrepareScheduleOptions = {},
): PreparedSchedule {
  const diagnostics: OptimizerDiagnostic[] = [];
  const knownTeams = new Set(
    (options.knownTeamAbbreviations ?? []).map(normalizeTeam).filter(Boolean),
  );
  const selectedWeeks = options.selectedWeeks
    ? new Set(options.selectedWeeks)
    : null;
  const byUniqueTeamDate = new Map<string, PreparedScheduleGame>();

  if (games.length === 0) {
    diagnostics.push({
      code: "EMPTY_SCHEDULE",
      severity: "warning",
      message: "The optimizer schedule contains no team-games.",
    });
  }

  for (const game of games) {
    const teamAbbreviation = normalizeTeam(game.teamAbbreviation);
    if (teamAbbreviation) knownTeams.add(teamAbbreviation);
    if (!isIsoDate(game.date)) {
      diagnostics.push({
        code: "INVALID_DATE",
        severity: "error",
        date: game.date,
        teamAbbreviation: teamAbbreviation || undefined,
        message: `Schedule date ${game.date} is not a valid YYYY-MM-DD date.`,
      });
      continue;
    }
    if (!teamAbbreviation) {
      diagnostics.push({
        code: "UNKNOWN_TEAM",
        severity: "error",
        date: game.date,
        message: "A schedule row has no team abbreviation.",
      });
      continue;
    }
    if (!PLAYABLE_STATUSES.has(game.status ?? "scheduled")) continue;

    let yahooWeek = game.yahooWeek ?? null;
    if (options.matchupWeeks) {
      const mapping = mapDateToYahooWeek(game.date, options.matchupWeeks, options.gameKey);
      if (mapping.status === "mapped") {
        yahooWeek = mapping.week.week;
      } else {
        diagnostics.push({
          code:
            mapping.reason === "overlapping_weeks"
              ? "OVERLAPPING_MATCHUP_WEEKS"
              : mapping.reason === "invalid_date"
                ? "INVALID_DATE"
                : "UNMAPPED_DATE",
          severity: "error",
          date: game.date,
          teamAbbreviation,
          message:
            mapping.reason === "overlapping_weeks"
              ? `Schedule date ${game.date} maps to multiple Yahoo matchup weeks.`
              : `Schedule date ${game.date} does not map to a Yahoo matchup week.`,
        });
        continue;
      }
    }
    if (selectedWeeks && (yahooWeek === null || !selectedWeeks.has(yahooWeek))) {
      if (yahooWeek === null) {
        diagnostics.push({
          code: "UNMAPPED_DATE",
          severity: "error",
          date: game.date,
          teamAbbreviation,
          message: `Schedule date ${game.date} has no Yahoo week and was excluded from the selected-week scope.`,
        });
      }
      continue;
    }

    const key = `${teamAbbreviation}|${game.date}`;
    if (byUniqueTeamDate.has(key)) {
      diagnostics.push({
        code: "DUPLICATE_TEAM_DATE",
        severity: "warning",
        date: game.date,
        teamAbbreviation,
        message: `Duplicate ${teamAbbreviation} team-game on ${game.date} was ignored.`,
      });
      continue;
    }
    byUniqueTeamDate.set(key, {
      gameId: game.gameId,
      date: game.date,
      teamAbbreviation,
      yahooWeek,
    });
  }

  const gamesByTeamMutable = new Map<string, PreparedScheduleGame[]>();
  const gamesByDateMutable = new Map<string, PreparedScheduleGame[]>();
  for (const game of [...byUniqueTeamDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.teamAbbreviation.localeCompare(right.teamAbbreviation),
  )) {
    const teamGames = gamesByTeamMutable.get(game.teamAbbreviation) ?? [];
    teamGames.push(game);
    gamesByTeamMutable.set(game.teamAbbreviation, teamGames);
    const dateGames = gamesByDateMutable.get(game.date) ?? [];
    dateGames.push(game);
    gamesByDateMutable.set(game.date, dateGames);
  }

  return {
    gamesByTeam: gamesByTeamMutable,
    gamesByDate: gamesByDateMutable,
    knownTeams,
    selectedWeeks,
    diagnostics,
  };
}

function includedRosterPlayers(roster: readonly OptimizerPlayer[]): OptimizerPlayer[] {
  return roster
    .filter((player) => (player.status ?? "active") === "active" || player.status === "bench")
    .sort((left, right) => left.id.localeCompare(right.id));
}

function rosterPlayersOnDate(
  roster: readonly OptimizerPlayer[],
  schedule: PreparedSchedule,
  date: string,
): OptimizerPlayer[] {
  return roster.filter((player) => {
    if (!player.teamAbbreviation) return false;
    const team = normalizeTeam(player.teamAbbreviation);
    return (schedule.gamesByTeam.get(team) ?? []).some((game) => game.date === date);
  });
}

function aggregateDaily(
  daily: readonly DailyAssignment[],
  roster: readonly OptimizerPlayer[],
  activeSlotCount: number,
  horizonDateCount: number,
  diagnostics: readonly OptimizerDiagnostic[],
): RosterEvaluation {
  const totalScheduledGames = daily.reduce((sum, date) => sum + date.scheduledGames, 0);
  const totalStartableGames = daily.reduce((sum, date) => sum + date.startableGames, 0);
  const totalBenchGames = daily.reduce((sum, date) => sum + date.benchGames, 0);
  const totalUnresolvedGames = daily.reduce((sum, date) => sum + date.unresolvedGames, 0);

  const weeklyMap = new Map<number | null, WeeklyBenchGames>();
  const playerMap = new Map<string, PlayerBenchGames>();
  const playerById = new Map(roster.map((player) => [player.id, player]));
  const positionMap = new Map<string, PositionCongestion>();
  for (const date of daily) {
    const weekly = weeklyMap.get(date.yahooWeek) ?? {
      week: date.yahooWeek,
      scheduledGames: 0,
      startableGames: 0,
      benchGames: 0,
      unresolvedGames: 0,
    };
    weekly.scheduledGames += date.scheduledGames;
    weekly.startableGames += date.startableGames;
    weekly.benchGames += date.benchGames;
    weekly.unresolvedGames += date.unresolvedGames;
    weeklyMap.set(date.yahooWeek, weekly);

    const started = new Set(date.assignments.map((assignment) => assignment.playerId));
    const benched = new Set(date.benchedPlayerIds);
    const unresolved = new Set(date.unresolvedPlayers.map((player) => player.playerId));
    for (const playerId of date.scheduledPlayerIds) {
      const player = playerById.get(playerId);
      if (!player) continue;
      const summary = playerMap.get(playerId) ?? {
        playerId,
        playerName: player.name,
        scheduledGames: 0,
        startableGames: 0,
        benchGames: 0,
        unresolvedGames: 0,
      };
      summary.scheduledGames += 1;
      if (started.has(playerId)) summary.startableGames += 1;
      if (benched.has(playerId)) summary.benchGames += 1;
      if (unresolved.has(playerId)) summary.unresolvedGames += 1;
      playerMap.set(playerId, summary);

      const eligibility = normalizeEligibility(player.eligiblePositions);
      if (!eligibility.valid) continue;
      for (const position of eligibility.positions) {
        const positionSummary = positionMap.get(position) ?? {
          position,
          scheduledGames: 0,
          benchGames: 0,
        };
        positionSummary.scheduledGames += 1;
        if (benched.has(playerId)) positionSummary.benchGames += 1;
        positionMap.set(position, positionSummary);
      }
    }
  }

  const weekly = [...weeklyMap.values()].sort((left, right) => {
    if (left.week === null) return 1;
    if (right.week === null) return -1;
    return left.week - right.week;
  });
  const players = [...playerMap.values()].sort(
    (left, right) =>
      right.benchGames - left.benchGames || left.playerId.localeCompare(right.playerId),
  );
  const positions = CANONICAL_POSITION_ORDER.flatMap((position) => {
    const summary = positionMap.get(position);
    return summary ? [summary as PositionCongestion] : [];
  });
  const complete = !diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return {
    totalScheduledGames,
    totalStartableGames,
    totalBenchGames,
    totalUnresolvedGames,
    dustRate: totalScheduledGames === 0 ? 0 : totalBenchGames / totalScheduledGames,
    activeSlotUtilization:
      activeSlotCount === 0 || horizonDateCount === 0
        ? 0
        : totalStartableGames / (activeSlotCount * horizonDateCount),
    daily,
    weekly,
    players,
    positions,
    highestConflictDates: [...daily]
      .filter((date) => date.benchGames > 0)
      .sort((left, right) => right.benchGames - left.benchGames || left.date.localeCompare(right.date)),
    diagnostics: uniqueDiagnostics(diagnostics),
    complete,
  };
}

export function evaluateRosterSchedule(input: RosterEvaluationInput): RosterEvaluation {
  const roster = includedRosterPlayers(input.roster);
  const slotExpansion = expandActiveSlots(input.rosterSlots);
  const diagnostics: OptimizerDiagnostic[] = [
    ...input.schedule.diagnostics,
    ...slotExpansion.diagnostics,
  ];
  if ((input.lineupMode ?? "daily") === "weekly") {
    diagnostics.push({
      code: "WEEKLY_LINEUP_UNSUPPORTED",
      severity: "error",
      message: "Exact optimization currently supports daily lineup changes only.",
    });
  }
  if (roster.length > slotExpansion.activeSlots.length + slotExpansion.benchCapacity) {
    diagnostics.push({
      code: "ROSTER_OVER_CAPACITY",
      severity: "error",
      message: `The ${roster.length}-player optimization pool exceeds ${slotExpansion.activeSlots.length + slotExpansion.benchCapacity} active-plus-bench roster spots.`,
    });
  }

  const candidateDates = new Set<string>();
  for (const player of roster) {
    if (!player.teamAbbreviation) {
      diagnostics.push({
        code: "MISSING_TEAM",
        severity: "error",
        playerId: player.id,
        playerName: player.name,
        message: `Player ${player.name ?? player.id} has no current NHL team.`,
      });
      continue;
    }
    const team = normalizeTeam(player.teamAbbreviation);
    if (!input.schedule.knownTeams.has(team)) {
      diagnostics.push({
        code: "UNKNOWN_TEAM",
        severity: "error",
        playerId: player.id,
        playerName: player.name,
        teamAbbreviation: team,
        message: `Player ${player.name ?? player.id} has unknown team ${team}.`,
      });
      continue;
    }
    for (const game of input.schedule.gamesByTeam.get(team) ?? []) {
      candidateDates.add(game.date);
    }
  }

  const daily = [...candidateDates]
    .sort()
    .map((date) => {
      const players = rosterPlayersOnDate(roster, input.schedule, date);
      const yahooWeek = input.schedule.gamesByDate.get(date)?.[0]?.yahooWeek ?? null;
      const result = assignPlayersToActiveSlots(players, slotExpansion.activeSlots, date, yahooWeek);
      diagnostics.push(...result.diagnostics);
      return result.assignment;
    });

  return aggregateDaily(
    daily,
    roster,
    slotExpansion.activeSlots.length,
    input.schedule.gamesByDate.size,
    diagnostics,
  );
}

export function calculateCandidateDust(
  input: RosterEvaluationInput,
  candidate: OptimizerPlayer,
  baseline = evaluateRosterSchedule(input),
): CandidateDustEvaluation {
  const roster = includedRosterPlayers(input.roster);
  const slotExpansion = expandActiveSlots(input.rosterSlots);
  const diagnostics: OptimizerDiagnostic[] = [];
  const team = candidate.teamAbbreviation
    ? normalizeTeam(candidate.teamAbbreviation)
    : null;
  if (!team) {
    diagnostics.push({
      code: "MISSING_TEAM",
      severity: "error",
      playerId: candidate.id,
      playerName: candidate.name,
      message: `Candidate ${candidate.name ?? candidate.id} has no current NHL team.`,
    });
  } else if (!input.schedule.knownTeams.has(team)) {
    diagnostics.push({
      code: "UNKNOWN_TEAM",
      severity: "error",
      playerId: candidate.id,
      playerName: candidate.name,
      teamAbbreviation: team,
      message: `Candidate ${candidate.name ?? candidate.id} has unknown team ${team}.`,
    });
  }

  const baselineByDate = new Map(baseline.daily.map((date) => [date.date, date]));
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const affectedDates = team ? input.schedule.gamesByTeam.get(team) ?? [] : [];
  const weekMap = new Map<number | null, CandidateWeeklyDust>();
  const changedDates: DailyAssignment[] = [];
  let marginalDustGames = 0;
  let candidateStartableGames = 0;
  let candidateAttributedBenchGames = 0;
  let displacedRosterBenchGames = 0;

  for (const game of affectedDates) {
    const baselineDate = baselineByDate.get(game.date);
    const baselinePlayers = (baselineDate?.scheduledPlayerIds ?? []).flatMap(
      (playerId) => {
        const player = rosterById.get(playerId);
        return player ? [player] : [];
      },
    );
    const before =
      baselineDate ??
      assignPlayersToActiveSlots(
        baselinePlayers,
        slotExpansion.activeSlots,
        game.date,
        game.yahooWeek,
      ).assignment;
    const result = assignPlayersToActiveSlots(
      [...baselinePlayers, candidate],
      slotExpansion.activeSlots,
      game.date,
      game.yahooWeek,
    );
    diagnostics.push(...result.diagnostics);
    const after = result.assignment;
    const dustDelta = after.benchGames - before.benchGames;
    const afterStarted = new Set(after.assignments.map((assignment) => assignment.playerId));
    const beforeStarted = new Set(before.assignments.map((assignment) => assignment.playerId));
    const candidateStarted = afterStarted.has(candidate.id);
    const candidateBenched = after.benchedPlayerIds.includes(candidate.id);
    const displaced = [...beforeStarted].filter(
      (playerId) => playerId !== candidate.id && !afterStarted.has(playerId),
    ).length;

    marginalDustGames += dustDelta;
    if (candidateStarted) candidateStartableGames += 1;
    if (candidateBenched) candidateAttributedBenchGames += 1;
    displacedRosterBenchGames += displaced;
    if (dustDelta > 0) changedDates.push(after);

    const weekly = weekMap.get(game.yahooWeek) ?? {
      week: game.yahooWeek,
      candidateScheduledGames: 0,
      candidateStartableGames: 0,
      candidateAttributedBenchGames: 0,
      displacedRosterBenchGames: 0,
      marginalDustGames: 0,
    };
    weekly.candidateScheduledGames += 1;
    weekly.candidateStartableGames += candidateStarted ? 1 : 0;
    weekly.candidateAttributedBenchGames += candidateBenched ? 1 : 0;
    weekly.displacedRosterBenchGames += displaced;
    weekly.marginalDustGames += dustDelta;
    weekMap.set(game.yahooWeek, weekly);
  }

  const candidateScheduledGames = affectedDates.length;
  return {
    player: candidate,
    marginalDustGames,
    candidateScheduledGames,
    activeGamesAdded: candidateScheduledGames - marginalDustGames,
    candidateStartableGames,
    candidateAttributedBenchGames,
    displacedRosterBenchGames,
    dustRate:
      candidateScheduledGames === 0 ? 0 : marginalDustGames / candidateScheduledGames,
    weekByWeek: [...weekMap.values()].sort((left, right) => {
      if (left.week === null) return 1;
      if (right.week === null) return -1;
      return left.week - right.week;
    }),
    highestConflictDates: changedDates.sort(
      (left, right) => right.benchGames - left.benchGames || left.date.localeCompare(right.date),
    ),
    diagnostics: uniqueDiagnostics(diagnostics),
  };
}
