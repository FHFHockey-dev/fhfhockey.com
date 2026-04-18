import moment from "moment";
import "moment-timezone";

const LIVE_STATES = new Set(["LIVE", "CRIT"]);
const FINAL_STATES = new Set(["OVER", "FINAL", "OFF"]);

export const getDisplayGameState = (gameState: string) => {
  const gameStateMapping: Record<string, string> = {
    FUT: "Scheduled",
    PRE: "Pregame",
    OVER: "Final",
    FINAL: "Final",
    OFF: "Final",
    LIVE: "LIVE",
    CRIT: "Critical"
  };

  return gameStateMapping[gameState] || gameState;
};

export const formatPeriodText = (
  periodNumber: number,
  periodDescriptor: string,
  inIntermission: boolean
) => {
  if (inIntermission) return "Intermission";
  if (periodDescriptor === "OT") return "Overtime";

  const periodSuffix =
    {
      1: "st",
      2: "nd",
      3: "rd"
    }[periodNumber] || "th";

  return `${periodNumber}${periodSuffix} Period`;
};

export const formatLocalStartTime = (startTimeUTC: string) => {
  if (!startTimeUTC) return "";

  try {
    const timezone = moment.tz.guess();
    return moment.tz(startTimeUTC, "UTC").tz(timezone).format("h:mm A z");
  } catch {
    return moment.utc(startTimeUTC).local().format("h:mm A");
  }
};

export const formatLocalPlayoffStart = (startTimeUTC: string) => {
  if (!startTimeUTC) return "TBD";

  try {
    const timezone = moment.tz.guess();
    const local = moment.tz(startTimeUTC, "UTC").tz(timezone);
    const timeFormat = local.minutes() === 0 ? "hA z" : "h:mmA z";

    return `${local.format("M-D-YYYY")} | ${local.format(timeFormat)}`;
  } catch {
    const local = moment.utc(startTimeUTC).local();
    const timeFormat = local.minutes() === 0 ? "hA" : "h:mmA";

    return `${local.format("M-D-YYYY")} | ${local.format(timeFormat)}`;
  }
};

export const isLiveGameState = (gameState?: string | null) =>
  typeof gameState === "string" && LIVE_STATES.has(gameState);

export const isFinalGameState = (gameState?: string | null) =>
  typeof gameState === "string" && FINAL_STATES.has(gameState);

export const formatPlayoffCenterLine = (game: any) => {
  if (!game) return "AWAITING SCHEDULE";

  if (isFinalGameState(game.gameState)) {
    return "FINAL";
  }

  if (isLiveGameState(game.gameState)) {
    const inIntermission =
      game?.clock && game.clock.inIntermission !== undefined
        ? game.clock.inIntermission
        : game?.inIntermission;
    const periodLabel = formatPeriodText(
      game?.periodDescriptor?.number ?? game?.period ?? 1,
      game?.periodDescriptor?.periodType ?? game?.periodType ?? "REG",
      Boolean(inIntermission)
    ).toUpperCase();

    if (inIntermission) {
      return periodLabel;
    }

    const timeRemaining =
      game?.clock?.timeRemaining || game?.timeRemaining || "--:--";

    return `${periodLabel} | ${timeRemaining}`;
  }

  return formatLocalPlayoffStart(game.startTimeUTC).toUpperCase();
};
