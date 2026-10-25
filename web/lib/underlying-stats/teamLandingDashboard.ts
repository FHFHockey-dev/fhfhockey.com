import { computeTeamPowerScore } from "../dashboard/teamContext";
import { teamsInfo } from "../teamsInfo";
import type { RatingComponents } from "../teamRatingsService";

type LandingDashboardSource = {
  components: RatingComponents;
  defRating: number;
  dangerRating?: number | null;
  disciplineRating?: number | null;
  finishingRating?: number | null;
  goalieRating?: number | null;
  luckPdoZ?: number | null;
  luckStatus?: "cold" | "hot" | "normal";
  narrative?: string[];
  offRating: number;
  paceRating: number;
  pkTier: 1 | 2 | 3;
  ppTier: 1 | 2 | 3;
  teamAbbr: string;
  trend10: number;
};

export type UnderlyingStatsLandingQuadrantPoint = {
  archetypes: string[];
  defenseProcess: number;
  offenseProcess: number;
  power: number;
  summary: string;
  teamAbbr: string;
  teamName: string;
  trend: number;
};

export type UnderlyingStatsLandingMover = {
  archetypes: string[];
  bullets: string[];
  direction: "down" | "up";
  power: number;
  teamAbbr: string;
  teamName: string;
  trend: number;
};

export type UnderlyingStatsLandingDashboard = {
  quadrant: {
    axisSubtitle: string;
    averageDefenseProcess: number;
    averageOffenseProcess: number;
    points: UnderlyingStatsLandingQuadrantPoint[];
  };
  risers: UnderlyingStatsLandingMover[];
  fallers: UnderlyingStatsLandingMover[];
};

type ProcessSignals = {
  defenseProcess: number;
  offenseProcess: number;
};

type TeamDerivedContext = {
  archetypes: string[];
  processSignals: ProcessSignals;
  trustType: "buyLow" | "heatCheck" | "processBacked" | null;
};

const MAX_MODULE_ITEMS = 4;

const average = (values: number[]): number =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const standardDeviation = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
};

const zScore = (value: number, mean: number, stdDev: number): number =>
  stdDev > 0 ? (value - mean) / stdDev : 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const titleize = (value: string): string =>
  value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getTeamName = (teamAbbr: string): string =>
  teamsInfo[teamAbbr as keyof typeof teamsInfo]?.name ?? teamAbbr;

const buildArchetypes = (
  team: LandingDashboardSource,
  power: number
): string[] => {
  const tags: string[] = [];

  if (team.paceRating >= 106) {
    tags.push("High-event");
  }

  if (team.defRating >= 104 && team.defRating >= team.offRating + 4) {
    tags.push("Defense-first");
  }

  if (team.offRating >= 104 && team.offRating >= team.defRating + 4) {
    tags.push("Attack-driven");
  }

  if ((team.dangerRating ?? 100) >= 106) {
    tags.push("Chance-driving");
  }

  if ((team.finishingRating ?? 100) >= 105) {
    tags.push("Finishing-driven");
  }

  if ((team.goalieRating ?? 100) >= 105) {
    tags.push("Goalie-carried");
  }

  if ((team.disciplineRating ?? 100) >= 105) {
    tags.push("Disciplined");
  } else if ((team.disciplineRating ?? 100) <= 95) {
    tags.push("Undisciplined");
  }

  if (team.ppTier === 1 || team.pkTier === 1) {
    tags.push("Special-teams boosted");
  }

  if (team.luckStatus === "hot") {
    tags.push("Luck-running hot");
  } else if (team.luckStatus === "cold") {
    tags.push("Luck-running cold");
  }

  if (power >= 110) {
    tags.push("Contender-grade");
  }

  return Array.from(new Set(tags)).slice(0, 3);
};

const buildQuadrantSummary = ({
  team,
  trustType
}: {
  team: LandingDashboardSource;
  trustType: TeamDerivedContext["trustType"];
}): string => {
  const pieces: string[] = [];

  if (team.offRating >= 104) {
    pieces.push("drives offense");
  }

  if (team.defRating >= 104) {
    pieces.push("suppresses well");
  }

  if (team.trend10 >= 1.5) {
    pieces.push("moving up");
  } else if (team.trend10 <= -1.5) {
    pieces.push("cooling off");
  }

  if (trustType === "heatCheck") {
    pieces.push("needs a heat check");
  } else if (trustType === "buyLow") {
    pieces.push("could rebound");
  }

  return pieces.length ? titleize(pieces.join(" • ")) : "Balanced profile";
};

const resolveTrustType = ({
  team,
  processGap,
  power
}: {
  team: LandingDashboardSource;
  processGap: number;
  power: number;
}): TeamDerivedContext["trustType"] => {
  const scoringEdge = (team.finishingRating ?? 100) - 100;
  const goalieEdge = (team.goalieRating ?? 100) - 100;
  const luckZ = team.luckPdoZ ?? 0;
  const contextInflation = scoringEdge + goalieEdge + Math.max(luckZ, 0) * 4;
  const contextDrag =
    Math.max(0, 100 - (team.finishingRating ?? 100)) +
    Math.max(0, 100 - (team.goalieRating ?? 100)) +
    Math.max(-luckZ, 0) * 4;

  if (
    power >= 103 &&
    processGap >= 0.12 &&
    (contextDrag >= 6 || team.luckStatus === "cold")
  ) {
    return "buyLow";
  }

  if (
    power >= 103 &&
    processGap <= -0.12 &&
    (contextInflation >= 7 || team.luckStatus === "hot")
  ) {
    return "heatCheck";
  }

  if (
    power >= 102 &&
    Math.abs(processGap) <= 0.12 &&
    Math.abs(luckZ) <= 0.9 &&
    Math.abs(scoringEdge) <= 4 &&
    Math.abs(goalieEdge) <= 4
  ) {
    return "processBacked";
  }

  return null;
};

const takeTop = <T,>(
  rows: T[],
  count = MAX_MODULE_ITEMS,
  sortFn?: (left: T, right: T) => number
): T[] => {
  const next = [...rows];
  if (sortFn) {
    next.sort(sortFn);
  }
  return next.slice(0, count);
};

export const buildUnderlyingStatsLandingDashboard = (
  ratings: LandingDashboardSource[]
): UnderlyingStatsLandingDashboard => {
  if (!ratings.length) {
    return {
      quadrant: {
        axisSubtitle: "Offensive process vs defensive process",
        averageDefenseProcess: 0,
        averageOffenseProcess: 0,
        points: []
      },
      risers: [],
      fallers: []
    };
  }

  const xgfValues = ratings.map((team) => team.components.xgf60);
  const sfValues = ratings.map((team) => team.components.sf60);
  const xgaValues = ratings.map((team) => team.components.xga60);
  const saValues = ratings.map((team) => team.components.sa60);

  const xgfAverage = average(xgfValues);
  const sfAverage = average(sfValues);
  const xgaAverage = average(xgaValues);
  const saAverage = average(saValues);
  const xgfStdDev = standardDeviation(xgfValues);
  const sfStdDev = standardDeviation(sfValues);
  const xgaStdDev = standardDeviation(xgaValues);
  const saStdDev = standardDeviation(saValues);

  const derivedByTeam = new Map<string, TeamDerivedContext>();

  ratings.forEach((team) => {
    const offenseProcess =
      0.7 * zScore(team.components.xgf60, xgfAverage, xgfStdDev) +
      0.3 * zScore(team.components.sf60, sfAverage, sfStdDev);
    const defenseProcess =
      -0.7 * zScore(team.components.xga60, xgaAverage, xgaStdDev) -
      0.3 * zScore(team.components.sa60, saAverage, saStdDev);
    const processGap =
      team.components.xgf60 -
      team.components.xga60 -
      (team.components.gf60 - team.components.ga60);
    const power = computeTeamPowerScore(team);

    derivedByTeam.set(team.teamAbbr, {
      archetypes: buildArchetypes(team, power),
      processSignals: {
        defenseProcess,
        offenseProcess
      },
      trustType: resolveTrustType({ power, processGap, team })
    });
  });

  const quadrantPoints = ratings.map((team) => {
    const derived = derivedByTeam.get(team.teamAbbr)!;
    const power = computeTeamPowerScore(team);

    return {
      archetypes: derived.archetypes,
      defenseProcess: Number(derived.processSignals.defenseProcess.toFixed(2)),
      offenseProcess: Number(derived.processSignals.offenseProcess.toFixed(2)),
      power: Number(power.toFixed(1)),
      summary: buildQuadrantSummary({ team, trustType: derived.trustType }),
      teamAbbr: team.teamAbbr,
      teamName: getTeamName(team.teamAbbr),
      trend: Number(team.trend10.toFixed(1))
    };
  });

  const risers = takeTop(
    ratings
      .filter((team) => team.trend10 > 0)
      .map((team) => ({
        archetypes: derivedByTeam.get(team.teamAbbr)?.archetypes ?? [],
        bullets: team.narrative?.slice(0, 2) ?? [],
        direction: "up" as const,
        power: Number(computeTeamPowerScore(team).toFixed(1)),
        teamAbbr: team.teamAbbr,
        teamName: getTeamName(team.teamAbbr),
        trend: Number(team.trend10.toFixed(1))
      })),
    MAX_MODULE_ITEMS,
    (left, right) => right.trend - left.trend
  );

  const fallers = takeTop(
    ratings
      .filter((team) => team.trend10 < 0)
      .map((team) => ({
        archetypes: derivedByTeam.get(team.teamAbbr)?.archetypes ?? [],
        bullets: team.narrative?.slice(0, 2) ?? [],
        direction: "down" as const,
        power: Number(computeTeamPowerScore(team).toFixed(1)),
        teamAbbr: team.teamAbbr,
        teamName: getTeamName(team.teamAbbr),
        trend: Number(team.trend10.toFixed(1))
      })),
    MAX_MODULE_ITEMS,
    (left, right) => left.trend - right.trend
  );

  return {
    fallers,
    quadrant: {
      axisSubtitle: "Offensive process vs defensive process",
      averageDefenseProcess: clamp(
        average(quadrantPoints.map((point) => point.defenseProcess)),
        -0.01,
        0.01
      ),
      averageOffenseProcess: clamp(
        average(quadrantPoints.map((point) => point.offenseProcess)),
        -0.01,
        0.01
      ),
      points: quadrantPoints
    },
    risers
  };
};
