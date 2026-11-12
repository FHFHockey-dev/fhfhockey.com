import type { HomepageGameAnalytics } from "lib/homepageGameAnalytics";
import {
  displayedWinPair,
  type HomepageDisplayedWinPair,
} from "./homepageWinPair";
import {
  formatPeriodText,
  getDisplayGameState,
  isFinalGameState,
  isLiveGameState,
} from "./homepageGameFormatting";

export type HomepageSlateMode = "light" | "medium" | "heavy";
export type HomepageGameGroup = "live" | "scheduled" | "final";

type HomepageTeam = {
  abbrev: string;
  record?: string;
  score?: number;
};

export type HomepageGamePresentation = {
  game: any;
  homeTeam: HomepageTeam;
  awayTeam: HomepageTeam;
  group: HomepageGameGroup;
  broadcast: string | null;
  stateLabel: string;
  periodLabel: string | null;
  clock: string | null;
  analytics: HomepageGameAnalytics | null;
  /** The displayed win pair and pick (decision 43); null when not shown. */
  winPair: HomepageDisplayedWinPair | null;
  edgeAvailable: boolean;
  probabilitiesAvailable: boolean;
  /** Scheduled game with no qualified FHFH prediction (decision 42). */
  predictionUnavailable: boolean;
  projectedGoalsAvailable: boolean;
  xgAvailable: boolean;
  shotsAvailable: boolean;
  starterAvailable: boolean;
  matchupLabel: string;
};

export const getHomepageSlateMode = (
  gameCount: number,
): HomepageSlateMode => {
  if (gameCount <= 5) return "light";
  if (gameCount <= 11) return "medium";
  return "heavy";
};

export const getHomepageGameGroup = (
  gameState?: string,
): HomepageGameGroup => {
  if (isLiveGameState(gameState)) return "live";
  if (isFinalGameState(gameState)) return "final";
  return "scheduled";
};

export const compactHomepageMetric = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export const formatHomepageEdge = (percentagePoints: number) =>
  `${percentagePoints > 0 ? "+" : ""}${percentagePoints.toFixed(1)}pp`;

/** The edge is the FHFH model's probability minus the de-vigged market's. */
export const HOMEPAGE_EDGE_LABEL = "Model vs market";

export const HOMEPAGE_PREDICTIONS_UNAVAILABLE_NOTICE =
  "FHFH predictions unavailable while the model is developed and validated.";

/**
 * Decision 42 notice for a slate: the full notice when no scheduled game has
 * a qualified prediction, a count when only some lack one, otherwise null.
 */
export const getHomepagePredictionNotice = (
  presentations: Array<HomepageGamePresentation | null>,
): string | null => {
  const scheduled = presentations.filter(
    (presentation): presentation is HomepageGamePresentation =>
      presentation?.group === "scheduled",
  );
  const unavailable = scheduled.filter(
    (presentation) => presentation.predictionUnavailable,
  ).length;
  if (unavailable === 0) return null;
  if (unavailable === scheduled.length) {
    return HOMEPAGE_PREDICTIONS_UNAVAILABLE_NOTICE;
  }
  return `FHFH predictions unavailable for ${unavailable} of ${scheduled.length} scheduled games.`;
};

const isFreshLiveMetric = (updatedAt?: string) => {
  if (!updatedAt) return false;
  const age = Date.now() - Date.parse(updatedAt);
  return Number.isFinite(age) && age >= -60_000 && age <= 15 * 60_000;
};

export const getHomepageGamePresentation = (
  game: any,
): HomepageGamePresentation | null => {
  const homeTeam = game?.homeTeam as HomepageTeam | undefined;
  const awayTeam = game?.awayTeam as HomepageTeam | undefined;
  if (!homeTeam?.abbrev || !awayTeam?.abbrev) return null;

  const group = getHomepageGameGroup(game.gameState);
  const broadcast = game?.tvBroadcasts?.[0]?.network ?? null;
  const inIntermission = Boolean(
    game?.clock && game.clock.inIntermission !== undefined
      ? game.clock.inIntermission
      : game?.inIntermission,
  );
  const periodLabel =
    group === "live"
      ? formatPeriodText(
          game?.periodDescriptor?.number ?? game?.period ?? 1,
          game?.periodDescriptor?.periodType ?? game?.periodType ?? "REG",
          inIntermission,
        ).replace(" Period", "")
      : null;
  const clock =
    group === "live" && !inIntermission
      ? game?.clock?.timeRemaining || game?.timeRemaining || "--:--"
      : null;
  const stateLabel =
    group === "live"
      ? "Live"
      : group === "final"
        ? "Final"
        : getDisplayGameState(game.gameState);
  const analytics = (game.analytics ?? null) as HomepageGameAnalytics | null;
  const winPair =
    group === "scheduled" && analytics?.predictionFreshness !== "stale"
      ? displayedWinPair(
          analytics?.awayWinProbability,
          analytics?.homeWinProbability,
        )
      : null;
  const probabilitiesAvailable = winPair != null;
  const edgeAvailable = Boolean(
    probabilitiesAvailable &&
      analytics?.edgeTeamAbbreviation &&
      typeof analytics.edgePercentagePoints === "number",
  );
  const predictionUnavailable = group === "scheduled" && !probabilitiesAvailable;
  const projectedGoalsAvailable = Boolean(
    group === "scheduled" &&
      analytics?.projectedGoalsFreshness !== "stale" &&
      typeof analytics?.awayProjectedGoals === "number" &&
      typeof analytics.homeProjectedGoals === "number",
  );
  const xgAvailable = Boolean(
    group !== "scheduled" &&
      (group === "final" || isFreshLiveMetric(analytics?.xgUpdatedAt)) &&
      typeof analytics?.awayXg === "number" &&
      typeof analytics.homeXg === "number",
  );
  const shotsAvailable = Boolean(
    group !== "scheduled" &&
      (group === "final" || isFreshLiveMetric(analytics?.shotsUpdatedAt)) &&
      typeof analytics?.awayShotsOnGoal === "number" &&
      typeof analytics.homeShotsOnGoal === "number",
  );
  const starterAvailable = Boolean(
    group !== "final" &&
      (analytics?.awayStarter?.name || analytics?.homeStarter?.name),
  );
  const predictionLabel = winPair
    ? `, pregame win probability ${awayTeam.abbrev} ${winPair.awayPercent} percent, ${homeTeam.abbrev} ${winPair.homePercent} percent${
        winPair.pick === "tie" ? ", even" : ""
      }${
        edgeAvailable
          ? `, model vs market edge ${analytics!.edgeTeamAbbreviation} ${
              analytics!.edgePercentagePoints! > 0 ? "+" : ""
            }${analytics!.edgePercentagePoints!.toFixed(1)} percentage points`
          : ""
      }`
    : predictionUnavailable
      ? ", FHFH prediction unavailable"
      : "";
  const matchupLabel = `${awayTeam.abbrev} at ${homeTeam.abbrev}, ${stateLabel}${predictionLabel}`;

  return {
    game,
    homeTeam,
    awayTeam,
    group,
    broadcast,
    stateLabel,
    periodLabel,
    clock,
    analytics,
    winPair,
    edgeAvailable,
    probabilitiesAvailable,
    predictionUnavailable,
    projectedGoalsAvailable,
    xgAvailable,
    shotsAvailable,
    starterAvailable,
    matchupLabel,
  };
};
