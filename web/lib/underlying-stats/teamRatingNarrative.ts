import { computeTeamPowerScore } from "../dashboard/teamContext";
import type { TeamRating } from "../teamRatingsService";
import type { UnderlyingStatsScheduleTexture } from "./teamScheduleStrength";

export type TeamRatingNarrativeSnapshot = {
  components: TeamRating["components"];
  date: string;
  defRating: number;
  offRating: number;
  paceRating: number;
  pkTier: number | null;
  ppTier: number | null;
};

export type TeamRatingNarrativeSource = Pick<
  TeamRating,
  | "components"
  | "defRating"
  | "disciplineRating"
  | "finishingRating"
  | "goalieRating"
  | "offRating"
  | "paceRating"
  | "pkTier"
  | "ppTier"
  | "teamAbbr"
> & {
  luckPdoZ?: number | null;
  scheduleTexture?: UnderlyingStatsScheduleTexture | null;
  sosFuture?: number | null;
};

export type TeamRatingNarrative = {
  bullets: string[];
};

type TeamNarrativeDriverKey = "defense" | "offense" | "pace" | "specialTeams";

type TeamNarrativeDriver = {
  delta: number;
  key: TeamNarrativeDriverKey;
};

type TeamRatingNarrativeBaseline = {
  components: TeamRating["components"];
  defRating: number;
  offRating: number;
  paceRating: number;
  specialTeamsBonus: number;
};

const MIN_DRIVER_DELTA = 0.35;
const MIN_SOS_CONTEXT_DELTA = 0.015;

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const computeSpecialTeamsBonus = ({
  defRating,
  offRating,
  paceRating,
  pkTier,
  ppTier
}: {
  defRating: number;
  offRating: number;
  paceRating: number;
  pkTier: number | null;
  ppTier: number | null;
}): number =>
  Number(
    (
      computeTeamPowerScore({
        defRating,
        offRating,
        paceRating,
        pkTier,
        ppTier,
        trend10: 0
      }) -
      (offRating + defRating + paceRating) / 3
    ).toFixed(2)
  );

const buildBaseline = (
  history: TeamRatingNarrativeSnapshot[]
): TeamRatingNarrativeBaseline | null => {
  const baselineWindow = history.slice(1, 11);
  if (!baselineWindow.length) {
    return null;
  }

  return {
    components: {
      gf60: average(baselineWindow.map((entry) => entry.components.gf60)),
      ga60: average(baselineWindow.map((entry) => entry.components.ga60)),
      pace60: average(baselineWindow.map((entry) => entry.components.pace60)),
      sa60: average(baselineWindow.map((entry) => entry.components.sa60)),
      sf60: average(baselineWindow.map((entry) => entry.components.sf60)),
      xga60: average(baselineWindow.map((entry) => entry.components.xga60)),
      xgf60: average(baselineWindow.map((entry) => entry.components.xgf60))
    },
    defRating: average(baselineWindow.map((entry) => entry.defRating)),
    offRating: average(baselineWindow.map((entry) => entry.offRating)),
    paceRating: average(baselineWindow.map((entry) => entry.paceRating)),
    specialTeamsBonus: average(
      baselineWindow.map((entry) =>
        computeSpecialTeamsBonus({
          defRating: entry.defRating,
          offRating: entry.offRating,
          paceRating: entry.paceRating,
          pkTier: entry.pkTier,
          ppTier: entry.ppTier
        })
      )
    )
  };
};

const buildOffenseBullet = ({
  baseline,
  current,
  delta
}: {
  baseline: TeamRatingNarrativeBaseline;
  current: TeamRatingNarrativeSource;
  delta: number;
}): string => {
  const xgfDelta = current.components.xgf60 - baseline.components.xgf60;
  const sfDelta = current.components.sf60 - baseline.components.sf60;
  const gfDelta = current.components.gf60 - baseline.components.gf60;

  if (delta >= 0) {
    if (xgfDelta > 0 && sfDelta > 0) {
      return "5v5 offense is rising as expected goals and shot volume improve.";
    }
    if (xgfDelta > 0) {
      return "5v5 offense is rising as chance creation improves.";
    }
    if (gfDelta > 0) {
      return "5v5 offense is rising as finishing adds a little more than usual.";
    }
    return "5v5 offense is rating better than this team’s recent baseline.";
  }

  if (xgfDelta < 0 && sfDelta < 0) {
    return "5v5 offense is slipping as expected goals and shot volume cool off.";
  }
  if (xgfDelta < 0) {
    return "5v5 offense is slipping as chance creation fades.";
  }
  if (gfDelta < 0) {
    return "5v5 offense is slipping as finishing cools off.";
  }
  return "5v5 offense is trailing this team’s recent baseline.";
};

const buildDefenseBullet = ({
  baseline,
  current,
  delta
}: {
  baseline: TeamRatingNarrativeBaseline;
  current: TeamRatingNarrativeSource;
  delta: number;
}): string => {
  const xgaDelta = current.components.xga60 - baseline.components.xga60;
  const saDelta = current.components.sa60 - baseline.components.sa60;
  const gaDelta = current.components.ga60 - baseline.components.ga60;

  if (delta >= 0) {
    if (xgaDelta < 0 && saDelta < 0) {
      return "Defensive form tightened with fewer shots and expected goals allowed.";
    }
    if (xgaDelta < 0) {
      return "Defensive form tightened by cutting down chance quality against.";
    }
    if (gaDelta < 0) {
      return "Defensive form improved as goals against cooled off.";
    }
    return "Defense is rating better than this team’s recent baseline.";
  }

  if (xgaDelta > 0 && saDelta > 0) {
    return "Defensive form slipped with more shots and expected goals allowed.";
  }
  if (xgaDelta > 0) {
    return "Defensive form slipped as chance quality against climbed.";
  }
  if (gaDelta > 0) {
    return "Defensive form slipped as more shots are turning into goals.";
  }
  return "Defense is trailing this team’s recent baseline.";
};

const buildPaceBullet = ({
  baseline,
  current,
  delta
}: {
  baseline: TeamRatingNarrativeBaseline;
  current: TeamRatingNarrativeSource;
  delta: number;
}): string => {
  const paceDelta = current.components.pace60 - baseline.components.pace60;

  if (delta >= 0) {
    if (paceDelta > 0) {
      return "Pace is ticking up, so this team’s games are getting faster than usual.";
    }
    return "Pace is helping the overall profile more than usual.";
  }

  if (paceDelta < 0) {
    return "Pace has cooled, so this team’s games are slowing down versus recent form.";
  }
  return "Pace is contributing a little less than usual.";
};

const buildSpecialTeamsBullet = (delta: number): string => {
  if (delta >= 0) {
    return "Special teams are adding a bit more than usual through stronger PP and PK support.";
  }

  return "Special teams are adding a bit less than usual through weaker PP and PK support.";
};

const buildContextBullet = ({
  leagueAverageFutureSos,
  row
}: {
  leagueAverageFutureSos: number | null;
  row: TeamRatingNarrativeSource;
}): string | null => {
  if (
    typeof row.sosFuture === "number" &&
    typeof leagueAverageFutureSos === "number"
  ) {
    const sosDelta = row.sosFuture - leagueAverageFutureSos;

    if (sosDelta <= -MIN_SOS_CONTEXT_DELTA) {
      return "Upcoming schedule looks softer than league average.";
    }

    if (sosDelta >= MIN_SOS_CONTEXT_DELTA) {
      return "Upcoming schedule looks tougher than league average.";
    }
  }

  if (typeof row.luckPdoZ === "number" && row.luckPdoZ >= 1) {
    return "Puck luck is running hot, so recent results may cool toward normal.";
  }

  if (typeof row.luckPdoZ === "number" && row.luckPdoZ <= -1) {
    return "Puck luck is running cold, so results could rebound if play holds.";
  }

  if (typeof row.finishingRating === "number" && row.finishingRating >= 105) {
    return "Scoring is running ahead of expected chance quality right now.";
  }

  if (typeof row.finishingRating === "number" && row.finishingRating <= 95) {
    return "Scoring is running behind expected chance quality right now.";
  }

  if (typeof row.goalieRating === "number" && row.goalieRating >= 105) {
    return "Goaltending is outperforming expected goals against right now.";
  }

  if (typeof row.goalieRating === "number" && row.goalieRating <= 95) {
    return "Goaltending is lagging behind expected goals against right now.";
  }

  const texture = row.scheduleTexture;
  if (texture?.backToBacksNext14) {
    return `The next two weeks include ${texture.backToBacksNext14} back-to-back set${
      texture.backToBacksNext14 === 1 ? "" : "s"
    }.`;
  }

  return null;
};

const buildDrivers = ({
  baseline,
  row
}: {
  baseline: TeamRatingNarrativeBaseline;
  row: TeamRatingNarrativeSource;
}): TeamNarrativeDriver[] => {
  const currentSpecialTeamsBonus = computeSpecialTeamsBonus(row);

  return [
    {
      delta: Number((row.offRating - baseline.offRating).toFixed(2)),
      key: "offense"
    },
    {
      delta: Number((row.defRating - baseline.defRating).toFixed(2)),
      key: "defense"
    },
    {
      delta: Number((row.paceRating - baseline.paceRating).toFixed(2)),
      key: "pace"
    },
    {
      delta: Number(
        (currentSpecialTeamsBonus - baseline.specialTeamsBonus).toFixed(2)
      ),
      key: "specialTeams"
    }
  ];
};

const buildDriverBullet = ({
  baseline,
  driver,
  row
}: {
  baseline: TeamRatingNarrativeBaseline;
  driver: TeamNarrativeDriver;
  row: TeamRatingNarrativeSource;
}): string => {
  switch (driver.key) {
    case "offense":
      return buildOffenseBullet({
        baseline,
        current: row,
        delta: driver.delta
      });
    case "defense":
      return buildDefenseBullet({
        baseline,
        current: row,
        delta: driver.delta
      });
    case "pace":
      return buildPaceBullet({
        baseline,
        current: row,
        delta: driver.delta
      });
    case "specialTeams":
      return buildSpecialTeamsBullet(driver.delta);
  }
};

export const buildTeamRatingNarrative = ({
  history,
  leagueAverageFutureSos,
  row
}: {
  history: TeamRatingNarrativeSnapshot[];
  leagueAverageFutureSos: number | null;
  row: TeamRatingNarrativeSource;
}): TeamRatingNarrative => {
  const baseline = buildBaseline(history);

  if (!baseline) {
    const bullets = [
      "Recent baseline is still too short for a reliable rise-or-fall read.",
      typeof row.sosFuture === "number" && typeof leagueAverageFutureSos === "number"
        ? row.sosFuture >= leagueAverageFutureSos
          ? "Upcoming schedule looks tougher than league average."
          : "Upcoming schedule looks softer than league average."
        : "Use the context columns as support rather than direct rank drivers."
    ];

    return { bullets };
  }

  const drivers = buildDrivers({ baseline, row })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .filter((driver, index, list) =>
      index < 2
        ? Math.abs(driver.delta) >= MIN_DRIVER_DELTA ||
          Math.abs(list[0]?.delta ?? 0) < MIN_DRIVER_DELTA
        : false
    );

  const bullets = drivers.map((driver) =>
    buildDriverBullet({ baseline, driver, row })
  );

  const contextBullet = buildContextBullet({ leagueAverageFutureSos, row });
  if (contextBullet) {
    bullets.push(contextBullet);
  }

  return {
    bullets: bullets.slice(0, 3)
  };
};

export const buildTeamRatingNarratives = ({
  historiesByTeam,
  rows
}: {
  historiesByTeam: Map<string, TeamRatingNarrativeSnapshot[]>;
  rows: TeamRatingNarrativeSource[];
}): Map<string, TeamRatingNarrative> => {
  const futureSosValues = rows
    .map((row) => row.sosFuture)
    .filter((value): value is number => typeof value === "number");
  const leagueAverageFutureSos = futureSosValues.length
    ? average(futureSosValues)
    : null;

  return new Map(
    rows.map((row) => {
      const history = historiesByTeam.get(row.teamAbbr) ?? [];

      return [
        row.teamAbbr,
        history.length
          ? buildTeamRatingNarrative({
              history,
              leagueAverageFutureSos,
              row
            })
          : { bullets: [] }
      ] as const;
    })
  );
};
