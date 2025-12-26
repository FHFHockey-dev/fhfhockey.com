type Strength = "es" | "pp" | "pk";

export type SituationDigits = {
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

export function parseSituationDigits(
  situationCode: string | null | undefined
): SituationDigits | null {
  if (!situationCode) return null;
  const s = situationCode.trim();
  if (s.length !== 4) return null;
  // NHL "situationCode" format: A G / A S / H S / H G
  // Examples:
  // - "1551" => away goalie=1, away skaters=5, home skaters=5, home goalie=1 (5v5)
  // - "1541" => away on PP (5v4), home on PK (4v5)
  const awayGoalie = Number(s[0]);
  const awaySkaters = Number(s[1]);
  const homeSkaters = Number(s[2]);
  const homeGoalie = Number(s[3]);
  if (
    !Number.isFinite(awaySkaters) ||
    !Number.isFinite(homeSkaters) ||
    !Number.isFinite(awayGoalie) ||
    !Number.isFinite(homeGoalie)
  ) {
    return null;
  }
  return { awayGoalie, awaySkaters, homeSkaters, homeGoalie };
}

export function strengthForTeam(
  digits: SituationDigits | null,
  teamId: number,
  homeTeamId: number,
  awayTeamId: number
): Strength {
  if (!digits) return "es";
  const isHome = teamId === homeTeamId;
  const mySkaters = isHome ? digits.homeSkaters : digits.awaySkaters;
  const oppSkaters = isHome ? digits.awaySkaters : digits.homeSkaters;
  if (mySkaters > oppSkaters) return "pp";
  if (mySkaters < oppSkaters) return "pk";
  return "es";
}
