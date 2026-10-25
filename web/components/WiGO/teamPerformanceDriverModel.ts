export const TEAM_DRIVER_MIN_LEAGUE_SAMPLE = 24;
// TJ 2026-10-25: a team with at least 90% of its games before the cutoff is shown with an
// "N of M games" label; below that it stays incomplete. Rates use only the covered games.
export const TEAM_DRIVER_MIN_COVERAGE = 0.9;

export interface TeamDriverCoverage {
  coveredGames: number;
  expectedGames: number;
}

export interface TeamFiveOnFiveSnapshot {
  team_abbreviation: string;
  date: string;
  gp: number | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  coveredGames?: number;
  expectedGames?: number;
}

const meetsCoverage = (coveredGames: number, expectedGames: number) =>
  expectedGames > 0 && coveredGames / expectedGames >= TEAM_DRIVER_MIN_COVERAGE;

export function aggregateTeamFiveOnFive(
  rows: TeamFiveOnFiveSnapshot[],
  expectedDates: Map<string, Map<string, number>>
): TeamFiveOnFiveSnapshot[] {
  const teams = new Map<string, Map<string, TeamFiveOnFiveSnapshot>>();
  for (const row of rows) {
    if (!expectedDates.get(row.team_abbreviation)?.has(row.date)) continue;
    const dates = teams.get(row.team_abbreviation) ?? new Map<string, TeamFiveOnFiveSnapshot>();
    const prior = dates.get(row.date);
    if (prior && (["gp", "xgf", "xga", "gf"] as const).some(key => prior[key] !== row[key])) {
      throw new Error("Conflicting team five-on-five rows");
    }
    dates.set(row.date, row);
    teams.set(row.team_abbreviation, dates);
  }
  return [...teams.entries()].flatMap(([team_abbreviation, dates]) => {
    const expected = expectedDates.get(team_abbreviation)!;
    // Rows whose games or metrics don't check out count as missing, never as zeros.
    const games = [...dates.values()].filter(row =>
      row.gp === expected.get(row.date) &&
      [row.xgf, row.xga, row.gf].every(value => value != null && Number.isFinite(value) && value >= 0)
    );
    const expectedGames = [...expected.values()].reduce((sum, count) => sum + count, 0);
    const coveredGames = games.reduce((sum, row) => sum + row.gp!, 0);
    if (!meetsCoverage(coveredGames, expectedGames)) return [];
    return [{
      team_abbreviation,
      date: games.reduce((last, row) => row.date > last ? row.date : last, ""),
      gp: coveredGames,
      xgf: games.reduce((sum, row) => sum + row.xgf!, 0),
      xga: games.reduce((sum, row) => sum + row.xga!, 0),
      gf: games.reduce((sum, row) => sum + row.gf!, 0),
      coveredGames,
      expectedGames
    }];
  });
}

export interface TeamSpecialTeamsSnapshot {
  team_id: number | null;
  date: string;
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
  coveredGames?: number;
  expectedGames?: number;
}

export interface TeamSpecialTeamsGame {
  team_id: number;
  game_id: number;
  date: string;
  pp_opportunities: number | null;
  power_play_goals_for: number | null;
  times_shorthanded: number | null;
  pp_goals_against: number | null;
}

// Percentages at this boundary are percentage points, never fractions. expectedGames maps each
// team to its regular-season games before the cutoff; without it, the rows supplied are the expectation.
export function aggregateTeamSpecialTeams(
  rows: TeamSpecialTeamsGame[],
  expectedGames?: Map<number, number>
): TeamSpecialTeamsSnapshot[] {
  const teams = new Map<number, Map<number, TeamSpecialTeamsGame>>();
  for (const row of rows) {
    const games = teams.get(row.team_id) ?? new Map<number, TeamSpecialTeamsGame>();
    const prior = games.get(row.game_id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error("Conflicting team game rows");
    games.set(row.game_id, row);
    teams.set(row.team_id, games);
  }
  return [...teams.entries()].flatMap(([team_id, games]) => {
    // A major can yield several PP goals from one opportunity, so goals may exceed opportunities in a game.
    // Rows with unusable counts are treated as missing games, never as zeros.
    const values = [...games.values()].filter(row =>
      [row.pp_opportunities, row.power_play_goals_for, row.times_shorthanded, row.pp_goals_against]
        .every(value => value != null && Number.isInteger(value) && value >= 0)
    );
    const expected = expectedGames?.get(team_id) ?? games.size;
    if (!meetsCoverage(values.length, expected)) return [];
    const ppOpp = values.reduce((sum, row) => sum + row.pp_opportunities!, 0);
    const pkOpp = values.reduce((sum, row) => sum + row.times_shorthanded!, 0);
    return [{
      team_id,
      date: values.reduce((latest, row) => row.date > latest ? row.date : latest, ""),
      power_play_pct: ppOpp > 0 ? 100 * values.reduce((sum, row) => sum + row.power_play_goals_for!, 0) / ppOpp : null,
      penalty_kill_pct: pkOpp > 0 ? 100 * (1 - values.reduce((sum, row) => sum + row.pp_goals_against!, 0) / pkOpp) : null,
      coveredGames: values.length,
      expectedGames: expected
    }];
  });
}

export type TeamDriverStatus = "strength" | "neutral" | "concern";

export const formatPercentileOrdinal = (value: number): string => {
  const rounded = Math.round(value);
  const mod100 = rounded % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : rounded % 10 === 1
        ? "st"
        : rounded % 10 === 2
          ? "nd"
          : rounded % 10 === 3
            ? "rd"
            : "th";
  return `${rounded}${suffix}`;
};

export interface TeamPerformanceDriver {
  key: "generation" | "suppression" | "finishing" | "specialTeams";
  label: string;
  valueLabel: string;
  percentile: number;
  status: TeamDriverStatus;
  explanation: string;
}

export interface TeamPerformanceDriverResult {
  drivers: TeamPerformanceDriver[];
  // Present only when the selected team's rows cover fewer games than were played before the cutoff.
  fiveOnFiveCoverage: TeamDriverCoverage | null;
  specialTeamsCoverage: TeamDriverCoverage | null;
  fiveOnFiveDate: string;
  fiveOnFiveOldestDate: string;
  specialTeamsDate: string;
  specialTeamsOldestDate: string;
  leagueSample: number;
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const percentile = (
  value: number,
  population: number[],
  direction: "higher" | "lower",
) => {
  if (population.length === 0) return 0;
  const below = population.filter((candidate) => candidate < value).length;
  const equal = population.filter((candidate) => candidate === value).length;
  const raw = ((below + equal * 0.5) / population.length) * 100;
  return direction === "higher" ? raw : 100 - raw;
};

const statusForPercentile = (value: number): TeamDriverStatus => {
  if (value >= 67) return "strength";
  if (value <= 33) return "concern";
  return "neutral";
};

const metricPerGame = (row: TeamFiveOnFiveSnapshot, key: "xgf" | "xga") =>
  finite(row[key]) && row[key] >= 0 && finite(row.gp) && row.gp > 0 ? row[key] / row.gp : null;

const finishingRate = (row: TeamFiveOnFiveSnapshot) =>
  finite(row.gf) && row.gf >= 0 && finite(row.xgf) && row.xgf > 0 ? row.gf / row.xgf : null;

export const buildTeamPerformanceDrivers = ({
  teamAbbreviation,
  teamId,
  fiveOnFiveRows,
  specialTeamsRows,
}: {
  teamAbbreviation: string;
  teamId: number;
  fiveOnFiveRows: TeamFiveOnFiveSnapshot[];
  specialTeamsRows: TeamSpecialTeamsSnapshot[];
}): TeamPerformanceDriverResult | null => {
  const uniqueFiveOnFive = fiveOnFiveRows.reduce((map, row) => {
    const current = map.get(row.team_abbreviation);
    if (!current || row.date > current.date) {
      map.set(row.team_abbreviation, row);
    }
    return map;
  }, new Map<string, TeamFiveOnFiveSnapshot>());
  const uniqueSpecialTeams = specialTeamsRows.reduce((map, row) => {
    const teamKey = row.team_id;
    if (
      !finite(teamKey) ||
      !finite(row.power_play_pct) ||
      !finite(row.penalty_kill_pct)
    ) {
      return map;
    }
    const current = map.get(teamKey);
    if (!current || row.date > current.date) {
      map.set(teamKey, { ...row, team_id: teamKey });
    }
    return map;
  }, new Map<number, TeamSpecialTeamsSnapshot & { team_id: number }>());
  const teamFiveOnFive = uniqueFiveOnFive.get(teamAbbreviation);
  const teamSpecialTeams = uniqueSpecialTeams.get(teamId);

  if (
    !teamFiveOnFive ||
    !teamSpecialTeams ||
    uniqueFiveOnFive.size < TEAM_DRIVER_MIN_LEAGUE_SAMPLE ||
    uniqueSpecialTeams.size < TEAM_DRIVER_MIN_LEAGUE_SAMPLE
  ) {
    return null;
  }

  const generationPopulation = Array.from(uniqueFiveOnFive.values())
    .map((row) => metricPerGame(row, "xgf"))
    .filter(finite);
  const suppressionPopulation = Array.from(uniqueFiveOnFive.values())
    .map((row) => metricPerGame(row, "xga"))
    .filter(finite);
  const finishingPopulation = Array.from(uniqueFiveOnFive.values())
    .map(finishingRate)
    .filter(finite);
  const ppPopulation = Array.from(uniqueSpecialTeams.values())
    .map((row) => row.power_play_pct)
    .filter(finite);
  const pkPopulation = Array.from(uniqueSpecialTeams.values())
    .map((row) => row.penalty_kill_pct)
    .filter(finite);
  if ([generationPopulation, suppressionPopulation, finishingPopulation, ppPopulation, pkPopulation]
    .some(population => population.length < TEAM_DRIVER_MIN_LEAGUE_SAMPLE)) {
    return null;
  }
  const generation = metricPerGame(teamFiveOnFive, "xgf");
  const suppression = metricPerGame(teamFiveOnFive, "xga");
  const finishing = finishingRate(teamFiveOnFive);
  const pp = teamSpecialTeams.power_play_pct;
  const pk = teamSpecialTeams.penalty_kill_pct;

  if (
    !finite(generation) ||
    !finite(suppression) ||
    !finite(finishing) ||
    !finite(pp) ||
    !finite(pk)
  ) {
    return null;
  }

  const generationPercentile = percentile(
    generation,
    generationPopulation,
    "higher",
  );
  const suppressionPercentile = percentile(
    suppression,
    suppressionPopulation,
    "lower",
  );
  const finishingPercentile = percentile(
    finishing,
    finishingPopulation,
    "higher",
  );
  const specialTeamsPercentile =
    (percentile(pp, ppPopulation, "higher") +
      percentile(pk, pkPopulation, "higher")) /
    2;
  const formatPercentage = (value: number) =>
    `${value.toFixed(1)}%`;

  const driver = (
    key: TeamPerformanceDriver["key"],
    label: string,
    valueLabel: string,
    driverPercentile: number,
    explanation: string,
  ): TeamPerformanceDriver => ({
    key,
    label,
    valueLabel,
    percentile: Math.round(driverPercentile),
    status: statusForPercentile(driverPercentile),
    explanation,
  });

  const partialCoverage = (row: { coveredGames?: number; expectedGames?: number }) =>
    row.coveredGames != null && row.expectedGames != null && row.coveredGames < row.expectedGames
      ? { coveredGames: row.coveredGames, expectedGames: row.expectedGames }
      : null;

  return {
    fiveOnFiveCoverage: partialCoverage(teamFiveOnFive),
    specialTeamsCoverage: partialCoverage(teamSpecialTeams),
    fiveOnFiveDate: teamFiveOnFive.date,
    fiveOnFiveOldestDate: Array.from(uniqueFiveOnFive.values()).reduce(
      (oldest, row) => (row.date < oldest ? row.date : oldest),
      teamFiveOnFive.date,
    ),
    specialTeamsDate: teamSpecialTeams.date,
    specialTeamsOldestDate: Array.from(uniqueSpecialTeams.values()).reduce(
      (oldest, row) => (row.date < oldest ? row.date : oldest),
      teamSpecialTeams.date,
    ),
    leagueSample: Math.min(uniqueFiveOnFive.size, uniqueSpecialTeams.size),
    drivers: [
      driver(
        "generation",
        "Chance Generation",
        `${generation.toFixed(2)} xGF/GP`,
        generationPercentile,
        "Expected-goal creation per game at five-on-five; higher is better.",
      ),
      driver(
        "suppression",
        "Chance Suppression",
        `${suppression.toFixed(2)} xGA/GP`,
        suppressionPercentile,
        "Expected goals allowed per game at five-on-five; lower is better.",
      ),
      driver(
        "finishing",
        "Finishing",
        `${(finishing * 100).toFixed(1)}% GF/xGF`,
        finishingPercentile,
        "Actual goals divided by expected goals; use as over/under-performance context, not a permanent talent claim.",
      ),
      driver(
        "specialTeams",
        "Special Teams",
        `PP ${formatPercentage(pp)} · PK ${formatPercentage(pk)}`,
        specialTeamsPercentile,
        "Combined league-relative power-play and penalty-kill percentile.",
      ),
    ],
  };
};
