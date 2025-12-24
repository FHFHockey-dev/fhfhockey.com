type Strength = "es" | "pp" | "pk";

export type SituationDigits = {
  awaySkaters: number;
  homeSkaters: number;
  awayGoalie: number;
  homeGoalie: number;
};

export function parseSituationDigits(
  situationCode: string | null | undefined
): SituationDigits | null {
  if (!situationCode) return null;
  const s = situationCode.trim();
  if (s.length !== 4) return null;
  const awaySkaters = Number(s[0]);
  const homeSkaters = Number(s[1]);
  const awayGoalie = Number(s[2]);
  const homeGoalie = Number(s[3]);
  if (
    !Number.isFinite(awaySkaters) ||
    !Number.isFinite(homeSkaters) ||
    !Number.isFinite(awayGoalie) ||
    !Number.isFinite(homeGoalie)
  ) {
    return null;
  }
  return { awaySkaters, homeSkaters, awayGoalie, homeGoalie };
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

