import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps, NextPage } from "next";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";

import DashboardPillarHero from "../../components/dashboard/DashboardPillarHero";
import UnderlyingStatsDashboardCard from "../../components/underlying-stats/UnderlyingStatsDashboardCard";
import UnderlyingStatsNavBar from "../../components/underlying-stats/UnderlyingStatsNavBar";
import UnderlyingStatsQuadrantMap from "../../components/underlying-stats/UnderlyingStatsQuadrantMap";
import UlsStatusPanel from "../../components/underlying-stats/UlsStatusPanel";
import OwnershipSparkline from "../../components/TransactionTrends/OwnershipSparkline";
import { computeTeamPowerScore } from "../../lib/dashboard/teamContext";
import { getAnalyticsSurfaceContract } from "../../lib/navigation/analyticsSurfaceOwnership";
import { UNDERLYING_STATS_SURFACE_LINKS } from "../../lib/navigation/siteSurfaceLinks";
import supabaseServer from "../../lib/supabase/server";
import { type SpecialTeamTier } from "../../lib/teamRatingsService";
import { teamsInfo } from "../../lib/teamsInfo";
import { fetchDistinctUnderlyingStatsSnapshotDates } from "../../lib/underlying-stats/availableSnapshotDates";
import {
  resolveUnderlyingStatsLandingSnapshot,
  type UnderlyingStatsLandingRating,
  type UnderlyingStatsLandingSnapshot
} from "../../lib/underlying-stats/teamLandingRatings";
import { fetchUlsRouteStatus, type UlsRouteStatus } from "../../lib/underlying-stats/ulsRouteStatus";
import styles from "./indexUS.module.scss";

type PageProps = {
  availableDates: string[];
  initialSnapshot: UnderlyingStatsLandingSnapshot;
  routeStatus: UlsRouteStatus | null;
};

type TableViewMode = "advanced" | "simple";
type SortDirection = "asc" | "desc";
type SortKey =
  | "chanceGeneration"
  | "defense"
  | "discipline"
  | "goaltending"
  | "offense"
  | "pace"
  | "power"
  | "pp"
  | "pk"
  | "puckLuck"
  | "rank"
  | "scoring"
  | "sosFuture"
  | "sosPast"
  | "team"
  | "trend";

type SortState = {
  direction: SortDirection;
  key: SortKey;
};

type MetricPopoverProps = {
  children: ReactNode;
  contentClassName?: string;
  label: string;
  summary: ReactNode;
  summaryClassName?: string;
};

const DEFAULT_SORTS: Record<TableViewMode, SortState> = {
  advanced: { direction: "desc", key: "power" },
  simple: { direction: "desc", key: "power" }
};

const SORTABLE_KEYS_BY_MODE: Record<TableViewMode, SortKey[]> = {
  advanced: [
    "rank",
    "team",
    "power",
    "sosPast",
    "sosFuture",
    "offense",
    "defense",
    "pace",
    "trend",
    "pp",
    "pk",
    "scoring",
    "goaltending",
    "chanceGeneration",
    "discipline",
    "puckLuck"
  ].filter((value): value is SortKey => typeof value === "string"),
  simple: ["rank", "team", "power", "trend", "sosFuture"]
};

const SORT_DEFAULT_DIRECTIONS: Record<SortKey, SortDirection> = {
  chanceGeneration: "desc",
  defense: "desc",
  discipline: "desc",
  goaltending: "desc",
  offense: "desc",
  pace: "desc",
  power: "desc",
  pp: "asc",
  pk: "asc",
  puckLuck: "desc",
  rank: "asc",
  scoring: "desc",
  sosFuture: "desc",
  sosPast: "desc",
  team: "asc",
  trend: "desc"
};

const tierLabels: Record<SpecialTeamTier, string> = {
  1: "Tier 1 · Elite",
  2: "Tier 2 · Middle",
  3: "Tier 3 · Subpar"
};

const tierTableLabels: Record<SpecialTeamTier, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3"
};

const formatDateLabel = (isoDate: string): string => {
  try {
    return format(parseISO(isoDate), "MMM d, yyyy");
  } catch {
    return isoDate;
  }
};

const formatRating = (value: number): string => value.toFixed(1);
const formatTrend = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const formatPower = (value: number): string => value.toFixed(1);
const formatSos = (value: number | null): string =>
  typeof value === "number" && !Number.isNaN(value)
    ? `${(value * 100).toFixed(1)}%`
    : "—";
const formatPct = (value: number | null): string =>
  typeof value === "number" && !Number.isNaN(value)
    ? `${value.toFixed(1)}%`
    : "—";
const formatOptionalRating = (value: number | null): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return formatRating(value);
};
const formatRank = (value: number | null): string =>
  typeof value === "number" && Number.isFinite(value) ? `#${value}` : "—";
const formatPdo = (value: number | null): string =>
  typeof value === "number" && !Number.isNaN(value) ? value.toFixed(1) : "—";
const formatSignedNumber = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

const getTeamName = (abbr: string): string =>
  teamsInfo[abbr as keyof typeof teamsInfo]?.name ?? abbr;

const getLuckStatusLabel = (
  value: UnderlyingStatsLandingRating["luckStatus"]
): string => {
  switch (value) {
    case "hot":
      return "Hot";
    case "cold":
      return "Cold";
    default:
      return "Normal";
  }
};

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const standardDeviation = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }

  const avg = average(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    (values.length - 1);

  return Math.sqrt(variance);
};

const summarizeValues = (
  values: number[]
): { average: number; stdDev: number } => ({
  average: values.length ? average(values) : 0,
  stdDev: standardDeviation(values)
});

const compareNullableNumbers = (
  left: number | null | undefined,
  right: number | null | undefined,
  direction: SortDirection
): number => {
  const leftValue = typeof left === "number" ? left : null;
  const rightValue = typeof right === "number" ? right : null;

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
};

const buildScheduleChips = (
  texture: UnderlyingStatsLandingRating["scheduleTexture"]
): string[] => {
  if (!texture || texture.gamesNext14 <= 0) {
    return [];
  }

  const chips = [`${texture.gamesNext7} in 7d`];

  if (texture.backToBacksNext14 > 0) {
    chips.push(`B2B x${texture.backToBacksNext14}`);
  }

  if (texture.threeInFourNext14 > 0) {
    chips.push(`3 in 4 x${texture.threeInFourNext14}`);
  }

  const restDelta =
    texture.restAdvantageGamesNext14 - texture.restDisadvantageGamesNext14;
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

const MetricPopover = ({
  children,
  contentClassName,
  label,
  summary,
  summaryClassName
}: MetricPopoverProps) => (
  <details className={styles.metricPopover}>
    <summary
      className={[
        styles.metricPopoverSummary,
        summaryClassName ? summaryClassName : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{summary}</span>
      <span className={styles.metricPopoverIcon}>i</span>
    </summary>
    <div
      className={[
        styles.metricPopoverContent,
        contentClassName ? contentClassName : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <strong>{label}</strong>
      {children}
    </div>
  </details>
);

const TeamPowerRankingsPage: NextPage<PageProps> = ({
  availableDates,
  initialSnapshot,
  routeStatus
}) => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(
    initialSnapshot.resolvedDate ?? ""
  );
  const [snapshot, setSnapshot] =
    useState<UnderlyingStatsLandingSnapshot>(initialSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTeamAbbr, setActiveTeamAbbr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TableViewMode>("simple");
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORTS.simple);
  const ratings = snapshot.ratings;
  const dashboard = snapshot.dashboard;

  useEffect(() => {
    setSnapshot(initialSnapshot);
    setSelectedDate(initialSnapshot.resolvedDate ?? "");
  }, [initialSnapshot]);

  useEffect(() => {
    if (!selectedDate || selectedDate === snapshot.resolvedDate) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/underlying-stats/team-ratings?date=${selectedDate}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ratings (${response.status})`);
        }

        return response.json() as Promise<UnderlyingStatsLandingSnapshot>;
      })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setSnapshot(data);
        if (data.resolvedDate && data.resolvedDate !== selectedDate) {
          setSelectedDate(data.resolvedDate);
          router.replace(
            {
              pathname: router.pathname,
              query: { date: data.resolvedDate }
            },
            undefined,
            { shallow: true }
          );
        }
      })
      .catch((fetchError: unknown) => {
        if (!isMounted) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Something went wrong while loading ratings.";
        setError(message);
        setSnapshot((current) => ({
          ...current,
          dashboard: {
            ...current.dashboard,
            context: [],
            fallers: [],
            inefficiency: { overvalued: [], undervalued: [] },
            quadrant: {
              averageDefenseProcess: 0,
              averageOffenseProcess: 0,
              axisSubtitle: current.dashboard.quadrant.axisSubtitle,
              points: []
            },
            risers: [],
            sustainability: {
              buyLow: [],
              heatCheck: [],
              processBacked: []
            }
          },
          ratings: []
        }));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, snapshot.resolvedDate, router]);

  const dateOptions = useMemo(() => {
    const unique = Array.from(new Set(availableDates));
    if (selectedDate && !unique.includes(selectedDate)) {
      unique.unshift(selectedDate);
    }
    return unique;
  }, [availableDates, selectedDate]);

  const powerRankedRatings = useMemo(
    () =>
      [...ratings].sort(
        (left, right) =>
          computeTeamPowerScore(right) - computeTeamPowerScore(left)
      ),
    [ratings]
  );

  const powerRankByTeam = useMemo(
    () =>
      new Map(
        powerRankedRatings.map(
          (team, index) => [team.teamAbbr, index + 1] as const
        )
      ),
    [powerRankedRatings]
  );

  const topTeams = useMemo(
    () => powerRankedRatings.slice(0, 3),
    [powerRankedRatings]
  );
  const activeTeam = useMemo(
    () =>
      activeTeamAbbr
        ? ratings.find((team) => team.teamAbbr === activeTeamAbbr) ?? null
        : null,
    [activeTeamAbbr, ratings]
  );
  const explorerContracts = useMemo(
    () => [
      getAnalyticsSurfaceContract("uls-skater-explorer"),
      getAnalyticsSurfaceContract("uls-goalie-explorer"),
      getAnalyticsSurfaceContract("uls-team-explorer")
    ],
    []
  );
  const explorerTeamId = useMemo(() => {
    if (!activeTeam?.teamAbbr) {
      return null;
    }

    return teamsInfo[activeTeam.teamAbbr as keyof typeof teamsInfo]?.id ?? null;
  }, [activeTeam?.teamAbbr]);

  const componentStats = useMemo(() => {
    const xgf60 = summarizeValues(ratings.map((team) => team.components.xgf60));
    const sf60 = summarizeValues(ratings.map((team) => team.components.sf60));
    const gf60 = summarizeValues(ratings.map((team) => team.components.gf60));
    const xga60 = summarizeValues(ratings.map((team) => team.components.xga60));
    const sa60 = summarizeValues(ratings.map((team) => team.components.sa60));
    const ga60 = summarizeValues(ratings.map((team) => team.components.ga60));
    const pace60 = summarizeValues(
      ratings.map((team) => team.components.pace60)
    );
    const pdo = summarizeValues(
      ratings
        .map((team) => team.luckPdo)
        .filter((value): value is number => typeof value === "number")
    );

    return {
      ga60,
      gf60,
      pdo,
      pace60,
      sa60,
      sf60,
      xga60,
      xgf60
    };
  }, [ratings]);

  const displayedRatings = useMemo(() => {
    const sorted = [...ratings];

    sorted.sort((left, right) => {
      switch (sortState.key) {
        case "rank":
          return compareNullableNumbers(
            powerRankByTeam.get(left.teamAbbr),
            powerRankByTeam.get(right.teamAbbr),
            sortState.direction
          );
        case "team":
          return sortState.direction === "asc"
            ? left.teamAbbr.localeCompare(right.teamAbbr)
            : right.teamAbbr.localeCompare(left.teamAbbr);
        case "power":
          return compareNullableNumbers(
            computeTeamPowerScore(left),
            computeTeamPowerScore(right),
            sortState.direction
          );
        case "sosPast":
          return compareNullableNumbers(
            left.sosPast,
            right.sosPast,
            sortState.direction
          );
        case "sosFuture":
          return compareNullableNumbers(
            left.sosFuture,
            right.sosFuture,
            sortState.direction
          );
        case "defense":
          return compareNullableNumbers(
            left.defRating,
            right.defRating,
            sortState.direction
          );
        case "offense":
          return compareNullableNumbers(
            left.offRating,
            right.offRating,
            sortState.direction
          );
        case "pace":
          return compareNullableNumbers(
            left.paceRating,
            right.paceRating,
            sortState.direction
          );
        case "trend":
          return compareNullableNumbers(
            left.trend10,
            right.trend10,
            sortState.direction
          );
        case "pp":
          return compareNullableNumbers(
            left.ppRank,
            right.ppRank,
            sortState.direction
          );
        case "pk":
          return compareNullableNumbers(
            left.pkRank,
            right.pkRank,
            sortState.direction
          );
        case "scoring":
          return compareNullableNumbers(
            left.finishingRating,
            right.finishingRating,
            sortState.direction
          );
        case "goaltending":
          return compareNullableNumbers(
            left.goalieRating,
            right.goalieRating,
            sortState.direction
          );
        case "chanceGeneration":
          return compareNullableNumbers(
            left.dangerRating,
            right.dangerRating,
            sortState.direction
          );
        case "discipline":
          return compareNullableNumbers(
            left.disciplineRating,
            right.disciplineRating,
            sortState.direction
          );
        case "puckLuck":
          return compareNullableNumbers(
            left.luckPdoZ,
            right.luckPdoZ,
            sortState.direction
          );
        default:
          return compareNullableNumbers(
            left.offRating,
            right.offRating,
            sortState.direction
          );
      }
    });

    return sorted;
  }, [powerRankByTeam, ratings, sortState]);

  const getComponentBadgeClass = (value: number | null): string => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return styles.componentNeutral;
    }
    if (value >= 105) {
      return styles.componentPositive;
    }
    if (value <= 95) {
      return styles.componentNegative;
    }
    return styles.componentNeutral;
  };

  const getSosClass = (value: number | null): string => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return styles.sosNeutral;
    }
    if (value >= 0.58) {
      return styles.sosHard;
    }
    if (value <= 0.52) {
      return styles.sosEasy;
    }
    return styles.sosNeutral;
  };

  const getTrendClass = (value: number): string => {
    if (value > 0.5) return styles.trendPositive;
    if (value < -0.5) return styles.trendNegative;
    return styles.trendNeutral;
  };

  const getLuckClass = (
    status: UnderlyingStatsLandingRating["luckStatus"]
  ): string => {
    switch (status) {
      case "hot":
        return styles.luckHot;
      case "cold":
        return styles.luckCold;
      default:
        return styles.luckNeutral;
    }
  };

  const resolveTierClass = (tier: SpecialTeamTier): string => {
    switch (tier) {
      case 1:
        return styles.tier1;
      case 2:
        return styles.tier2;
      default:
        return styles.tier3;
    }
  };

  const handleDateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedDate(value);
    router.replace(
      {
        pathname: router.pathname,
        query: value ? { date: value } : {}
      },
      undefined,
      { shallow: true }
    );
  };

  const handleModeChange = (nextMode: TableViewMode) => {
    setViewMode(nextMode);
    if (!SORTABLE_KEYS_BY_MODE[nextMode].includes(sortState.key)) {
      setSortState(DEFAULT_SORTS[nextMode]);
    }
  };

  const handleSort = (key: SortKey) => {
    if (!SORTABLE_KEYS_BY_MODE[viewMode].includes(key)) {
      return;
    }

    setSortState((current) => {
      if (current.key === key) {
        return {
          direction: current.direction === "asc" ? "desc" : "asc",
          key
        };
      }

      return {
        direction: SORT_DEFAULT_DIRECTIONS[key],
        key
      };
    });
  };

  const renderSortButton = ({
    key,
    label,
    title
  }: {
    key: SortKey;
    label: ReactNode;
    title?: string;
  }) => {
    const isActive = sortState.key === key;
    const ariaSort = isActive
      ? sortState.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";

    return (
      <th scope="col" aria-sort={ariaSort}>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => handleSort(key)}
          title={title}
        >
          <span>{label}</span>
          <span className={styles.sortIndicator}>
            {isActive ? (sortState.direction === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  const renderScheduleTexture = (team: UnderlyingStatsLandingRating) => {
    const chips = buildScheduleChips(team.scheduleTexture);
    if (!chips.length) {
      return null;
    }

    return (
      <div className={styles.scheduleTexture}>
        {chips.map((chip) => (
          <span
            key={`${team.teamAbbr}-${chip}`}
            className={styles.scheduleChip}
          >
            {chip}
          </span>
        ))}
      </div>
    );
  };

  const renderPowerPopover = (team: UnderlyingStatsLandingRating) => {
    const powerScore = computeTeamPowerScore(team);

    return (
      <MetricPopover
        label="Power Score"
        summary={formatPower(powerScore)}
        summaryClassName={styles.powerPopoverSummary}
      >
        <p>
          Power Score averages offense, defense, and pace, then adds a small
          PP/PK tier bonus.
        </p>
        <ul className={styles.popoverList}>
          <li>Offense: {formatRating(team.offRating)}</li>
          <li>Defense: {formatRating(team.defRating)}</li>
          <li>Pace: {formatRating(team.paceRating)}</li>
          <li>
            Special teams bonus:{" "}
            {formatSignedNumber(
              computeTeamPowerScore(team) -
                (team.offRating + team.defRating + team.paceRating) / 3
            )}
          </li>
        </ul>
      </MetricPopover>
    );
  };

  const renderOffensePopover = (team: UnderlyingStatsLandingRating) => {
    const xgfZ =
      componentStats.xgf60.stdDev > 0
        ? (team.components.xgf60 - componentStats.xgf60.average) /
          componentStats.xgf60.stdDev
        : 0;
    const sfZ =
      componentStats.sf60.stdDev > 0
        ? (team.components.sf60 - componentStats.sf60.average) /
          componentStats.sf60.stdDev
        : 0;
    const gfZ =
      componentStats.gf60.stdDev > 0
        ? (team.components.gf60 - componentStats.gf60.average) /
          componentStats.gf60.stdDev
        : 0;

    return (
      <MetricPopover
        label="Offense"
        summary={formatRating(team.offRating)}
        summaryClassName={styles.componentPopoverSummary}
      >
        <p>Higher is better. Formula: 70% xGF/60, 20% SF/60, 10% GF/60.</p>
        <ul className={styles.popoverList}>
          <li>
            xGF/60: {team.components.xgf60.toFixed(2)} vs league{" "}
            {componentStats.xgf60.average.toFixed(2)} (
            {formatSignedNumber(xgfZ)}z)
          </li>
          <li>
            SF/60: {team.components.sf60.toFixed(2)} vs league{" "}
            {componentStats.sf60.average.toFixed(2)} ({formatSignedNumber(sfZ)}
            z)
          </li>
          <li>
            GF/60: {team.components.gf60.toFixed(2)} vs league{" "}
            {componentStats.gf60.average.toFixed(2)} ({formatSignedNumber(gfZ)}
            z)
          </li>
        </ul>
      </MetricPopover>
    );
  };

  const renderDefensePopover = (team: UnderlyingStatsLandingRating) => {
    const xgaZ =
      componentStats.xga60.stdDev > 0
        ? (team.components.xga60 - componentStats.xga60.average) /
          componentStats.xga60.stdDev
        : 0;
    const saZ =
      componentStats.sa60.stdDev > 0
        ? (team.components.sa60 - componentStats.sa60.average) /
          componentStats.sa60.stdDev
        : 0;
    const gaZ =
      componentStats.ga60.stdDev > 0
        ? (team.components.ga60 - componentStats.ga60.average) /
          componentStats.ga60.stdDev
        : 0;

    return (
      <MetricPopover
        label="Defense"
        summary={formatRating(team.defRating)}
        summaryClassName={styles.componentPopoverSummary}
      >
        <p>
          Higher is better. Formula flips the inputs so fewer chances and goals
          against score better.
        </p>
        <ul className={styles.popoverList}>
          <li>
            xGA/60: {team.components.xga60.toFixed(2)} vs league{" "}
            {componentStats.xga60.average.toFixed(2)} (
            {formatSignedNumber(xgaZ)}z)
          </li>
          <li>
            SA/60: {team.components.sa60.toFixed(2)} vs league{" "}
            {componentStats.sa60.average.toFixed(2)} ({formatSignedNumber(saZ)}
            z)
          </li>
          <li>
            GA/60: {team.components.ga60.toFixed(2)} vs league{" "}
            {componentStats.ga60.average.toFixed(2)} ({formatSignedNumber(gaZ)}
            z)
          </li>
        </ul>
      </MetricPopover>
    );
  };

  const renderPacePopover = (team: UnderlyingStatsLandingRating) => {
    const paceZ =
      componentStats.pace60.stdDev > 0
        ? (team.components.pace60 - componentStats.pace60.average) /
          componentStats.pace60.stdDev
        : 0;

    return (
      <MetricPopover
        label="Pace"
        summary={formatRating(team.paceRating)}
        summaryClassName={styles.componentPopoverSummary}
      >
        <p>
          Pace measures game speed through combined shot-attempt volume. Higher
          means this team tends to play in faster environments.
        </p>
        <ul className={styles.popoverList}>
          <li>
            Pace input: {team.components.pace60.toFixed(2)} vs league{" "}
            {componentStats.pace60.average.toFixed(2)} (
            {formatSignedNumber(paceZ)}
            z)
          </li>
          <li>Final pace score: {formatRating(team.paceRating)}</li>
        </ul>
      </MetricPopover>
    );
  };

  const renderScoringPopover = (team: UnderlyingStatsLandingRating) => (
    <MetricPopover
      label="Scoring"
      summary={
        <span
          className={`${styles.componentBadge} ${getComponentBadgeClass(
            team.finishingRating
          )}`}
        >
          {formatOptionalRating(team.finishingRating)}
        </span>
      }
    >
      <p>
        Higher is better. Formula: goals for rate minus expected goals for rate.
      </p>
      <ul className={styles.popoverList}>
        <li>GF/60: {team.components.gf60.toFixed(2)}</li>
        <li>xGF/60: {team.components.xgf60.toFixed(2)}</li>
        <li>
          Finishing gap:{" "}
          {formatSignedNumber(team.components.gf60 - team.components.xgf60)}
        </li>
        <li>League-average score is 100.</li>
      </ul>
    </MetricPopover>
  );

  const renderGoaltendingPopover = (team: UnderlyingStatsLandingRating) => (
    <MetricPopover
      label="Goaltending"
      summary={
        <span
          className={`${styles.componentBadge} ${getComponentBadgeClass(
            team.goalieRating
          )}`}
        >
          {formatOptionalRating(team.goalieRating)}
        </span>
      }
    >
      <p>
        Higher is better. Formula: expected goals against rate minus actual
        goals against rate.
      </p>
      <ul className={styles.popoverList}>
        <li>GA/60: {team.components.ga60.toFixed(2)}</li>
        <li>xGA/60: {team.components.xga60.toFixed(2)}</li>
        <li>
          Save gap:{" "}
          {formatSignedNumber(team.components.xga60 - team.components.ga60)}
        </li>
        <li>League-average score is 100.</li>
      </ul>
    </MetricPopover>
  );

  const renderPuckLuckPopover = (team: UnderlyingStatsLandingRating) => {
    const pdoZ =
      typeof team.luckPdo === "number" && componentStats.pdo.stdDev > 0
        ? (team.luckPdo - componentStats.pdo.average) /
          componentStats.pdo.stdDev
        : (team.luckPdoZ ?? 0);

    return (
      <MetricPopover
        label="Puck Luck"
        summary={
          <span
            className={`${styles.sparkMetricValue} ${getLuckClass(team.luckStatus)}`}
          >
            {getLuckStatusLabel(team.luckStatus)}
          </span>
        }
      >
        <p>
          PDO combines shooting percentage and save percentage. Around 100 is
          normal; farther away often drifts back over time.
        </p>
        <ul className={styles.popoverList}>
          <li>Current PDO: {formatPdo(team.luckPdo)}</li>
          <li>Puck-luck z-score: {formatSignedNumber(pdoZ)}</li>
          <li>Status label: {getLuckStatusLabel(team.luckStatus)}</li>
        </ul>
      </MetricPopover>
    );
  };

  return (
    <>
      <Head>
        <title>Underlying Stats Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="League-wide NHL intelligence dashboard with an interactive process map, risers and fallers, sustainability context, schedule texture, market inefficiency signals, and a supporting power table."
        />
      </Head>
      <main className={styles.page}>
        <section className={styles.headerPanel}>
          <div className={styles.topNavRow}>
            <div className={styles.sectionEyebrow}>Team hub</div>
            <UnderlyingStatsNavBar />
          </div>
          <div className={styles.header}>
            <DashboardPillarHero
              className={styles.headerIntro}
              eyebrow="Team intelligence pillar"
              title="Underlying Stats Dashboard"
              description={
                <p>
                  This surface owns the team read: who profiles as strong, what
                  looks sustainable, which movement is backed by process, and
                  where surface results disagree with the underlying picture.
                </p>
              }
              emphasis="Team diagnosis"
              owns={[
                "Process-first team reads with quadrant and mover context",
                "Sustainability, inefficiency, and schedule-texture modules",
                "A supporting table for validation after the dashboard read"
              ]}
              defers={[
                "Fast player triage, recent-form scanning, and start/sit workflow",
                "Prototype-only player trend experiments that still belong in the lab"
              ]}
              surfaceLinks={UNDERLYING_STATS_SURFACE_LINKS}
            />
            <div
              className={styles.controls}
              role="group"
              aria-label="Snapshot controls"
            >
              <label className={styles.controlLabel} htmlFor="date-select">
                Snapshot date
              </label>
              <select
                id="date-select"
                className={styles.dateSelect}
                value={selectedDate}
                onChange={handleDateChange}
                disabled={!dateOptions.length}
              >
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
              <span className={styles.controlHint}>
                {ratings.length} teams · Nightly snapshot after games
              </span>
            </div>
          </div>
        </section>

        <section className={styles.dashboardHero}>
          <UnderlyingStatsDashboardCard
            className={styles.quadrantCard}
            kicker="League map"
            title="Process quadrant"
            description={
              <>
                Offensive process on the x-axis, defensive process on the y-axis.
                Hover a team to read its profile in context.
              </>
            }
            actions={
              <div className={styles.cardMeta}>
                <span>{selectedDate ? formatDateLabel(selectedDate) : "Latest snapshot"}</span>
                {activeTeam ? (
                  <span>
                    Focus {activeTeam.teamAbbr} · {formatPower(computeTeamPowerScore(activeTeam))}
                  </span>
                ) : (
                  <span>{dashboard.quadrant.axisSubtitle}</span>
                )}
              </div>
            }
          >
            {dashboard.quadrant.points.length ? (
              <UnderlyingStatsQuadrantMap
                activeTeamAbbr={activeTeamAbbr}
                averageDefenseProcess={dashboard.quadrant.averageDefenseProcess}
                averageOffenseProcess={dashboard.quadrant.averageOffenseProcess}
                onTeamHover={setActiveTeamAbbr}
                points={dashboard.quadrant.points}
              />
            ) : (
              <div className={styles.moduleEmpty}>No quadrant data for this snapshot.</div>
            )}
          </UnderlyingStatsDashboardCard>

          <UnderlyingStatsDashboardCard
            className={styles.risersCard}
            kicker="Movement"
            title="Risers and fallers"
            description="Recent movers driven by actual rating changes, with context notes kept secondary."
          >
            <div className={styles.moduleSplit}>
              <div className={styles.moduleColumn}>
                <div className={styles.moduleColumnHeader}>
                  <span>Rising now</span>
                </div>
                {dashboard.risers.length ? (
                  <div className={styles.dashboardList}>
                    {dashboard.risers.map((item) => (
                      <article
                        key={`riser-${item.teamAbbr}`}
                        className={`${styles.dashboardListItem} ${
                          activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                        }`}
                        onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                        onMouseLeave={() => setActiveTeamAbbr(null)}
                      >
                        <div className={styles.dashboardItemTopline}>
                          <div>
                            <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                            <span className={styles.dashboardTeamName}>{item.teamName}</span>
                          </div>
                          <div className={styles.dashboardItemStats}>
                            <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                            <span className={`${styles.trendPill} ${styles.trendPositive}`}>
                              +{item.trend.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <ul className={styles.dashboardBullets}>
                          {item.bullets.slice(0, 2).map((bullet) => (
                            <li key={`${item.teamAbbr}-${bullet}`}>{bullet}</li>
                          ))}
                        </ul>
                        {item.archetypes.length ? (
                          <div className={styles.dashboardTags}>
                            {item.archetypes.map((tag) => (
                              <span key={`${item.teamAbbr}-${tag}`} className={styles.dashboardTag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.moduleEmpty}>No risers for this snapshot.</div>
                )}
              </div>

              <div className={styles.moduleColumn}>
                <div className={styles.moduleColumnHeader}>
                  <span>Sliding now</span>
                </div>
                {dashboard.fallers.length ? (
                  <div className={styles.dashboardList}>
                    {dashboard.fallers.map((item) => (
                      <article
                        key={`faller-${item.teamAbbr}`}
                        className={`${styles.dashboardListItem} ${
                          activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                        }`}
                        onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                        onMouseLeave={() => setActiveTeamAbbr(null)}
                      >
                        <div className={styles.dashboardItemTopline}>
                          <div>
                            <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                            <span className={styles.dashboardTeamName}>{item.teamName}</span>
                          </div>
                          <div className={styles.dashboardItemStats}>
                            <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                            <span className={`${styles.trendPill} ${styles.trendNegative}`}>
                              {item.trend.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <ul className={styles.dashboardBullets}>
                          {item.bullets.slice(0, 2).map((bullet) => (
                            <li key={`${item.teamAbbr}-${bullet}`}>{bullet}</li>
                          ))}
                        </ul>
                        {item.archetypes.length ? (
                          <div className={styles.dashboardTags}>
                            {item.archetypes.map((tag) => (
                              <span key={`${item.teamAbbr}-${tag}`} className={styles.dashboardTag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.moduleEmpty}>No fallers for this snapshot.</div>
                )}
              </div>
            </div>
          </UnderlyingStatsDashboardCard>
        </section>

        <section className={styles.dashboardGrid}>
          <UnderlyingStatsDashboardCard
            kicker="Explorer paths"
            title="Continue into the right explorer"
            description="The landing owns the team snapshot. Hover a team anywhere on the page, then open one of these routes to carry that team context into the explorer."
          >
            <div className={styles.dashboardList}>
              {explorerContracts.map((surface) => (
                <article key={surface.id} className={styles.dashboardListItem}>
                  <div className={styles.dashboardItemTopline}>
                    <div>
                      <span className={styles.dashboardTeam}>{surface.shortLabel}</span>
                      <span className={styles.dashboardTeamName}>{surface.label}</span>
                    </div>
                    <Link
                      href={
                        explorerTeamId == null
                          ? surface.href
                          : {
                              pathname: surface.href,
                              query: { teamId: explorerTeamId }
                            }
                      }
                      className={styles.breadcrumbLink}
                    >
                      Open
                    </Link>
                  </div>
                  <ul className={styles.dashboardBullets}>
                    {surface.owns.slice(0, 2).map((bullet) => (
                      <li key={`${surface.id}-${bullet}`}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </UnderlyingStatsDashboardCard>

          <UnderlyingStatsDashboardCard
            kicker="Launch status"
            title="Ratings and model-read status"
            description="The ULS route family now reads the launch contracts directly. Empty cards mean the daily products still need their first populated snapshot."
          >
            <UlsStatusPanel status={routeStatus} variant="landing" />
          </UnderlyingStatsDashboardCard>

          <UnderlyingStatsDashboardCard
            kicker="Trust signal"
            title="What looks real?"
            description="Separate strong process from profiles being pushed around by finishing, goaltending, or luck."
          >
            <div className={styles.trustColumns}>
              <div className={styles.trustColumn}>
                <span className={styles.trustLabel}>Process-backed</span>
                {dashboard.sustainability.processBacked.length ? (
                  dashboard.sustainability.processBacked.map((item) => (
                    <article
                      key={`trust-${item.teamAbbr}`}
                      className={`${styles.trustItem} ${
                        activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                      }`}
                      onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                      onMouseLeave={() => setActiveTeamAbbr(null)}
                    >
                      <div className={styles.dashboardItemTopline}>
                        <div>
                          <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                          <span className={styles.dashboardTeamName}>{item.teamName}</span>
                        </div>
                        <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                      </div>
                      <p className={styles.dashboardNote}>{item.note}</p>
                    </article>
                  ))
                ) : (
                  <div className={styles.moduleEmpty}>No process-backed leaders surfaced.</div>
                )}
              </div>

              <div className={styles.trustColumn}>
                <span className={styles.trustLabel}>Heat check</span>
                {dashboard.sustainability.heatCheck.length ? (
                  dashboard.sustainability.heatCheck.map((item) => (
                    <article
                      key={`heat-${item.teamAbbr}`}
                      className={`${styles.trustItem} ${
                        activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                      }`}
                      onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                      onMouseLeave={() => setActiveTeamAbbr(null)}
                    >
                      <div className={styles.dashboardItemTopline}>
                        <div>
                          <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                          <span className={styles.dashboardTeamName}>{item.teamName}</span>
                        </div>
                        <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                      </div>
                      <p className={styles.dashboardNote}>{item.note}</p>
                    </article>
                  ))
                ) : (
                  <div className={styles.moduleEmpty}>No obvious heat-check teams here.</div>
                )}
              </div>

              <div className={styles.trustColumn}>
                <span className={styles.trustLabel}>Buy low</span>
                {dashboard.sustainability.buyLow.length ? (
                  dashboard.sustainability.buyLow.map((item) => (
                    <article
                      key={`buy-low-${item.teamAbbr}`}
                      className={`${styles.trustItem} ${
                        activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                      }`}
                      onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                      onMouseLeave={() => setActiveTeamAbbr(null)}
                    >
                      <div className={styles.dashboardItemTopline}>
                        <div>
                          <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                          <span className={styles.dashboardTeamName}>{item.teamName}</span>
                        </div>
                        <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                      </div>
                      <p className={styles.dashboardNote}>{item.note}</p>
                    </article>
                  ))
                ) : (
                  <div className={styles.moduleEmpty}>No clear rebound candidates surfaced.</div>
                )}
              </div>
            </div>
          </UnderlyingStatsDashboardCard>

          <UnderlyingStatsDashboardCard
            kicker="What matters next"
            title="Schedule texture"
            description="Future context that changes the read faster than a raw SoS number by itself."
          >
            {dashboard.context.length ? (
              <div className={styles.dashboardList}>
                {dashboard.context.map((item) => (
                  <article
                    key={`context-${item.teamAbbr}`}
                    className={`${styles.dashboardListItem} ${
                      activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                    }`}
                    onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                    onMouseLeave={() => setActiveTeamAbbr(null)}
                  >
                    <div className={styles.dashboardItemTopline}>
                      <div>
                        <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                        <span className={styles.dashboardTeamName}>{item.teamName}</span>
                      </div>
                      <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                    </div>
                    <p className={styles.dashboardNote}>{item.note}</p>
                    {item.chips.length ? (
                      <div className={styles.dashboardTags}>
                        {item.chips.map((chip) => (
                          <span key={`${item.teamAbbr}-${chip}`} className={styles.dashboardTag}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.moduleEmpty}>No standout schedule context yet.</div>
            )}
          </UnderlyingStatsDashboardCard>

          <UnderlyingStatsDashboardCard
            kicker="Inefficiency"
            title="Under the radar"
            description="Where actual goal results and underlying play disagree the most."
          >
            <div className={styles.moduleSplit}>
              <div className={styles.moduleColumn}>
                <div className={styles.moduleColumnHeader}>
                  <span>Undervalued</span>
                </div>
                {dashboard.inefficiency.undervalued.length ? (
                  <div className={styles.dashboardList}>
                    {dashboard.inefficiency.undervalued.map((item) => (
                      <article
                        key={`undervalued-${item.teamAbbr}`}
                        className={`${styles.dashboardListItem} ${
                          activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                        }`}
                        onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                        onMouseLeave={() => setActiveTeamAbbr(null)}
                      >
                        <div className={styles.dashboardItemTopline}>
                          <div>
                            <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                            <span className={styles.dashboardTeamName}>{item.teamName}</span>
                          </div>
                          <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                        </div>
                        <p className={styles.dashboardNote}>{item.note}</p>
                        {item.archetypes.length ? (
                          <div className={styles.dashboardTags}>
                            {item.archetypes.map((tag) => (
                              <span key={`${item.teamAbbr}-${tag}`} className={styles.dashboardTag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.moduleEmpty}>No undervalued teams surfaced.</div>
                )}
              </div>

              <div className={styles.moduleColumn}>
                <div className={styles.moduleColumnHeader}>
                  <span>Overvalued</span>
                </div>
                {dashboard.inefficiency.overvalued.length ? (
                  <div className={styles.dashboardList}>
                    {dashboard.inefficiency.overvalued.map((item) => (
                      <article
                        key={`overvalued-${item.teamAbbr}`}
                        className={`${styles.dashboardListItem} ${
                          activeTeamAbbr === item.teamAbbr ? styles.dashboardListItemActive : ""
                        }`}
                        onMouseEnter={() => setActiveTeamAbbr(item.teamAbbr)}
                        onMouseLeave={() => setActiveTeamAbbr(null)}
                      >
                        <div className={styles.dashboardItemTopline}>
                          <div>
                            <span className={styles.dashboardTeam}>{item.teamAbbr}</span>
                            <span className={styles.dashboardTeamName}>{item.teamName}</span>
                          </div>
                          <span className={styles.powerPill}>{item.power.toFixed(1)}</span>
                        </div>
                        <p className={styles.dashboardNote}>{item.note}</p>
                        {item.archetypes.length ? (
                          <div className={styles.dashboardTags}>
                            {item.archetypes.map((tag) => (
                              <span key={`${item.teamAbbr}-${tag}`} className={styles.dashboardTag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.moduleEmpty}>No overvalued teams surfaced.</div>
                )}
              </div>
            </div>
          </UnderlyingStatsDashboardCard>
        </section>

        <section className={styles.summarySection} aria-labelledby="top-teams-heading">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Strength board</p>
              <h2 className={styles.sectionTitle} id="top-teams-heading">
                Power leaders
              </h2>
              <p className={styles.sectionDescription}>
                The top three profiles still live here, but the dashboard above is the main first read.
              </p>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            {topTeams.length ? (
              topTeams.map((team, index) => (
                <article key={team.teamAbbr} className={styles.summaryCard}>
                  <span className={styles.summaryRank}>#{index + 1}</span>
                  <div className={styles.summaryHeader}>
                    <span className={styles.summaryTeam}>{team.teamAbbr}</span>
                    <span className={styles.summaryTeamName}>
                      {getTeamName(team.teamAbbr)}
                    </span>
                  </div>
                  <div className={styles.summaryMetricGroup}>
                    <div className={styles.summaryPower}>
                      {formatPower(computeTeamPowerScore(team))}
                      <span className={styles.summaryMetricLabel}>
                        Power Score
                      </span>
                    </div>
                    <div className={styles.summaryMetricRow}>
                      <div>
                        {formatRating(team.offRating)}
                        <span className={styles.summarySubLabel}>Offense</span>
                      </div>
                      <div>
                        {formatRating(team.defRating)}
                        <span className={styles.summarySubLabel}>Defense</span>
                      </div>
                      <div>
                        {formatTrend(team.trend10)}
                        <span className={styles.summarySubLabel}>Trend</span>
                      </div>
                    </div>
                  </div>
                  <ul className={styles.summaryDetails}>
                    <li>
                      SoS Future <strong>{formatSos(team.sosFuture)}</strong>
                    </li>
                    <li>
                      PP{" "}
                      <strong className={styles.tierInline}>
                        {formatRank(team.ppRank)} · {formatPct(team.ppPct)}
                      </strong>
                    </li>
                    <li>
                      PK{" "}
                      <strong className={styles.tierInline}>
                        {formatRank(team.pkRank)} · {formatPct(team.pkPct)}
                      </strong>
                    </li>
                  </ul>
                  {team.narrative.length > 0 && (
                    <ul className={styles.summaryNarrative}>
                      {team.narrative.slice(0, 2).map((bullet) => (
                        <li key={`${team.teamAbbr}-${bullet}`}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))
            ) : (
              <article className={styles.summaryEmpty}>
                No rankings available for this date yet.
              </article>
            )}
          </div>
        </section>

        <section
          className={styles.tableSection}
          aria-labelledby="power-rankings-table-heading"
          aria-live="polite"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Supporting table</p>
              <h2
                className={styles.sectionTitle}
                id="power-rankings-table-heading"
              >
                Detailed team table
              </h2>
              <p className={styles.sectionDescription}>
                The dashboard above is the fast league read. Simple mode keeps the lower table compact; advanced mode opens the full component and context layer.
              </p>
              <details className={styles.tableHelp}>
                <summary className={styles.tableHelpSummary}>
                  How to read this table
                </summary>
                <div className={styles.tableHelpContent}>
                  <p>
                    <strong>Power Score</strong> blends 5v5 offense, defense,
                    and pace, with a small special-teams adjustment.
                  </p>
                  <p>
                    <strong>Trend</strong> compares a team with its own recent
                    baseline, not the rest of the league.
                  </p>
                  <p>
                    <strong>Scoring</strong>, <strong>Goaltending</strong>, and{" "}
                    <strong>Puck Luck</strong> are context signals showing
                    finishing and save variance around expected play.
                  </p>
                </div>
              </details>
            </div>
            <div className={styles.sectionTools}>
              <div
                className={styles.modeToggle}
                role="tablist"
                aria-label="Table detail level"
              >
                <button
                  type="button"
                  className={`${styles.modeButton} ${
                    viewMode === "simple" ? styles.modeButtonActive : ""
                  }`}
                  onClick={() => handleModeChange("simple")}
                >
                  Simple
                </button>
                <button
                  type="button"
                  className={`${styles.modeButton} ${
                    viewMode === "advanced" ? styles.modeButtonActive : ""
                  }`}
                  onClick={() => handleModeChange("advanced")}
                >
                  Advanced
                </button>
              </div>
              <div className={styles.sectionMeta}>
                <span>{displayedRatings.length} teams</span>
                <span>
                  {viewMode === "simple" ? "Simple view" : "Advanced view"}
                </span>
                <span>
                  {selectedDate
                    ? formatDateLabel(selectedDate)
                    : "Latest snapshot"}
                </span>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className={styles.loadingBanner}>Loading team ratings…</div>
          )}
          {error && <div className={styles.errorBanner}>{error}</div>}
          {!ratings.length && !isLoading ? (
            <div className={styles.emptyState}>
              No power ranking data is available for{" "}
              {selectedDate ? formatDateLabel(selectedDate) : "this date"}.
              Select another snapshot or refresh later.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table
                className={`${styles.table} ${
                  viewMode === "advanced"
                    ? styles.tableAdvanced
                    : styles.tableSimple
                }`}
              >
                <thead>
                  {viewMode === "simple" ? (
                    <tr>
                      {renderSortButton({ key: "rank", label: "#" })}
                      {renderSortButton({ key: "team", label: "Team" })}
                      {renderSortButton({
                        key: "offense",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Power Score blends offense, defense, and pace, then adds a small PP/PK tier bonus."
                          >
                            Power
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "trend",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Trend = current overall team rating versus that team's own previous 10-snapshot average."
                          >
                            Trend
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "sosFuture",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="SoS Future = the same BCS-style schedule formula, but for upcoming opponents."
                          >
                            SoS Future
                          </abbr>
                        )
                      })}
                      <th scope="col">Why moving</th>
                    </tr>
                  ) : (
                    <tr>
                      {renderSortButton({ key: "rank", label: "#" })}
                      {renderSortButton({ key: "team", label: "Team" })}
                      {renderSortButton({
                        key: "power",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Power Score blends offense, defense, and pace, then adds a small PP/PK tier bonus."
                          >
                            Power
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "sosPast",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="SoS Past = BCS-style schedule strength from games already played."
                          >
                            SoS Past
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "sosFuture",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="SoS Future = the same BCS-style schedule formula, but for upcoming opponents."
                          >
                            SoS Future
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "power",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Offense = 70% expected goals for rate, 20% shots for rate, and 10% actual goals for rate."
                          >
                            Offense
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "defense",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Defense = 70% expected goals against rate, 20% shots against rate, and 10% actual goals against rate, flipped so lower against is better."
                          >
                            Defense
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "pace",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Pace reflects how fast a team's games are played based on shot-attempt volume."
                          >
                            Pace
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "trend",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Trend compares the current overall team rating to that team's own previous 10-snapshot average."
                          >
                            Trend
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "pp",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Power-play tier with current league rank and PP percentage."
                          >
                            PP
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "pk",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Penalty-kill tier with current league rank and PK percentage."
                          >
                            PK
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "scoring",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Scoring = goals scored versus expected goals."
                          >
                            Scoring
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "goaltending",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Goaltending = expected goals against versus actual goals against."
                          >
                            Goaltending
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "chanceGeneration",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Chance Generation = share of high-danger chances created versus allowed."
                          >
                            Chance Gen
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "discipline",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Discipline = penalties drawn per 60 minus penalties taken per 60."
                          >
                            Discipline
                          </abbr>
                        )
                      })}
                      {renderSortButton({
                        key: "puckLuck",
                        label: (
                          <abbr
                            className={styles.metricHeader}
                            title="Puck Luck uses PDO, which combines shooting percentage and save percentage."
                          >
                            Puck Luck
                          </abbr>
                        )
                      })}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {displayedRatings.map((team) => (
                    <tr
                      key={`${team.teamAbbr}-${team.date}`}
                      className={
                        activeTeamAbbr === team.teamAbbr ? styles.tableRowActive : ""
                      }
                      onMouseEnter={() => setActiveTeamAbbr(team.teamAbbr)}
                      onMouseLeave={() => setActiveTeamAbbr(null)}
                    >
                      <td className={styles.rankCell}>
                        {powerRankByTeam.get(team.teamAbbr) ?? "—"}
                      </td>
                      <td className={styles.teamCell}>
                        <div className={styles.teamCellInner}>
                          <span className={styles.teamName}>
                            {team.teamAbbr}
                          </span>
                          <span className={styles.teamMeta}>
                            {getTeamName(team.teamAbbr)}
                            {team.varianceFlag === 1 && (
                              <span
                                className={styles.varianceFlagInline}
                                title="PDO is running well above or below league average."
                              >
                                ⚠︎
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className={styles.powerCell}>
                        {renderPowerPopover(team)}
                      </td>
                      {viewMode === "simple" ? (
                        <>
                          <td className={styles.sparkMetricCell}>
                            <div className={styles.sparkMetric}>
                              <span
                                className={`${styles.sparkMetricValue} ${getTrendClass(
                                  team.trend10
                                )}`}
                              >
                                {formatTrend(team.trend10)}
                              </span>
                              <OwnershipSparkline
                                points={team.trendSeries ?? []}
                                variant={team.trend10 >= 0 ? "rise" : "fall"}
                                width={88}
                                height={20}
                                baseline
                                svgClassName={styles.sparkline}
                                pathClassName={styles.sparklinePath}
                                baselineClassName={styles.sparklineBaseline}
                                emptyClassName={styles.sparklineEmpty}
                              />
                            </div>
                          </td>
                          <td className={styles.sosCell}>
                            <span
                              className={`${styles.sosPill} ${getSosClass(team.sosFuture)}`}
                              title={`SoS Future: ${formatSos(team.sosFuture)} (${formatRank(
                                team.sosFutureRank
                              )}). Higher means a tougher remaining slate.`}
                            >
                              {formatSos(team.sosFuture)}
                            </span>
                            {renderScheduleTexture(team)}
                          </td>
                          <td className={styles.narrativeCell}>
                            {team.narrative.length ? (
                              <ul className={styles.narrativeList}>
                                {team.narrative.map((bullet) => (
                                  <li key={`${team.teamAbbr}-${bullet}`}>
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className={styles.narrativeEmpty}>
                                No movement note yet.
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={styles.sosCell}>
                            <span
                              className={`${styles.sosPill} ${getSosClass(team.sosPast)}`}
                              title={`SoS Past: ${formatSos(team.sosPast)} (${formatRank(
                                team.sosPastRank
                              )}). Higher means tougher opponents already faced.`}
                            >
                              {formatSos(team.sosPast)}
                            </span>
                          </td>
                          <td className={styles.sosCell}>
                            <span
                              className={`${styles.sosPill} ${getSosClass(team.sosFuture)}`}
                              title={`SoS Future: ${formatSos(team.sosFuture)} (${formatRank(
                                team.sosFutureRank
                              )}). Higher means a tougher remaining slate.`}
                            >
                              {formatSos(team.sosFuture)}
                            </span>
                            {renderScheduleTexture(team)}
                          </td>
                          <td className={styles.componentCell}>
                            {renderOffensePopover(team)}
                          </td>
                          <td className={styles.componentCell}>
                            {renderDefensePopover(team)}
                          </td>
                          <td className={styles.componentCell}>
                            {renderPacePopover(team)}
                          </td>
                          <td className={styles.sparkMetricCell}>
                            <div className={styles.sparkMetric}>
                              <span
                                className={`${styles.sparkMetricValue} ${getTrendClass(
                                  team.trend10
                                )}`}
                              >
                                {formatTrend(team.trend10)}
                              </span>
                              <OwnershipSparkline
                                points={team.trendSeries ?? []}
                                variant={team.trend10 >= 0 ? "rise" : "fall"}
                                width={88}
                                height={20}
                                baseline
                                svgClassName={styles.sparkline}
                                pathClassName={styles.sparklinePath}
                                baselineClassName={styles.sparklineBaseline}
                                emptyClassName={styles.sparklineEmpty}
                              />
                            </div>
                          </td>
                          <td className={styles.specialTeamCell}>
                            <span
                              className={`${styles.tierBadge} ${resolveTierClass(team.ppTier)}`}
                              title={`${tierLabels[team.ppTier]} · ${formatRank(
                                team.ppRank
                              )} · ${formatPct(team.ppPct)}`}
                            >
                              {tierTableLabels[team.ppTier]}
                            </span>
                            <span className={styles.specialTeamMeta}>
                              {formatRank(team.ppRank)} ·{" "}
                              {formatPct(team.ppPct)}
                            </span>
                          </td>
                          <td className={styles.specialTeamCell}>
                            <span
                              className={`${styles.tierBadge} ${resolveTierClass(team.pkTier)}`}
                              title={`${tierLabels[team.pkTier]} · ${formatRank(
                                team.pkRank
                              )} · ${formatPct(team.pkPct)}`}
                            >
                              {tierTableLabels[team.pkTier]}
                            </span>
                            <span className={styles.specialTeamMeta}>
                              {formatRank(team.pkRank)} ·{" "}
                              {formatPct(team.pkPct)}
                            </span>
                          </td>
                          <td className={styles.componentCell}>
                            {renderScoringPopover(team)}
                          </td>
                          <td className={styles.componentCell}>
                            {renderGoaltendingPopover(team)}
                          </td>
                          <td className={styles.componentCell}>
                            <MetricPopover
                              label="Chance Generation"
                              summary={
                                <span
                                  className={`${styles.componentBadge} ${getComponentBadgeClass(
                                    team.dangerRating
                                  )}`}
                                >
                                  {formatOptionalRating(team.dangerRating)}
                                </span>
                              }
                            >
                              <p>
                                Higher is better. This score tracks the share of
                                high-danger chances tilted toward the team.
                              </p>
                              <ul className={styles.popoverList}>
                                <li>
                                  Current score:{" "}
                                  {formatOptionalRating(team.dangerRating)}
                                </li>
                                <li>League-average score is 100.</li>
                              </ul>
                            </MetricPopover>
                          </td>
                          <td className={styles.componentCell}>
                            <MetricPopover
                              label="Discipline"
                              summary={
                                <span
                                  className={`${styles.componentBadge} ${getComponentBadgeClass(
                                    team.disciplineRating
                                  )}`}
                                >
                                  {formatOptionalRating(team.disciplineRating)}
                                </span>
                              }
                            >
                              <p>
                                Higher is better. Formula: penalties drawn per
                                60 minus penalties taken per 60.
                              </p>
                              <ul className={styles.popoverList}>
                                <li>
                                  Current score:{" "}
                                  {formatOptionalRating(team.disciplineRating)}
                                </li>
                                <li>League-average score is 100.</li>
                              </ul>
                            </MetricPopover>
                          </td>
                          <td className={styles.sparkMetricCell}>
                            <div className={styles.sparkMetric}>
                              {renderPuckLuckPopover(team)}
                              <OwnershipSparkline
                                points={team.luckSeries ?? []}
                                variant={
                                  team.luckStatus === "cold" ? "fall" : "rise"
                                }
                                width={88}
                                height={20}
                                baseline
                                svgClassName={styles.sparkline}
                                pathClassName={styles.sparklinePath}
                                baselineClassName={styles.sparklineBaseline}
                                emptyClassName={styles.sparklineEmpty}
                              />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  try {
    const requestedDate =
      typeof context.query.date === "string" ? context.query.date : undefined;
    const supabase = supabaseServer;
    const availableDates = await fetchDistinctUnderlyingStatsSnapshotDates(
      90,
      supabase
    );
    const [snapshot, routeStatus] = await Promise.all([
      resolveUnderlyingStatsLandingSnapshot({
        requestedDate,
        availableDates
      }),
      fetchUlsRouteStatus(supabase)
    ]);

    return {
      props: {
        availableDates,
        initialSnapshot: snapshot,
        routeStatus
      }
    };
  } catch (error) {
    console.error("Failed to load team power rankings", error);
    return {
      props: {
        availableDates: [],
        initialSnapshot: {
          dashboard: {
            context: [],
            fallers: [],
            inefficiency: { overvalued: [], undervalued: [] },
            quadrant: {
              averageDefenseProcess: 0,
              averageOffenseProcess: 0,
              axisSubtitle: "Offensive process vs defensive process",
              points: []
            },
            risers: [],
            sustainability: {
              buyLow: [],
              heatCheck: [],
              processBacked: []
            }
          },
          requestedDate: null,
          resolvedDate: null,
          ratings: []
        },
        routeStatus: null
      }
    };
  }
};

export default TeamPowerRankingsPage;
