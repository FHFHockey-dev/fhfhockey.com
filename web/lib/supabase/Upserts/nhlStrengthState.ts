export type EventOwnerSide = "home" | "away";
export type StrengthState = "EV" | "PP" | "SH" | "EN";

export type ParsedSituationCode = {
  raw: string;
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

export type StrengthContext = {
  strengthExact: string | null;
  strengthState: StrengthState | null;
  eventOwnerSide: EventOwnerSide | null;
};

function normalizeNumericId(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

export function parseSituationCode(
  situationCode: string | null | undefined
): ParsedSituationCode | null {
  if (!situationCode) return null;
  const raw = situationCode.trim();
  if (!/^\d{4}$/.test(raw)) return null;

  return {
    raw,
    awayGoalie: Number(raw[0]),
    awaySkaters: Number(raw[1]),
    homeSkaters: Number(raw[2]),
    homeGoalie: Number(raw[3]),
  };
}

export function formatStrengthExact(
  parsedSituation: ParsedSituationCode | null
): string | null {
  if (!parsedSituation) return null;
  return `${parsedSituation.awaySkaters}v${parsedSituation.homeSkaters}`;
}

export function getEventOwnerSide(
  ownerTeamId: number | string | null | undefined,
  homeTeamId: number | string,
  awayTeamId: number | string
): EventOwnerSide | null {
  const normalizedOwner = normalizeNumericId(ownerTeamId);
  const normalizedHome = normalizeNumericId(homeTeamId);
  const normalizedAway = normalizeNumericId(awayTeamId);

  if (normalizedOwner == null || normalizedHome == null || normalizedAway == null) {
    return null;
  }
  if (normalizedOwner === normalizedHome) return "home";
  if (normalizedOwner === normalizedAway) return "away";
  return null;
}

export function isEmptyNetSituation(
  parsedSituation: ParsedSituationCode | null
): boolean {
  return parsedSituation != null &&
    (parsedSituation.awayGoalie === 0 || parsedSituation.homeGoalie === 0);
}

export function classifyTeamStrengthState(
  parsedSituation: ParsedSituationCode | null,
  teamId: number | string | null | undefined,
  homeTeamId: number | string,
  awayTeamId: number | string
): StrengthState | null {
  if (!parsedSituation) return null;
  if (isEmptyNetSituation(parsedSituation)) return "EN";

  const teamSide = getEventOwnerSide(teamId, homeTeamId, awayTeamId);
  if (!teamSide) return null;

  const teamSkaters =
    teamSide === "home" ? parsedSituation.homeSkaters : parsedSituation.awaySkaters;
  const opponentSkaters =
    teamSide === "home" ? parsedSituation.awaySkaters : parsedSituation.homeSkaters;

  if (teamSkaters === opponentSkaters) return "EV";
  return teamSkaters > opponentSkaters ? "PP" : "SH";
}

export function buildStrengthContext(
  parsedSituation: ParsedSituationCode | null,
  ownerTeamId: number | string | null | undefined,
  homeTeamId: number | string,
  awayTeamId: number | string
): StrengthContext {
  const eventOwnerSide = getEventOwnerSide(ownerTeamId, homeTeamId, awayTeamId);

  return {
    strengthExact: formatStrengthExact(parsedSituation),
    strengthState: classifyTeamStrengthState(
      parsedSituation,
      ownerTeamId,
      homeTeamId,
      awayTeamId
    ),
    eventOwnerSide,
  };
}
