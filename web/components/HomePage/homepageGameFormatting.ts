import { formatClock, localTimeZone, zonedParts } from "./homepageTime";

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

/** moment `h:mm A z` in the viewer's time zone. */
export const formatLocalStartTime = (
  startTimeUTC: string,
  timeZone = localTimeZone(),
) => {
  if (!startTimeUTC) return "";
  const start = new Date(startTimeUTC);
  if (Number.isNaN(start.getTime())) return "Invalid date";

  const parts = zonedParts(start, timeZone);
  return `${formatClock(parts)} ${parts.zoneName}`;
};

/** moment `M-D-YYYY | hA z`, or `h:mmA z` off the hour, in the viewer's time zone. */
export const formatLocalPlayoffStart = (
  startTimeUTC: string,
  timeZone = localTimeZone(),
) => {
  if (!startTimeUTC) return "TBD";
  const start = new Date(startTimeUTC);
  if (Number.isNaN(start.getTime())) return "Invalid date | Invalid date";

  const parts = zonedParts(start, timeZone);
  const minutes = parts.minute === 0 ? "" : `:${String(parts.minute).padStart(2, "0")}`;
  return `${parts.month}-${parts.day}-${parts.year} | ${parts.hour12}${minutes}${parts.dayPeriod} ${parts.zoneName}`;
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
