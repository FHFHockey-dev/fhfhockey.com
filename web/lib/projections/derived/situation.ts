type Strength = "es" | "pp" | "pk";

export type SituationDigits = {
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

export function parseSituationDigits(
  situationCode: string | null | undefined,
): SituationDigits | null {
  if (!situationCode) return null;
  const s = situationCode.trim();
  if (!/^[01][0-6][0-6][01]$/.test(s)) return null;
  // NHL "situationCode" format: A G / A S / H S / H G
  // Examples:
  // - "1551" => away goalie=1, away skaters=5, home skaters=5, home goalie=1 (5v5)
  // - "1541" => away on PP (5v4), home on PK (4v5)
  const awayGoalie = Number(s[0]);
  const awaySkaters = Number(s[1]);
  const homeSkaters = Number(s[2]);
  const homeGoalie = Number(s[3]);
  return { awayGoalie, awaySkaters, homeSkaters, homeGoalie };
}

/**
 * Strength from the scoring/shooting team's point of view.
 *
 * A pulled goalie is replaced by an extra attacker, so each side's skater count
 * is reduced by one when its goalie digit is 0 before comparing. That keeps the
 * NHL convention: a 6v5 extra-attacker goal is even strength, a 6v4 goal scored
 * during a 5v4 penalty is still a power-play goal, and a goal into a shorthanded
 * team's empty net (5v5 on the clock, opponent goalie pulled) is a power-play
 * goal. Shootout events are not strength events at all; callers must drop them
 * with `isShootoutPlay` before calling this.
 */
export function strengthForTeam(
  digits: SituationDigits,
  teamId: number,
  homeTeamId: number,
  awayTeamId: number,
): Strength {
  if (teamId !== homeTeamId && teamId !== awayTeamId) {
    throw new Error("Situation team is not part of the scheduled game");
  }
  const isHome = teamId === homeTeamId;
  const homeEffective = digits.homeSkaters - (digits.homeGoalie === 1 ? 0 : 1);
  const awayEffective = digits.awaySkaters - (digits.awayGoalie === 1 ? 0 : 1);
  const mySkaters = isHome ? homeEffective : awayEffective;
  const oppSkaters = isHome ? awayEffective : homeEffective;
  if (mySkaters > oppSkaters) return "pp";
  if (mySkaters < oppSkaters) return "pk";
  return "es";
}

/** NHL game id digits 5-6: 01 preseason, 02 regular season, 03 playoffs. */
function gameTypeFromGameId(gameId: number): number {
  return Math.floor(gameId / 10_000) % 100;
}

/**
 * Shootout attempts are not goals, shots or assists in NHL scoring, so every
 * strength bucket must skip them. Preseason and regular-season games go to a
 * shootout after one overtime period (period 5); playoff period 5 is overtime.
 */
export function isShootoutPlay(play: {
  gameid: number;
  periodnumber: number | null;
  periodtype: string | null;
}): boolean {
  if (play.periodtype === "SO") return true;
  const gameType = gameTypeFromGameId(play.gameid);
  return (
    (gameType === 1 || gameType === 2) &&
    play.periodnumber != null &&
    play.periodnumber >= 5
  );
}
