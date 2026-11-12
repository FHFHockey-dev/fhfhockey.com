import type { TeamWeekData } from "./PlayerPickupTable";

/** Largest boost or dilution (±25%). */
export const TEAM_BOOST_INTENSITY = 0.25;

/**
 * Frozen reference scale (BC W1-12 D1, decision 56): Week Score points that
 * reach the full ±25%, about one extra game that is also an off-night
 * (6 + 4). A presentation choice to fit later (rule 12); min-max over the
 * remaining teams blew tiny schedule differences up to the full spread.
 */
export const TEAM_BOOST_REFERENCE_HALF_RANGE = 10;

export type TeamWindowStatus = "active" | "idle" | "unknown";

export type TeamBoostEntry = {
  status: TeamWindowStatus;
  /** Null for an idle team: its in-window contribution is 0, not a dilution. */
  multiplier: number | null;
};

/**
 * Team boost from the selected window's Week Scores (decision 56).
 * - active: the team has games in the window; boosted around the mean of the
 *   active teams on the frozen reference scale.
 * - idle: a loaded (verified) schedule with no games left; excluded from the
 *   normalisation and kept visible, ranked after players with usable games.
 * - unknown: no schedule row or no score for the team; no boost, never 0.
 */
export function buildTeamBoost(
  teamWeekData: readonly TeamWeekData[] | undefined
): Map<string, TeamBoostEntry> {
  const boost = new Map<string, TeamBoostEntry>();
  if (!teamWeekData?.length) return boost;

  const active = teamWeekData.filter(
    (team) =>
      team.gamesPlayed > 0 &&
      typeof team.weekScore === "number" &&
      Number.isFinite(team.weekScore)
  );
  const center = active.length
    ? active.reduce((sum, team) => sum + (team.weekScore as number), 0) /
      active.length
    : 0;

  teamWeekData.forEach((team) => {
    if (team.gamesPlayed === 0) {
      boost.set(team.teamAbbreviation, { status: "idle", multiplier: null });
      return;
    }
    if (typeof team.weekScore !== "number" || !Number.isFinite(team.weekScore)) {
      boost.set(team.teamAbbreviation, { status: "unknown", multiplier: 1 });
      return;
    }
    const offset = Math.max(
      -1,
      Math.min(1, (team.weekScore - center) / TEAM_BOOST_REFERENCE_HALF_RANGE)
    );
    boost.set(team.teamAbbreviation, {
      status: "active",
      multiplier: 1 + TEAM_BOOST_INTENSITY * offset
    });
  });
  return boost;
}

export const teamBoostFor = (
  boost: Map<string, TeamBoostEntry>,
  teamAbbr: string | null | undefined
): TeamBoostEntry =>
  (teamAbbr ? boost.get(teamAbbr) : undefined) ?? {
    status: "unknown",
    multiplier: 1
  };
