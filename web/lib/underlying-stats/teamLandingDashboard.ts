import { computeTeamPowerScore } from "../dashboard/teamContext";
import { teamsInfo } from "../teamsInfo";
import type { RatingComponents } from "../teamRatingsService";
import type { UnderlyingStatsScheduleTexture } from "./teamScheduleStrength";

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
  scheduleTexture?: UnderlyingStatsScheduleTexture | null;
  sosFuture?: number | null;
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

export type UnderlyingStatsLandingTrustItem = {
  archetypes: string[];
  label: "Buy low" | "Heat check" | "Process-backed";
  note: string;
  power: number;
  teamAbbr: string;
  teamName: string;
};

export type UnderlyingStatsLandingContextItem = {
  chips: string[];
  note: string;
  power: number;
  teamAbbr: string;
  teamName: string;
};

export type UnderlyingStatsLandingInefficiencyItem = {
  archetypes: string[];
  gap: number;
  note: string;
  power: number;
  teamAbbr: string;
  teamName: string;
};

export type UnderlyingStatsLandingDashboard = {
  context: UnderlyingStatsLandingContextItem[];
  inefficiency: {
    overvalued: UnderlyingStatsLandingInefficiencyItem[];
    undervalued: UnderlyingStatsLandingInefficiencyItem[];
  };
  quadrant: {
    axisSubtitle: string;
    averageDefenseProcess: number;
    averageOffenseProcess: number;
    points: UnderlyingStatsLandingQuadrantPoint[];
  };
  risers: UnderlyingStatsLandingMover[];
  sustainability: {
    buyLow: UnderlyingStatsLandingTrustItem[];
    heatCheck: UnderlyingStatsLandingTrustItem[];
    processBacked: UnderlyingStatsLandingTrustItem[];
  };
  fallers: UnderlyingStatsLandingMover[];
};

type ProcessSignals = {
  defenseProcess: number;
  offenseProcess: number;
};

type TeamDerivedContext = {
  archetypes: string[];
  contextImpact: number;
  contextNote: string;
  processGap: number;
  processSignals: ProcessSignals;
  resultGap: number;
  trustNote: string;
  trustType: "buyLow" | "heatCheck" | "processBacked" | null;
};

const MAX_MODULE_ITEMS = 4;
const SOFT_SCHEDULE_DELTA = 0.015;
const TOUGH_SCHEDULE_DELTA = 0.015;

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

const formatSigned = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

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

const buildTrustNote = ({
  team,
  processGap,
  power
}: {
  team: LandingDashboardSource;
  processGap: number;
  power: number;
}): Pick<TeamDerivedContext, "trustNote" | "trustType"> => {
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
    return {
      trustNote:
        "Underlying play looks stronger than the recent finish and save results.",
      trustType: "buyLow"
    };
  }

  if (
    power >= 103 &&
    processGap <= -0.12 &&
    (contextInflation >= 7 || team.luckStatus === "hot")
  ) {
    return {
      trustNote:
        "Surface results are running ahead of the underlying profile right now.",
      trustType: "heatCheck"
    };
  }

  if (
    power >= 102 &&
    Math.abs(processGap) <= 0.12 &&
    Math.abs(luckZ) <= 0.9 &&
    Math.abs(scoringEdge) <= 4 &&
    Math.abs(goalieEdge) <= 4
  ) {
    return {
      trustNote:
        "Current strength looks mostly supported by process rather than finishing or save variance.",
      trustType: "processBacked"
    };
  }

  return {
    trustNote: "Context signals are mixed around the current profile.",
    trustType: null
  };
};

const buildScheduleChips = (
  texture: UnderlyingStatsScheduleTexture | null | undefined
): string[] => {
  if (!texture || texture.gamesNext14 <= 0) {
    return [];
  }

  const chips = [`${texture.gamesNext7} in 7d`];
  const restDelta =
    texture.restAdvantageGamesNext14 - texture.restDisadvantageGamesNext14;

  if (texture.backToBacksNext14 > 0) {
    chips.push(`B2B x${texture.backToBacksNext14}`);
  }

  if (texture.threeInFourNext14 > 0) {
    chips.push(`3 in 4 x${texture.threeInFourNext14}`);
  }

  if (restDelta > 0) {
    chips.push(`Rest +${restDelta}`);
  } else if (restDelta < 0) {
    chips.push(`Rest ${restDelta}`);
  }

  if (texture.roadGamesNext14 >= texture.homeGamesNext14 + 2) {
    chips.push("Road-heavy");
  } else if (texture.homeGamesNext14 >= texture.roadGamesNext14 + 2) {
    chips.push("Home-heavy");
  }

  return chips.slice(0, 3);
};

const buildContextNote = ({
  leagueAverageFutureSos,
  team
}: {
  leagueAverageFutureSos: number;
  team: LandingDashboardSource;
}): Pick<TeamDerivedContext, "contextImpact" | "contextNote"> => {
  const chips = buildScheduleChips(team.scheduleTexture);
  const futureSosDelta =
    typeof team.sosFuture === "number" ? team.sosFuture - leagueAverageFutureSos : 0;
  const restDelta = team.scheduleTexture
    ? team.scheduleTexture.restAdvantageGamesNext14 -
      team.scheduleTexture.restDisadvantageGamesNext14
    : 0;
  const homeRoadTilt = team.scheduleTexture
    ? Math.abs(team.scheduleTexture.homeGamesNext14 - team.scheduleTexture.roadGamesNext14)
    : 0;

  const impact =
    Math.abs(futureSosDelta) * 100 +
    (team.scheduleTexture?.backToBacksNext14 ?? 0) * 7 +
    (team.scheduleTexture?.threeInFourNext14 ?? 0) * 6 +
    Math.abs(restDelta) * 4 +
    homeRoadTilt * 1.5;

  if ((team.scheduleTexture?.threeInFourNext14 ?? 0) > 0) {
    return {
      contextImpact: impact,
      contextNote: `Dense stretch ahead with ${chips.join(" · ")}.`
    };
  }

  if (futureSosDelta >= TOUGH_SCHEDULE_DELTA) {
    return {
      contextImpact: impact,
      contextNote: "Upcoming schedule looks tougher than league average."
    };
  }

  if (futureSosDelta <= -SOFT_SCHEDULE_DELTA) {
    return {
      contextImpact: impact,
      contextNote: "Upcoming runway looks softer than league average."
    };
  }

  if (restDelta !== 0) {
    return {
      contextImpact: impact,
      contextNote:
        restDelta > 0
          ? "Near-term schedule includes more rest-edge games than usual."
          : "Near-term schedule includes more rest disadvantages than usual."
    };
  }

  if (homeRoadTilt >= 2) {
    return {
      contextImpact: impact,
      contextNote:
        (team.scheduleTexture?.roadGamesNext14 ?? 0) >
        (team.scheduleTexture?.homeGamesNext14 ?? 0)
          ? "Next two weeks lean heavily toward road games."
          : "Next two weeks lean heavily toward home games."
    };
  }

  return {
    contextImpact: impact,
    contextNote: chips.length ? chips.join(" · ") : "Schedule context is fairly neutral."
  };
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
      context: [],
      inefficiency: { overvalued: [], undervalued: [] },
      quadrant: {
        axisSubtitle: "Offensive process vs defensive process",
        averageDefenseProcess: 0,
        averageOffenseProcess: 0,
        points: []
      },
      risers: [],
      sustainability: {
        buyLow: [],
        heatCheck: [],
        processBacked: []
      },
      fallers: []
    };
  }

  const xgfValues = ratings.map((team) => team.components.xgf60);
  const sfValues = ratings.map((team) => team.components.sf60);
  const xgaValues = ratings.map((team) => team.components.xga60);
  const saValues = ratings.map((team) => team.components.sa60);
  const futureSosValues = ratings
    .map((team) => team.sosFuture)
    .filter((value): value is number => typeof value === "number");

  const xgfAverage = average(xgfValues);
  const sfAverage = average(sfValues);
  const xgaAverage = average(xgaValues);
  const saAverage = average(saValues);
  const xgfStdDev = standardDeviation(xgfValues);
  const sfStdDev = standardDeviation(sfValues);
  const xgaStdDev = standardDeviation(xgaValues);
  const saStdDev = standardDeviation(saValues);
  const leagueAverageFutureSos = average(futureSosValues);

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
    const resultGap = team.components.gf60 - team.components.ga60;
    const power = computeTeamPowerScore(team);
    const trust = buildTrustNote({ power, processGap, team });
    const context = buildContextNote({ leagueAverageFutureSos, team });

    derivedByTeam.set(team.teamAbbr, {
      archetypes: buildArchetypes(team, power),
      contextImpact: context.contextImpact,
      contextNote: context.contextNote,
      processGap,
      processSignals: {
        defenseProcess,
        offenseProcess
      },
      resultGap,
      trustNote: trust.trustNote,
      trustType: trust.trustType
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

  const processBacked = takeTop(
    ratings
      .filter(
        (team) => derivedByTeam.get(team.teamAbbr)?.trustType === "processBacked"
      )
      .map((team) => ({
        archetypes: derivedByTeam.get(team.teamAbbr)?.archetypes ?? [],
        label: "Process-backed" as const,
        note: derivedByTeam.get(team.teamAbbr)?.trustNote ?? "",
        power: Number(computeTeamPowerScore(team).toFixed(1)),
        teamAbbr: team.teamAbbr,
        teamName: getTeamName(team.teamAbbr)
      })),
    MAX_MODULE_ITEMS,
    (left, right) => right.power - left.power
  );

  const heatCheck = takeTop(
    ratings
      .filter((team) => derivedByTeam.get(team.teamAbbr)?.trustType === "heatCheck")
      .map((team) => ({
        archetypes: derivedByTeam.get(team.teamAbbr)?.archetypes ?? [],
        label: "Heat check" as const,
        note: derivedByTeam.get(team.teamAbbr)?.trustNote ?? "",
        power: Number(computeTeamPowerScore(team).toFixed(1)),
        teamAbbr: team.teamAbbr,
        teamName: getTeamName(team.teamAbbr)
      })),
    MAX_MODULE_ITEMS,
    (left, right) => right.power - left.power
  );

  const buyLow = takeTop(
    ratings
      .filter((team) => derivedByTeam.get(team.teamAbbr)?.trustType === "buyLow")
      .map((team) => ({
        archetypes: derivedByTeam.get(team.teamAbbr)?.archetypes ?? [],
        label: "Buy low" as const,
        note: derivedByTeam.get(team.teamAbbr)?.trustNote ?? "",
        power: Number(computeTeamPowerScore(team).toFixed(1)),
        teamAbbr: team.teamAbbr,
        teamName: getTeamName(team.teamAbbr)
      })),
    MAX_MODULE_ITEMS,
    (left, right) => right.power - left.power
  );

  const context = takeTop(
    ratings.map((team) => ({
      chips: buildScheduleChips(team.scheduleTexture),
      note: derivedByTeam.get(team.teamAbbr)?.contextNote ?? "",
      power: Number(computeTeamPowerScore(team).toFixed(1)),
      teamAbbr: team.teamAbbr,
      teamName: getTeamName(team.teamAbbr)
    })),
    MAX_MODULE_ITEMS,
    (left, right) =>
      (derivedByTeam.get(right.teamAbbr)?.contextImpact ?? 0) -
      (derivedByTeam.get(left.teamAbbr)?.contextImpact ?? 0)
  );

  const undervalued = takeTop(
    ratings
      .filter((team) => (derivedByTeam.get(team.teamAbbr)?.processGap ?? 0) > 0)
      .map((team) => {
        const derived = derivedByTeam.get(team.teamAbbr)!;
        return {
          archetypes: derived.archetypes,
          gap: Number(derived.processGap.toFixed(2)),
          note: `Underlying margin is ${formatSigned(derived.processGap)} better than actual goal margin.`,
          power: Number(computeTeamPowerScore(team).toFixed(1)),
          teamAbbr: team.teamAbbr,
          teamName: getTeamName(team.teamAbbr)
        };
      }),
    MAX_MODULE_ITEMS,
    (left, right) => right.gap - left.gap
  );

  const overvalued = takeTop(
    ratings
      .filter((team) => (derivedByTeam.get(team.teamAbbr)?.processGap ?? 0) < 0)
      .map((team) => {
        const derived = derivedByTeam.get(team.teamAbbr)!;
        return {
          archetypes: derived.archetypes,
          gap: Number(Math.abs(derived.processGap).toFixed(2)),
          note: `Actual goal margin is ${formatSigned(Math.abs(derived.processGap))} ahead of the underlying process margin.`,
          power: Number(computeTeamPowerScore(team).toFixed(1)),
          teamAbbr: team.teamAbbr,
          teamName: getTeamName(team.teamAbbr)
        };
      }),
    MAX_MODULE_ITEMS,
    (left, right) => right.gap - left.gap
  );

  return {
    context,
    fallers,
    inefficiency: {
      overvalued,
      undervalued
    },
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
    risers,
    sustainability: {
      buyLow,
      heatCheck,
      processBacked
    }
  };
};
