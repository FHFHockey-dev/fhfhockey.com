export type EventOwnerSide = "home" | "away";
/**
 * Legacy single-label, team-relative strength state (stored as
 * `strength_state`). Derived from {@link classifyTeamManpower}:
 * `EN` = the team is attacking the opponent's empty net (decision 84);
 * otherwise the penalty-advantage state (`EV` / `PP` / `SH`).
 */
export type StrengthState = "EV" | "PP" | "SH" | "EN";

/**
 * Version of the strength classifier. v1 labelled any pulled goalie `EN` and
 * compared raw skater counts; v2 follows decisions 70 and 84 (see
 * {@link classifyTeamManpower}). Stored rows carry this in `strength_version`.
 */
export const STRENGTH_CLASSIFIER_VERSION = 2;

/** Exclusive penalty-advantage state (decisions 59, 70). */
export type ManpowerState = "ES" | "PP" | "PK";

/**
 * Team-oriented manpower and net state for one situation code.
 *
 * - `manpowerState` is exclusive: ES, PP or PK from the penalty advantage
 *   (skaters with any extra attacker removed). 4v4 and 3v3 are ES; 6v5 with no
 *   penalty is ES; 6v4 is PP. `null` for a penalty shot or shootout attempt.
 * - `ownNetEmpty` / `opponentNetEmpty` are overlapping attributes: they never
 *   create their own exclusive bucket, so ES + PP + PK still reconciles to TOI.
 */
export type TeamManpowerContext = {
  teamSide: EventOwnerSide;
  manpowerState: ManpowerState | null;
  /** Skaters on the ice, including an extra attacker. */
  teamSkaters: number;
  opponentSkaters: number;
  /** Skaters allowed by penalties: on-ice skaters minus an extra attacker. */
  teamPenaltyStrength: number;
  opponentPenaltyStrength: number;
  /** The team's own goalie is off (extra attacker or pulled goalie). */
  ownNetEmpty: boolean;
  /** The team is attacking an empty net. */
  opponentNetEmpty: boolean;
  /** Penalty shot or shootout attempt (one side has no skaters). */
  isPenaltyShot: boolean;
  /** On-ice skaters, team first (e.g. "5v4" for this team's PP). */
  strengthExactTeamFirst: string;
};

export type ParsedSituationCode = {
  raw: string;
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

/** The four situation-code digits: all that the classifiers below read. */
export type SituationCodeDigits = Omit<ParsedSituationCode, "raw">;

/** Count-table strength bucket (lower case, as stored in `*_es` / `*_pp` / `*_pk`). */
export type StrengthBucket = "es" | "pp" | "pk";

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

/**
 * A penalty shot or shootout attempt: one side has no skaters (situation
 * codes such as `1010` and `0101`). The shooter's missing goalie digit is not
 * an empty net.
 */
export function isPenaltyShotSituation(
  parsedSituation: SituationCodeDigits | null
): boolean {
  return parsedSituation != null &&
    (parsedSituation.awaySkaters === 0 || parsedSituation.homeSkaters === 0);
}

/** Either net is empty (excluding penalty-shot and shootout codes). */
export function isEmptyNetSituation(
  parsedSituation: ParsedSituationCode | null
): boolean {
  return parsedSituation != null &&
    !isPenaltyShotSituation(parsedSituation) &&
    (parsedSituation.awayGoalie === 0 || parsedSituation.homeGoalie === 0);
}

/**
 * The single manpower / net-state predicate (decision 70). Every reader that
 * splits time, shots or danger features by strength should use this rather
 * than re-parsing `strength_exact` (which is written away-first).
 */
export function classifyTeamManpower(
  parsedSituation: SituationCodeDigits | null,
  teamSide: EventOwnerSide | null
): TeamManpowerContext | null {
  if (!parsedSituation || !teamSide) return null;

  const isHome = teamSide === "home";
  const teamSkaters = isHome ? parsedSituation.homeSkaters : parsedSituation.awaySkaters;
  const opponentSkaters = isHome ? parsedSituation.awaySkaters : parsedSituation.homeSkaters;
  const teamGoalie = isHome ? parsedSituation.homeGoalie : parsedSituation.awayGoalie;
  const opponentGoalie = isHome ? parsedSituation.awayGoalie : parsedSituation.homeGoalie;
  const strengthExactTeamFirst = `${teamSkaters}v${opponentSkaters}`;

  if (isPenaltyShotSituation(parsedSituation)) {
    return {
      teamSide,
      manpowerState: null,
      teamSkaters,
      opponentSkaters,
      teamPenaltyStrength: teamSkaters,
      opponentPenaltyStrength: opponentSkaters,
      ownNetEmpty: false,
      opponentNetEmpty: false,
      isPenaltyShot: true,
      strengthExactTeamFirst,
    };
  }

  const ownNetEmpty = teamGoalie === 0;
  const opponentNetEmpty = opponentGoalie === 0;
  const teamPenaltyStrength = teamSkaters - (ownNetEmpty ? 1 : 0);
  const opponentPenaltyStrength = opponentSkaters - (opponentNetEmpty ? 1 : 0);
  const manpowerState: ManpowerState =
    teamPenaltyStrength === opponentPenaltyStrength
      ? "ES"
      : teamPenaltyStrength > opponentPenaltyStrength
        ? "PP"
        : "PK";

  return {
    teamSide,
    manpowerState,
    teamSkaters,
    opponentSkaters,
    teamPenaltyStrength,
    opponentPenaltyStrength,
    ownNetEmpty,
    opponentNetEmpty,
    isPenaltyShot: false,
    strengthExactTeamFirst,
  };
}

/**
 * The shared event-strength adapter (decision 149, Astra AF-07): the ES / PP /
 * PK count bucket for an event owned by `teamSide`, taken from
 * {@link classifyTeamManpower} so count tables and the normalized layer agree.
 *
 * `null` = a penalty-shot code (a side with no skaters, e.g. `1010` home
 * shooter, `0101` away shooter): the event counts in all-situation totals and
 * in no strength bucket. Shootout attempts share these codes but are not NHL
 * shots or goals at all, so callers drop them by period before classifying.
 */
export function classifyEventStrengthBucket(
  digits: SituationCodeDigits,
  teamSide: EventOwnerSide
): StrengthBucket | null {
  const manpowerState = classifyTeamManpower(digits, teamSide)?.manpowerState ?? null;
  if (manpowerState == null) return null;
  return manpowerState === "ES" ? "es" : manpowerState === "PP" ? "pp" : "pk";
}

/** {@link classifyTeamManpower} for a team id. */
export function classifyTeamManpowerById(
  parsedSituation: ParsedSituationCode | null,
  teamId: number | string | null | undefined,
  homeTeamId: number | string,
  awayTeamId: number | string
): TeamManpowerContext | null {
  return classifyTeamManpower(
    parsedSituation,
    getEventOwnerSide(teamId, homeTeamId, awayTeamId)
  );
}

/**
 * Re-orients a stored, away-first `strength_exact` ("{away}v{home}") so the
 * given team comes first. Returns null for anything that is not "NvM".
 */
export function orientStrengthExact(
  strengthExact: string | null | undefined,
  teamSide: EventOwnerSide | null
): string | null {
  if (!strengthExact || !teamSide) return null;
  const match = /^(\d)v(\d)$/.exec(strengthExact.trim());
  if (!match) return null;
  const [, away, home] = match;
  return teamSide === "home" ? `${home}v${away}` : `${away}v${home}`;
}

export function toLegacyStrengthState(
  context: TeamManpowerContext | null
): StrengthState | null {
  if (!context || context.manpowerState == null) return null;
  if (context.opponentNetEmpty) return "EN";
  if (context.manpowerState === "ES") return "EV";
  return context.manpowerState === "PP" ? "PP" : "SH";
}

export function classifyTeamStrengthState(
  parsedSituation: ParsedSituationCode | null,
  teamId: number | string | null | undefined,
  homeTeamId: number | string,
  awayTeamId: number | string
): StrengthState | null {
  return toLegacyStrengthState(
    classifyTeamManpowerById(parsedSituation, teamId, homeTeamId, awayTeamId)
  );
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
