import type { HomepageGameAnalytics } from "lib/homepageGameAnalytics";
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
  edgeAvailable: boolean;
  probabilitiesAvailable: boolean;
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
  const edgeAvailable = Boolean(
    group === "scheduled" &&
      analytics?.predictionFreshness !== "stale" &&
      analytics?.edgeTeamAbbreviation &&
      typeof analytics.edgePercentagePoints === "number",
  );
  const probabilitiesAvailable = Boolean(
    group === "scheduled" &&
      analytics?.predictionFreshness !== "stale" &&
      typeof analytics?.awayWinProbability === "number" &&
      typeof analytics.homeWinProbability === "number",
  );
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
  const matchupLabel = `${awayTeam.abbrev} at ${homeTeam.abbrev}, ${stateLabel}${
    probabilitiesAvailable
      ? `, pregame win probability ${awayTeam.abbrev} ${Math.round(
          analytics!.awayWinProbability! * 100,
        )} percent, ${homeTeam.abbrev} ${Math.round(
          analytics!.homeWinProbability! * 100,
        )} percent`
      : ""
  }`;

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
    edgeAvailable,
    probabilitiesAvailable,
    projectedGoalsAvailable,
    xgAvailable,
    shotsAvailable,
    starterAvailable,
    matchupLabel,
  };
};
