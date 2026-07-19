type CompletedGameLengthSource = {
  gameType?: number | string | null;
  periodDescriptor?: {
    number?: number | null;
  } | null;
  clock?: {
    timeRemaining?: string | null;
  } | null;
  gameOutcome?: {
    lastPeriodType?: string | null;
  } | null;
};

function parseClockSeconds(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) {
    throw new Error("Invalid game clock");
  }
  const [minutes, seconds] = value.split(":").map(Number);
  if (seconds >= 60) throw new Error("Invalid game clock");
  return minutes * 60 + seconds;
}

export function normalizeNhlGameType(value: unknown): string {
  const gameType = Number(value);
  if (!Number.isSafeInteger(gameType) || gameType <= 0) {
    throw new Error("Invalid NHL game type");
  }
  return String(gameType);
}

export function calculateCompletedGameLengthSeconds(
  source: CompletedGameLengthSource,
): number {
  const gameType = Number(normalizeNhlGameType(source.gameType));
  const periodNumber = source.periodDescriptor?.number;
  const lastPeriodType = source.gameOutcome?.lastPeriodType;

  if (!Number.isSafeInteger(periodNumber) || (periodNumber ?? 0) <= 0) {
    throw new Error("Invalid final period number");
  }

  if (periodNumber === 3 && lastPeriodType === "REG") return 60 * 60;

  if (periodNumber === 5 && lastPeriodType === "SO") {
    if (gameType === 3)
      throw new Error("Playoff games cannot end in a shootout");
    return 65 * 60;
  }

  if ((periodNumber ?? 0) >= 4 && lastPeriodType === "OT") {
    const overtimePeriodSeconds = gameType === 3 ? 20 * 60 : 5 * 60;
    const remainingSeconds = parseClockSeconds(source.clock?.timeRemaining);
    if (remainingSeconds > overtimePeriodSeconds) {
      throw new Error("Overtime clock exceeds its period length");
    }
    const completedOvertimePeriods = (periodNumber ?? 4) - 4;
    return (
      60 * 60 +
      completedOvertimePeriods * overtimePeriodSeconds +
      (overtimePeriodSeconds - remainingSeconds)
    );
  }

  throw new Error("Unexpected completed game outcome");
}

export function formatGameLength(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new Error("Invalid game length");
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
