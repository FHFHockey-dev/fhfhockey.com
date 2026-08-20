import { createHash } from "crypto";

export const YAHOO_LIVE_DRAFT_GAME_KEY = "477";
export const YAHOO_LIVE_DRAFT_SEASON = "2026";
export const YAHOO_LIVE_DRAFT_TARGET_SEASON_ID = 20262027;
export const YAHOO_FANTASY_API_BASE_URL =
  "https://fantasysports.yahooapis.com/fantasy/v2";

export type YahooDraftProviderStatus =
  | "predraft"
  | "drafting"
  | "postdraft"
  | "unknown";
export type YahooDraftSessionStatus =
  | "predraft"
  | "active"
  | "stopped"
  | "complete"
  | "error"
  | "reauth_required";
export type YahooDraftOrder = "snake" | "straight";

export type YahooDraftPick = {
  pickNumber: number;
  roundNumber: number;
  yahooTeamKey: string;
  yahooPlayerKey: string;
  yahooPlayerId: string;
  playerName: string | null;
  nhlTeamAbbreviation: string | null;
  position: string | null;
  cost: number | null;
};

export type YahooDraftSettings = {
  teamCount: number | null;
  isSnakeDraft: boolean;
  rosterConfig: Record<string, number>;
  leagueType: "points" | "categories";
  scoringCategories: Record<string, number>;
  categoryWeights: Record<string, number>;
  draftOrder: YahooDraftOrder;
  requiresConfirmation: boolean;
  requiresScoringConfirmation: boolean;
  requiresDraftOrderConfirmation: boolean;
  normalized: {
    gameKey: typeof YAHOO_LIVE_DRAFT_GAME_KEY;
    season: typeof YAHOO_LIVE_DRAFT_SEASON;
    providerStatus: YahooDraftProviderStatus;
    draftOrder: YahooDraftOrder;
    draftType: "live_standard" | "offline" | "autopick" | "unknown";
    teamCount: number | null;
    rosterSize: number | null;
    pickTimeSeconds: number | null;
    draftTime: string | null;
  };
  diagnostics: {
    source: "yahoo_fantasy_api";
    leagueKeyMatched: boolean;
    draftStatusRaw: string | null;
    draftTypeRaw: string | null;
    draftOrderRaw: string | boolean | number | null;
    isAuctionDraftRaw: string | boolean | number | null;
    inferredDraftOrder: boolean;
    warnings: string[];
    unsupportedRosterSlots: string[];
    unsupportedStatIds: string[];
    excludedInjurySlots: Record<string, number>;
    draftPositionsComplete: boolean;
    draftPositionIssues: string[];
    scoringTypeRaw: string | null;
    scoringTypeRecognized: boolean;
  };
};

export type YahooDraftTeam = {
  yahooTeamKey: string;
  name: string | null;
  draftPosition: number | null;
  isOwned: boolean;
};

export type YahooDraftSnapshot = {
  providerStatus: YahooDraftProviderStatus;
  leagueKey: string | null;
  picks: YahooDraftPick[];
};

export class YahooLiveDraftError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "YahooLiveDraftError";
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : null;
}

function findFirstScalar(
  value: unknown,
  keys: readonly string[],
): string | number | boolean | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstScalar(item, keys);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  for (const key of keys) {
    const found = scalar(value[key]);
    if (found !== null) return found;
  }
  for (const child of Object.values(value)) {
    const found = findFirstScalar(child, keys);
    if (found !== null) return found;
  }
  return null;
}

function entityScalar(
  value: unknown,
  keys: readonly string[],
): string | number | boolean | null {
  if (isRecord(value)) {
    for (const key of keys) {
      const found = scalar(value[key]);
      if (found !== null) return found;
    }
    return null;
  }
  if (!Array.isArray(value)) return null;
  for (const child of value) {
    if (!isRecord(child)) continue;
    for (const key of keys) {
      const found = scalar(child[key]);
      if (found !== null) return found;
    }
  }
  return null;
}

function collectEntities(value: unknown, discriminator: string) {
  const entities: unknown[] = [];
  const visit = (candidate: unknown) => {
    if (entityScalar(candidate, [discriminator]) !== null) {
      entities.push(candidate);
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
    } else if (isRecord(candidate)) {
      Object.values(candidate).forEach(visit);
    }
  };
  visit(value);
  return entities;
}

function toInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toText(value: unknown) {
  const found = scalar(value);
  return found === null ? null : String(found);
}

function isTruthyYahooValue(value: unknown) {
  if (value === true || value === 1) return true;
  return typeof value === "string" &&
    ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function findFirstValue(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstValue(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findFirstValue(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

const YAHOO_STAT_KEY_BY_ID: Record<string, string> = {
  "1": "GOALS",
  "2": "ASSISTS",
  "3": "POINTS",
  "4": "PLUS_MINUS",
  "5": "PENALTY_MINUTES",
  "6": "PP_GOALS",
  "7": "PP_ASSISTS",
  "8": "PP_POINTS",
  "9": "SH_GOALS",
  "10": "SH_ASSISTS",
  "11": "SH_POINTS",
  "12": "GAME_WINNING_GOALS",
  "14": "SHOTS_ON_GOAL",
  "15": "SHOOTING_PERCENTAGE",
  "16": "FACEOFFS_WON",
  "17": "FACEOFFS_LOST",
  "18": "GAMES_STARTED",
  "19": "WINS_GOALIE",
  "20": "LOSSES_GOALIE",
  "22": "GOALS_AGAINST_GOALIE",
  "23": "GOALS_AGAINST_AVERAGE",
  "24": "SHOTS_AGAINST_GOALIE",
  "25": "SAVES_GOALIE",
  "26": "SAVE_PERCENTAGE",
  "27": "SHUTOUTS_GOALIE",
  "31": "HITS",
  "32": "BLOCKED_SHOTS",
  "34": "TIME_ON_ICE_PER_GAME",
};

const YAHOO_STAT_KEY_BY_LABEL: Record<string, string> = {
  G: "GOALS",
  GOAL: "GOALS",
  GOALS: "GOALS",
  A: "ASSISTS",
  ASSIST: "ASSISTS",
  ASSISTS: "ASSISTS",
  P: "POINTS",
  PTS: "POINTS",
  POINTS: "POINTS",
  PLUS: "PLUS_MINUS",
  PLUSMINUS: "PLUS_MINUS",
  PIM: "PENALTY_MINUTES",
  PENALTYMINUTES: "PENALTY_MINUTES",
  PPG: "PP_GOALS",
  POWERPLAYGOALS: "PP_GOALS",
  PPA: "PP_ASSISTS",
  POWERPLAYASSISTS: "PP_ASSISTS",
  PPP: "PP_POINTS",
  POWERPLAYPOINTS: "PP_POINTS",
  SHP: "SH_POINTS",
  SHORTHANDEDPOINTS: "SH_POINTS",
  SHG: "SH_GOALS",
  SHORTHANDEDGOALS: "SH_GOALS",
  SHA: "SH_ASSISTS",
  SHORTHANDEDASSISTS: "SH_ASSISTS",
  GWG: "GAME_WINNING_GOALS",
  GAMEWINNINGGOALS: "GAME_WINNING_GOALS",
  SOG: "SHOTS_ON_GOAL",
  SHOTSONGOAL: "SHOTS_ON_GOAL",
  SHPERCENT: "SHOOTING_PERCENTAGE",
  SHOOTINGPERCENTAGE: "SHOOTING_PERCENTAGE",
  HIT: "HITS",
  HITS: "HITS",
  BLK: "BLOCKED_SHOTS",
  BLOCKEDSHOTS: "BLOCKED_SHOTS",
  FW: "FACEOFFS_WON",
  FACEOFFSWON: "FACEOFFS_WON",
  FL: "FACEOFFS_LOST",
  FACEOFFSLOST: "FACEOFFS_LOST",
  GS: "GAMES_STARTED",
  GAMESSTARTED: "GAMES_STARTED",
  W: "WINS_GOALIE",
  WINS: "WINS_GOALIE",
  L: "LOSSES_GOALIE",
  LOSSES: "LOSSES_GOALIE",
  GA: "GOALS_AGAINST_GOALIE",
  GOALSAGAINST: "GOALS_AGAINST_GOALIE",
  GAA: "GOALS_AGAINST_AVERAGE",
  GOALSAGAINSTAVERAGE: "GOALS_AGAINST_AVERAGE",
  SA: "SHOTS_AGAINST_GOALIE",
  SHOTSAGAINST: "SHOTS_AGAINST_GOALIE",
  SV: "SAVES_GOALIE",
  SAVES: "SAVES_GOALIE",
  SVPERCENT: "SAVE_PERCENTAGE",
  SAVEPERCENTAGE: "SAVE_PERCENTAGE",
  SHO: "SHUTOUTS_GOALIE",
  SHUTOUTS: "SHUTOUTS_GOALIE",
  TOIG: "TIME_ON_ICE_PER_GAME",
  TIMEONICEPERGAME: "TIME_ON_ICE_PER_GAME",
};

function rosterPositionRows(payload: unknown) {
  const source = findFirstValue(payload, ["roster_positions"]);
  return collectEntities(source, "position").flatMap((entity) => {
    const position = toText(entityScalar(entity, ["position"]));
    const count = toInteger(entityScalar(entity, ["count"])) ?? 0;
    return position && count > 0 ? [{ position, count }] : [];
  });
}

function statCategoryRows(payload: unknown) {
  const source = findFirstValue(payload, ["stat_categories"]);
  return collectEntities(source, "stat_id").flatMap((entity) => {
    const statId = toText(entityScalar(entity, ["stat_id"]));
    const abbreviation = toText(
      entityScalar(entity, ["abbr", "display_name", "name"]),
    );
    return statId ? [{ statId, abbreviation }] : [];
  });
}

function statModifierRows(payload: unknown) {
  const source = findFirstValue(payload, ["stat_modifiers"]);
  return collectEntities(source, "stat_id").flatMap((entity) => {
    const statId = toText(entityScalar(entity, ["stat_id"]));
    const value = toNumber(entityScalar(entity, ["value"]));
    return statId && value !== null ? [{ statId, value }] : [];
  });
}

function adaptRosterConfig(payload: unknown) {
  const rosterConfig: Record<string, number> = {};
  const excludedInjurySlots: Record<string, number> = {};
  const unsupportedRosterSlots = new Set<string>();
  const aliases: Record<string, string> = {
    BN: "bench",
    BENCH: "bench",
    UTIL: "utility",
    UTILITY: "utility",
    C: "C",
    LW: "LW",
    RW: "RW",
    W: "W",
    F: "FWD",
    FWD: "FWD",
    D: "D",
    G: "G",
  };
  for (const row of rosterPositionRows(payload)) {
    const normalizedPosition = row.position.trim().toUpperCase();
    if (["IR", "IR+", "IR-LT", "NA"].includes(normalizedPosition)) {
      excludedInjurySlots[row.position] =
        (excludedInjurySlots[row.position] ?? 0) + row.count;
      continue;
    }
    const target = aliases[normalizedPosition];
    if (!target) {
      unsupportedRosterSlots.add(row.position);
      continue;
    }
    rosterConfig[target] = (rosterConfig[target] ?? 0) + row.count;
  }
  if (!("bench" in rosterConfig)) rosterConfig.bench = 0;
  if (!("utility" in rosterConfig)) rosterConfig.utility = 0;
  return {
    rosterConfig,
    excludedInjurySlots,
    unsupportedRosterSlots: [...unsupportedRosterSlots].sort(),
  };
}

function adaptScoring(payload: unknown) {
  const scoringType = String(
    findFirstScalar(payload, ["scoring_type"]) ?? "",
  ).toLowerCase();
  const leagueType: "points" | "categories" = scoringType.includes("point")
    ? "points"
    : "categories";
  const scoringTypeRecognized =
    scoringType.includes("point") ||
    scoringType.includes("head") ||
    scoringType.includes("roto");
  const scoringCategories: Record<string, number> = {};
  const categoryWeights: Record<string, number> = {};
  const unsupportedStatIds = new Set<string>();
  const categories = statCategoryRows(payload);
  const modifiers = new Map(
    statModifierRows(payload).map(({ statId, value }) => [statId, value]),
  );
  for (const { statId, abbreviation } of categories) {
    const labelKey = String(abbreviation ?? "")
      .toUpperCase()
      .replace(/\+\/-/g, "PLUSMINUS")
      .replace(/%/g, "PERCENT")
      .replace(/[^A-Z0-9]+/g, "");
    const byLabel = YAHOO_STAT_KEY_BY_LABEL[labelKey];
    const byId = YAHOO_STAT_KEY_BY_ID[statId];
    const statKey = byLabel ? (byId === byLabel ? byLabel : undefined) : byId;
    if (!statKey) {
      unsupportedStatIds.add(statId);
      continue;
    }
    if (byLabel && byId && byLabel !== byId) {
      unsupportedStatIds.add(statId);
      continue;
    }
    if (leagueType === "points") {
      const modifier = modifiers.get(statId);
      if (modifier === undefined) unsupportedStatIds.add(statId);
      else scoringCategories[statKey] = modifier;
    } else {
      categoryWeights[statKey] = 1;
    }
  }
  return {
    leagueType,
    scoringCategories,
    categoryWeights,
    unsupportedStatIds: [...unsupportedStatIds].sort(),
    scoringTypeRaw: scoringType || null,
    scoringTypeRecognized,
  };
}

export function assertYahooLeagueKey(value: string) {
  if (!new RegExp(`^${YAHOO_LIVE_DRAFT_GAME_KEY}\\.l\\.\\d+$`).test(value)) {
    throw new YahooLiveDraftError(
      "This Yahoo league is not part of the 2026-2027 NHL game.",
      409,
      "yahoo_game_mismatch",
    );
  }
  return value;
}

export function parseYahooProviderStatus(value: unknown): YahooDraftProviderStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (["predraft", "pre", "notstarted"].includes(normalized)) return "predraft";
  if (["drafting", "inprogress", "started"].includes(normalized)) return "drafting";
  if (["postdraft", "complete", "completed"].includes(normalized)) return "postdraft";
  return "unknown";
}

export function sessionStatusForProvider(
  providerStatus: YahooDraftProviderStatus,
): YahooDraftSessionStatus {
  if (providerStatus === "drafting") return "active";
  if (providerStatus === "postdraft") return "complete";
  return "predraft";
}

export function parseYahooDraftSettings(payload: unknown): YahooDraftSettings {
  const leagueKey = toText(findFirstScalar(payload, ["league_key"]));
  if (leagueKey) assertYahooLeagueKey(leagueKey);

  const draftStatusRaw = toText(findFirstScalar(payload, ["draft_status"]));
  const draftTypeRaw = toText(findFirstScalar(payload, ["draft_type"]));
  const draftOrderRaw = findFirstScalar(payload, [
    "draft_order_type",
    "draft_order",
    "is_snake_draft",
  ]);
  const isAuctionDraftRaw = findFirstScalar(payload, [
    "is_auction_draft",
    "is_salary_cap_draft",
  ]);
  const normalizedDraftType = String(draftTypeRaw ?? "").toLowerCase();
  if (
    isTruthyYahooValue(isAuctionDraftRaw) ||
    normalizedDraftType.includes("auction") ||
    normalizedDraftType.includes("salary")
  ) {
    throw new YahooLiveDraftError(
      "Salary-cap Yahoo drafts are not supported by the live draft companion.",
      422,
      "yahoo_salary_cap_unsupported",
    );
  }

  const normalizedOrder = String(draftOrderRaw ?? "").toLowerCase();
  const explicitlyStraight =
    normalizedOrder.includes("straight") ||
    normalizedOrder.includes("linear") ||
    normalizedOrder === "false" ||
    normalizedOrder === "no" ||
    draftOrderRaw === false ||
    draftOrderRaw === 0 ||
    draftOrderRaw === "0";
  const explicitlySnake =
    normalizedOrder.includes("snake") ||
    normalizedOrder.includes("serpentine") ||
    isTruthyYahooValue(draftOrderRaw);
  const inferredDraftOrder = !explicitlyStraight && !explicitlySnake;
  const draftOrder: YahooDraftOrder = explicitlyStraight ? "straight" : "snake";

  let draftType: YahooDraftSettings["normalized"]["draftType"] = "unknown";
  if (normalizedDraftType.includes("offline")) draftType = "offline";
  else if (normalizedDraftType.includes("auto")) draftType = "autopick";
  else if (
    normalizedDraftType.includes("live") ||
    normalizedDraftType.includes("standard")
  ) {
    draftType = "live_standard";
  }

  const warnings: string[] = [];
  if (inferredDraftOrder) {
    warnings.push("Yahoo did not expose a draft-order mode; snake order was assumed.");
  }
  if (draftType === "unknown") {
    warnings.push("Yahoo returned an unrecognized draft type.");
  }
  const roster = adaptRosterConfig(payload);
  const scoring = adaptScoring(payload);
  if (roster.unsupportedRosterSlots.length > 0) {
    warnings.push("Some Yahoo roster slots are not supported by the draft dashboard.");
  }
  if (scoring.unsupportedStatIds.length > 0) {
    warnings.push("Some Yahoo scoring stats could not be mapped automatically.");
  }
  if (!scoring.scoringTypeRecognized) {
    warnings.push("Yahoo returned an unrecognized or missing scoring type.");
  }
  if (Object.values(roster.rosterConfig).reduce((sum, count) => sum + count, 0) === 0) {
    warnings.push("Yahoo did not return a usable roster configuration.");
  }
  if (
    (scoring.leagueType === "points" &&
      Object.keys(scoring.scoringCategories).length === 0) ||
    (scoring.leagueType === "categories" &&
      Object.keys(scoring.categoryWeights).length === 0)
  ) {
    warnings.push("Yahoo did not return a complete scoring configuration.");
  }
  const teamCount = toInteger(findFirstScalar(payload, ["num_teams", "team_count"]));
  const requiresConfirmation =
    inferredDraftOrder ||
    draftType === "unknown" ||
    roster.unsupportedRosterSlots.length > 0 ||
    scoring.unsupportedStatIds.length > 0 ||
    !scoring.scoringTypeRecognized ||
    warnings.some((warning) => warning.includes("usable roster") || warning.includes("complete scoring"));
  const requiresScoringConfirmation =
    scoring.unsupportedStatIds.length > 0 ||
    !scoring.scoringTypeRecognized ||
    warnings.some((warning) => warning.includes("complete scoring"));

  return {
    teamCount,
    isSnakeDraft: draftOrder === "snake",
    rosterConfig: roster.rosterConfig,
    leagueType: scoring.leagueType,
    scoringCategories: scoring.scoringCategories,
    categoryWeights: scoring.categoryWeights,
    draftOrder,
    requiresConfirmation,
    requiresScoringConfirmation,
    requiresDraftOrderConfirmation: inferredDraftOrder,
    normalized: {
      gameKey: YAHOO_LIVE_DRAFT_GAME_KEY,
      season: YAHOO_LIVE_DRAFT_SEASON,
      providerStatus: parseYahooProviderStatus(draftStatusRaw),
      draftOrder,
      draftType,
      teamCount,
      rosterSize: Object.values(roster.rosterConfig).reduce(
        (sum, count) => sum + count,
        0,
      ),
      pickTimeSeconds: toInteger(
        findFirstScalar(payload, ["pick_time", "draft_pick_time"]),
      ),
      draftTime: toText(findFirstScalar(payload, ["draft_time"])),
    },
    diagnostics: {
      source: "yahoo_fantasy_api",
      leagueKeyMatched: leagueKey?.startsWith(`${YAHOO_LIVE_DRAFT_GAME_KEY}.l.`) ?? false,
      draftStatusRaw,
      draftTypeRaw,
      draftOrderRaw,
      isAuctionDraftRaw,
      inferredDraftOrder,
      warnings,
      unsupportedRosterSlots: roster.unsupportedRosterSlots,
      unsupportedStatIds: scoring.unsupportedStatIds,
      excludedInjurySlots: roster.excludedInjurySlots,
      draftPositionsComplete: true,
      draftPositionIssues: [],
      scoringTypeRaw: scoring.scoringTypeRaw,
      scoringTypeRecognized: scoring.scoringTypeRecognized,
    },
  };
}

export function applyYahooTeamDraftPositionDiagnostics(
  settings: YahooDraftSettings,
  teams: YahooDraftTeam[],
) {
  const expectedTeamCount = settings.teamCount ?? teams.length;
  const positions = teams.map((team) => team.draftPosition);
  const validPositions = positions.filter(
    (position): position is number =>
      Number.isInteger(position) &&
      Number(position) >= 1 &&
      Number(position) <= expectedTeamCount,
  );
  const issues: string[] = [];
  if (teams.length !== expectedTeamCount) issues.push("team_count_mismatch");
  if (validPositions.length !== teams.length) issues.push("missing_or_out_of_range");
  if (new Set(validPositions).size !== validPositions.length) issues.push("duplicate");
  if (
    validPositions.length === expectedTeamCount &&
    !Array.from({ length: expectedTeamCount }, (_, index) => index + 1).every(
      (position) => validPositions.includes(position),
    )
  ) {
    issues.push("non_contiguous");
  }
  const draftPositionsComplete = issues.length === 0;
  if (draftPositionsComplete) return settings;
  const warning =
    "Yahoo did not return a complete, unique draft position for every team.";
  return {
    ...settings,
    requiresConfirmation: true,
    requiresDraftOrderConfirmation: true,
    diagnostics: {
      ...settings.diagnostics,
      draftPositionsComplete,
      draftPositionIssues: issues,
      warnings: settings.diagnostics.warnings.includes(warning)
        ? settings.diagnostics.warnings
        : [...settings.diagnostics.warnings, warning],
    },
  };
}

export function parseYahooDraftTeams(payload: unknown): YahooDraftTeam[] {
  const byKey = new Map<string, YahooDraftTeam>();
  for (const entity of collectEntities(payload, "team_key")) {
    if (entityScalar(entity, ["pick"]) !== null) continue;
    const yahooTeamKey = toText(entityScalar(entity, ["team_key"]));
    if (!yahooTeamKey || !/^477\.l\.\d+\.t\.\d+$/.test(yahooTeamKey)) continue;
    const candidate: YahooDraftTeam = {
      yahooTeamKey,
      name: toText(entityScalar(entity, ["name", "team_name"])),
      draftPosition: toInteger(
        entityScalar(entity, ["draft_position", "draft_order"]),
      ),
      isOwned: isTruthyYahooValue(
        entityScalar(entity, ["is_owned_by_current_login", "is_owned"]),
      ),
    };
    const existing = byKey.get(yahooTeamKey);
    if (!existing || (!existing.name && candidate.name)) byKey.set(yahooTeamKey, candidate);
  }
  return [...byKey.values()];
}

export function parseYahooDraftResults(payload: unknown): YahooDraftSnapshot {
  const leagueKey = toText(findFirstScalar(payload, ["league_key"]));
  if (leagueKey) assertYahooLeagueKey(leagueKey);
  const providerStatus = parseYahooProviderStatus(
    findFirstScalar(payload, ["draft_status"]),
  );
  const picksByNumber = new Map<number, YahooDraftPick>();

  for (const entity of collectEntities(payload, "pick")) {
    const pickNumber = toInteger(entityScalar(entity, ["pick"]));
    const yahooPlayerKey = toText(entityScalar(entity, ["player_key"]));
    const yahooTeamKey = toText(entityScalar(entity, ["team_key"]));
    if (!pickNumber || !yahooPlayerKey || !yahooTeamKey) continue;

    const playerMatch = /^477\.p\.(\d+)$/.exec(yahooPlayerKey);
    if (!playerMatch || !/^477\.l\.\d+\.t\.\d+$/.test(yahooTeamKey)) {
      throw new YahooLiveDraftError(
        "Yahoo returned a draft result from a different game.",
        502,
        "yahoo_draft_response_invalid",
      );
    }
    const roundNumber = toInteger(entityScalar(entity, ["round"]));
    if (!roundNumber) {
      throw new YahooLiveDraftError(
        "Yahoo returned a draft pick without a round number.",
        502,
        "yahoo_draft_response_invalid",
      );
    }
    picksByNumber.set(pickNumber, {
      pickNumber,
      roundNumber,
      yahooTeamKey,
      yahooPlayerKey,
      yahooPlayerId: playerMatch[1],
      playerName: toText(entityScalar(entity, ["name", "player_name"])),
      nhlTeamAbbreviation: toText(
        entityScalar(entity, ["editorial_team_abbr", "editorial_team_abbreviation"]),
      ),
      position: toText(entityScalar(entity, ["display_position", "position"])),
      cost: toNumber(entityScalar(entity, ["cost", "auction_cost"])),
    });
  }

  return {
    providerStatus,
    leagueKey,
    picks: [...picksByNumber.values()].sort(
      (left, right) => left.pickNumber - right.pickNumber,
    ),
  };
}

export function hashYahooDraftSnapshot(
  snapshot: YahooDraftSnapshot,
  resolvedPicks?: Array<Record<string, unknown>>,
) {
  const canonical = {
    providerStatus: snapshot.providerStatus,
    picks: resolvedPicks
      ? [...resolvedPicks]
          .sort(
            (left, right) =>
              Number(left.pick_number ?? 0) - Number(right.pick_number ?? 0),
          )
          .map((pick) => ({
            pickNumber: pick.pick_number,
            roundNumber: pick.round_number,
            pickInRound: pick.pick_in_round,
            yahooTeamKey: pick.yahoo_team_key,
            externalTeamId: pick.external_team_id,
            yahooPlayerKey: pick.yahoo_player_key,
            yahooPlayerId: pick.yahoo_player_id,
            fhfhPlayerId: pick.fhfh_player_id,
            mappingStatus: pick.mapping_status,
            playerName: pick.player_name,
            nhlTeamAbbreviation: pick.nhl_team_abbreviation,
            position: pick.position,
            cost: pick.auction_cost,
          }))
      : [...snapshot.picks]
          .sort((left, right) => left.pickNumber - right.pickNumber)
          .map((pick) => ({
            pickNumber: pick.pickNumber,
            roundNumber: pick.roundNumber,
            yahooTeamKey: pick.yahooTeamKey,
            yahooPlayerKey: pick.yahooPlayerKey,
            cost: pick.cost,
          })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function parseRetryAfterSeconds(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - now.getTime()) / 1000));
}

export function yahooDraftPollDelaySeconds(args: {
  providerStatus: YahooDraftProviderStatus;
  consecutiveFailures?: number;
  retryAfterSeconds?: number | null;
}) {
  const failures = Math.max(0, Math.floor(args.consecutiveFailures ?? 0));
  const baseline = args.providerStatus === "drafting" ? 5 : 30;
  const exponential = failures > 0 ? Math.min(60, 5 * 2 ** (failures - 1)) : baseline;
  const retryAfter = Math.max(0, Math.ceil(args.retryAfterSeconds ?? 0));
  return Math.max(failures > 0 ? 0 : baseline, exponential, retryAfter);
}

export function yahooLeagueDraftUrl(yahooLeagueKey: string) {
  assertYahooLeagueKey(yahooLeagueKey);
  const leagueId = yahooLeagueKey.split(".").at(-1);
  return `https://hockey.fantasysports.yahoo.com/hockey/${leagueId}/draft`;
}

export function yahooFantasyResourceUrl(
  yahooLeagueKey: string,
  resource: "settings" | "teams" | "draftresults",
) {
  assertYahooLeagueKey(yahooLeagueKey);
  return `${YAHOO_FANTASY_API_BASE_URL}/league/${encodeURIComponent(
    yahooLeagueKey,
  )}/${resource}?format=json_f`;
}
