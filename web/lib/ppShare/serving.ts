/**
 * Decision 152: PP share served from the stored calculation. One server-side flag gates every reader:
 * unless PP_SHARE_SERVING_ENABLED is exactly "true", readers keep today's behaviour (PP share withheld).
 *
 * With serving on, each team-game's pp_team_game_clock row decides what a reader may show:
 *  - available: PP time and share, share = stored player PPTOI / the row's clock_seconds;
 *  - not_applicable (a qualified clock of 0): "N/A", never 0%;
 *  - unavailable, or no row at all: the reason, and no value.
 * A missing player value or an impossible one (player PP time above the clock) stays unavailable. Nothing is capped.
 */
export const PP_NOT_APPLICABLE_LABEL = "N/A";
export const PP_CLOCK_MISSING_REASON = "No stored PP clock for this team-game yet.";
export const PP_PLAYER_ABOVE_CLOCK_REASON = "The player's stored PP time exceeds the team PP clock, so the share is withheld.";
export const PP_PLAYER_TIME_MISSING_REASON = "No stored PP time for this player in this game.";

export function ppShareServingEnabled(): boolean {
  return process.env.PP_SHARE_SERVING_ENABLED === "true";
}

export type PpClockAvailability = "available" | "not_applicable" | "unavailable";

/** One pp_team_game_clock row, as readers use it. */
export type PpTeamGameClock = {
  gameId: number;
  teamId: number;
  availability: PpClockAvailability;
  clockSeconds: number | null;
  unavailableReason: string | null;
  computedAt: string | null;
};

export type PpShareVerdict =
  | { status: "available"; clockSeconds: number; reason: null }
  | { status: "not_applicable"; clockSeconds: 0; reason: null }
  | { status: "unavailable"; clockSeconds: null; reason: string };

export const ppClockKey = (gameId: number, teamId: number) => `${gameId}:${teamId}`;

/** What a reader may show for one team-game, from its stored clock row. */
export function ppClockVerdict(clock: PpTeamGameClock | null | undefined): PpShareVerdict {
  if (!clock) return { status: "unavailable", clockSeconds: null, reason: PP_CLOCK_MISSING_REASON };
  if (clock.availability === "not_applicable" && clock.clockSeconds === 0) {
    return { status: "not_applicable", clockSeconds: 0, reason: null };
  }
  if (
    clock.availability === "available" &&
    typeof clock.clockSeconds === "number" &&
    Number.isInteger(clock.clockSeconds) &&
    clock.clockSeconds > 0
  ) {
    return { status: "available", clockSeconds: clock.clockSeconds, reason: null };
  }
  return {
    status: "unavailable",
    clockSeconds: null,
    reason: clock.unavailableReason ?? "The stored PP clock for this team-game is not usable."
  };
}

export type PpPlayerShare =
  | { status: "available"; playerSeconds: number; clockSeconds: number; share: number; reason: null }
  | { status: "not_applicable"; playerSeconds: 0; clockSeconds: 0; share: null; reason: null }
  | { status: "unavailable"; playerSeconds: null; clockSeconds: number | null; share: null; reason: string };

/**
 * A player's PP time and share for one game. playerSeconds is the stored PPTOI; pass 0 for a skater with no
 * stored row in an available team-game (the stored set is complete there), and null when it is unknown.
 */
export function ppPlayerShare(verdict: PpShareVerdict, playerSeconds: number | null): PpPlayerShare {
  if (verdict.status === "not_applicable") {
    return { status: "not_applicable", playerSeconds: 0, clockSeconds: 0, share: null, reason: null };
  }
  if (verdict.status === "unavailable") {
    return { status: "unavailable", playerSeconds: null, clockSeconds: null, share: null, reason: verdict.reason };
  }
  if (playerSeconds == null || !Number.isFinite(playerSeconds) || playerSeconds < 0) {
    return { status: "unavailable", playerSeconds: null, clockSeconds: verdict.clockSeconds, share: null,
      reason: PP_PLAYER_TIME_MISSING_REASON };
  }
  if (playerSeconds > verdict.clockSeconds) {
    return { status: "unavailable", playerSeconds: null, clockSeconds: verdict.clockSeconds, share: null,
      reason: PP_PLAYER_ABOVE_CLOCK_REASON };
  }
  return { status: "available", playerSeconds, clockSeconds: verdict.clockSeconds,
    share: playerSeconds / verdict.clockSeconds, reason: null };
}

/**
 * A live PP computation (LinemateMatrix, ShiftChart) may be shown only when its team PP seconds equal the stored,
 * qualified clock; otherwise the stored verdict's reason, or the disagreement, is shown instead.
 */
export function liveClockVerdict(stored: PpShareVerdict, liveSeconds: number | null): PpShareVerdict {
  if (stored.status !== "available") return stored;
  if (liveSeconds === stored.clockSeconds) return stored;
  return {
    status: "unavailable",
    clockSeconds: null,
    reason: `This view's power-play time (${liveSeconds ?? "unknown"} s) doesn't match the stored qualified clock (${stored.clockSeconds} s), so it is withheld.`
  };
}

type ClockRow = {
  game_id: number;
  team_id: number;
  availability: PpClockAvailability;
  clock_seconds: number | null;
  unavailable_reason: string | null;
  computed_at: string | null;
};

type Queryable = {
  from: (table: string) => any;
};

/** Reads pp_team_game_clock rows (migration 20261113220000) for the given games, 100 games per request. */
export async function readPpTeamGameClocks(client: Queryable, gameIds: number[]): Promise<PpTeamGameClock[]> {
  const ids = [...new Set(gameIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  const clocks: PpTeamGameClock[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await client
      .from("pp_team_game_clock")
      .select("game_id, team_id, availability, clock_seconds, unavailable_reason, computed_at")
      .in("game_id", ids.slice(i, i + 100));
    if (error) throw new Error(`Reading pp_team_game_clock failed: ${error.message}`);
    for (const row of (data ?? []) as ClockRow[]) {
      clocks.push({
        gameId: Number(row.game_id),
        teamId: Number(row.team_id),
        availability: row.availability,
        clockSeconds: row.clock_seconds == null ? null : Number(row.clock_seconds),
        unavailableReason: row.unavailable_reason,
        computedAt: row.computed_at
      });
    }
  }
  return clocks;
}
