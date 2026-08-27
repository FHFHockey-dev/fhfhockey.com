import { createHash } from "node:crypto";

import {
  FANTRAX_MAPPING_VERSION,
  type FantraxDiagnostics,
  type FantraxDiscoveredLeague,
  type FantraxDraftOrderType,
  type FantraxLeagueSettingsV1,
  type FantraxLeagueType,
  type FantraxOwnedTeam,
  type FantraxStoredRawSettings,
  type FantraxUnsupportedItem,
} from "./contracts";

type UnknownRecord = Record<string, unknown>;

const SKATER_GROUP_MARKERS = ["SKATING", "SKATER"];
const GOALIE_GROUP_MARKERS = ["GOALIE"];
const TEAM_GOALIE_GROUP_MARKERS = ["TEAM_GOALIE", "TEAMGOALIE"];
const SKATER_POSITION_MARKERS = new Set([
  "C",
  "CENTER",
  "LW",
  "LEFTWING",
  "RW",
  "RIGHTWING",
  "D",
  "DEFENSE",
  "DEFENCE",
  "DEFENSEMAN",
  "DEFENCEMAN",
  "F",
  "FWD",
  "FORWARD",
]);

const SKATER_STAT_ALIASES: Record<string, string> = {
  GAMESPLAYED: "GAMES_PLAYED",
  GP: "GAMES_PLAYED",
  TIMEONICE: "TOTAL_TOI",
  TOI: "TOTAL_TOI",
  GOALS: "GOALS",
  INDIVIDUALGOALS: "GOALS",
  ASSISTS: "ASSISTS",
  INDIVIDUALASSISTS: "ASSISTS",
  POINTS: "POINTS",
  INDIVIDUALPOINTS: "POINTS",
  PLUSMINUS: "PLUS_MINUS",
  SHOTSONGOAL: "SHOTS_ON_GOAL",
  SHOTS: "SHOTS_ON_GOAL",
  SOG: "SHOTS_ON_GOAL",
  HITS: "HITS",
  BLOCKEDSHOTS: "BLOCKED_SHOTS",
  BLOCKS: "BLOCKED_SHOTS",
  BLK: "BLOCKED_SHOTS",
  PENALTYMINUTES: "PENALTY_MINUTES",
  PIM: "PENALTY_MINUTES",
  POWERPLAYGOALS: "PP_GOALS",
  PPG: "PP_GOALS",
  POWERPLAYASSISTS: "PP_ASSISTS",
  PPA: "PP_ASSISTS",
  POWERPLAYPOINTS: "PP_POINTS",
  PPP: "PP_POINTS",
  SHORTHANDEDGOALS: "SH_GOALS",
  SHG: "SH_GOALS",
  SHORTHANDEDASSISTS: "SH_ASSISTS",
  SHA: "SH_ASSISTS",
  SHORTHANDEDPOINTS: "SH_POINTS",
  SHP: "SH_POINTS",
  FACEOFFSWON: "FACEOFFS_WON",
  FOW: "FACEOFFS_WON",
  FACEOFFSLOST: "FACEOFFS_LOST",
  FOL: "FACEOFFS_LOST",
  TAKEAWAYS: "TAKEAWAYS",
  TAKEAWAY: "TAKEAWAYS",
  TKA: "TAKEAWAYS",
  TK: "TAKEAWAYS",
  GIVEAWAYS: "GIVEAWAYS",
  GIVEAWAY: "GIVEAWAYS",
  GVA: "GIVEAWAYS",
  GV: "GIVEAWAYS",
  MISSEDSHOTS: "MISSED_SHOTS",
  MS: "MISSED_SHOTS",
  PENALTIESDRAWN: "PENALTIES_DRAWN",
  PENALTYDRAWN: "PENALTIES_DRAWN",
  PENALTIESTAKEN: "PENALTIES_TAKEN",
  PENALTYTAKEN: "PENALTIES_TAKEN",
  GAMEWINNINGGOALS: "GAME_WINNING_GOALS",
  GWG: "GAME_WINNING_GOALS",
  OVERTIMEGOALS: "OVERTIME_GOALS",
  OTGOALS: "OVERTIME_GOALS",
  OTG: "OVERTIME_GOALS",
  EMPTYNETGOALS: "EMPTY_NET_GOALS",
  ENG: "EMPTY_NET_GOALS",
  EMPTYNETPOINTS: "EMPTY_NET_POINTS",
  ENP: "EMPTY_NET_POINTS",
  SHOOTINGPERCENTAGE: "SHOOTING_PERCENTAGE",
  SHOOTINGPCT: "SHOOTING_PERCENTAGE",
  SHPERCENT: "SHOOTING_PERCENTAGE",
  FACEOFFPERCENTAGE: "FACEOFF_PERCENTAGE",
  FACEOFFPCT: "FACEOFF_PERCENTAGE",
  FOPERCENT: "FACEOFF_PERCENTAGE",
  INDIVIDUALSHOTATTEMPTS: "SHOT_ATTEMPTS",
  SHOTATTEMPTS: "SHOT_ATTEMPTS",
  ICF: "SHOT_ATTEMPTS",
  INDIVIDUALUNBLOCKEDSHOTATTEMPTS: "UNBLOCKED_SHOT_ATTEMPTS",
  UNBLOCKEDSHOTATTEMPTS: "UNBLOCKED_SHOT_ATTEMPTS",
  IFF: "UNBLOCKED_SHOT_ATTEMPTS",
  INDIVIDUALEXPECTEDGOALS: "EXPECTED_GOALS",
  EXPECTEDGOALS: "EXPECTED_GOALS",
  IXG: "EXPECTED_GOALS",
  EXPECTEDPRIMARYASSISTS: "EXPECTED_PRIMARY_ASSISTS",
  IXA1: "EXPECTED_PRIMARY_ASSISTS",
  EXPECTEDSECONDARYASSISTS: "EXPECTED_SECONDARY_ASSISTS",
  IXA2: "EXPECTED_SECONDARY_ASSISTS",
  HIGHDANGERSHOTS: "HIGH_DANGER_SHOTS",
  HDSHOTS: "HIGH_DANGER_SHOTS",
  MIDRANGESHOTS: "MID_RANGE_SHOTS",
  LONGRANGESHOTS: "LONG_RANGE_SHOTS",
  RUSHSHOTS: "RUSH_SHOTS",
  REBOUNDSHOTS: "REBOUND_SHOTS",
  REBOUNDSCREATED: "REBOUNDS_CREATED",
  ONICESHOTATTEMPTSFOR: "ON_ICE_SHOT_ATTEMPTS_FOR",
  ONICESHOTATTEMPTSAGAINST: "ON_ICE_SHOT_ATTEMPTS_AGAINST",
  ONICEUNBLOCKEDATTEMPTSFOR: "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",
  ONICEUNBLOCKEDATTEMPTSAGAINST: "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST",
  ONICEEXPECTEDGOALSFOR: "ON_ICE_EXPECTED_GOALS_FOR",
  ONICEEXPECTEDGOALSAGAINST: "ON_ICE_EXPECTED_GOALS_AGAINST",
  ONICECFPERCENTAGE: "ON_ICE_CF_PERCENTAGE",
  ONICEFFPERCENTAGE: "ON_ICE_FF_PERCENTAGE",
  ONICEXGFPERCENTAGE: "ON_ICE_XGF_PERCENTAGE",
};

const GOALIE_STAT_ALIASES: Record<string, string> = {
  GAMESPLAYED: "GAMES_PLAYED",
  GP: "GAMES_PLAYED",
  GAMESSTARTED: "GAMES_STARTED",
  GS: "GAMES_STARTED",
  TIMEONICE: "TOTAL_TOI",
  TOI: "TOTAL_TOI",
  WINS: "WINS_GOALIE",
  W: "WINS_GOALIE",
  LOSSES: "LOSSES_GOALIE",
  L: "LOSSES_GOALIE",
  OVERTIMELOSSES: "OTL_GOALIE",
  OTL: "OTL_GOALIE",
  SHOTSAGAINST: "SHOTS_AGAINST_GOALIE",
  SA: "SHOTS_AGAINST_GOALIE",
  SAVES: "SAVES_GOALIE",
  SV: "SAVES_GOALIE",
  GOALSAGAINST: "GOALS_AGAINST_GOALIE",
  GA: "GOALS_AGAINST_GOALIE",
  SHUTOUTS: "SHUTOUTS_GOALIE",
  SO: "SHUTOUTS_GOALIE",
  SAVEPERCENTAGE: "SAVE_PERCENTAGE",
  SAVEPCT: "SAVE_PERCENTAGE",
  SVPCT: "SAVE_PERCENTAGE",
  SVPERCENTAGE: "SAVE_PERCENTAGE",
  SVPERCENT: "SAVE_PERCENTAGE",
  GOALSAGAINSTAVERAGE: "GOALS_AGAINST_AVERAGE",
  GAA: "GOALS_AGAINST_AVERAGE",
  QUALITYSTARTS: "QUALITY_STARTS_GOALIE",
  QUALITYSTART: "QUALITY_STARTS_GOALIE",
  QS: "QUALITY_STARTS_GOALIE",
  STARTPERCENTAGE: "START_PERCENTAGE_GOALIE",
  STARTPCT: "START_PERCENTAGE_GOALIE",
  WINPERCENTAGE: "WIN_PERCENTAGE_GOALIE",
  WINPCT: "WIN_PERCENTAGE_GOALIE",
  EXPECTEDGOALSAGAINST: "EXPECTED_GOALS_AGAINST_GOALIE",
  XGA: "EXPECTED_GOALS_AGAINST_GOALIE",
  GOALSSAVEDABOVEEXPECTED: "GOALS_SAVED_ABOVE_EXPECTED",
  GSAX: "GOALS_SAVED_ABOVE_EXPECTED",
  HIGHDANGERSHOTSAGAINST: "HIGH_DANGER_SHOTS_AGAINST_GOALIE",
  HIGHDANGERGOALSAGAINST: "HIGH_DANGER_GOALS_AGAINST_GOALIE",
  HIGHDANGERSAVES: "HIGH_DANGER_SAVES_GOALIE",
  HIGHDANGERSAVEPERCENTAGE: "HIGH_DANGER_SAVE_PERCENTAGE_GOALIE",
  MIDRANGESHOTSAGAINST: "MID_RANGE_SHOTS_AGAINST_GOALIE",
  MIDRANGEGOALSAGAINST: "MID_RANGE_GOALS_AGAINST_GOALIE",
  MIDRANGESAVES: "MID_RANGE_SAVES_GOALIE",
  MIDRANGESAVEPERCENTAGE: "MID_RANGE_SAVE_PERCENTAGE_GOALIE",
  LONGRANGESHOTSAGAINST: "LONG_RANGE_SHOTS_AGAINST_GOALIE",
  LONGRANGEGOALSAGAINST: "LONG_RANGE_GOALS_AGAINST_GOALIE",
  LONGRANGESAVES: "LONG_RANGE_SAVES_GOALIE",
  LONGRANGESAVEPERCENTAGE: "LONG_RANGE_SAVE_PERCENTAGE_GOALIE",
};

const ROSTER_POSITION_ALIASES: Record<string, string> = {
  C: "C",
  CENTER: "C",
  LW: "LW",
  LEFTWING: "LW",
  RW: "RW",
  RIGHTWING: "RW",
  D: "D",
  DEFENSE: "D",
  DEFENCEMAN: "D",
  G: "G",
  GOALIE: "G",
  F: "FWD",
  FORWARD: "FWD",
  FWD: "FWD",
  RES: "bench",
  RESERVE: "bench",
  BENCH: "bench",
  UTIL: "utility",
  UTILITY: "utility",
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function finiteNumber(value: unknown): number | null {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : null;
}

function integer(value: unknown): number | null {
  const next = finiteNumber(value);
  return next != null && Number.isInteger(next) ? next : null;
}

function token(value: unknown): string {
  return (text(value) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function firstText(source: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as UnknownRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function sourceHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function teamRows(value: unknown, owned: boolean): FantraxOwnedTeam[] {
  const rows: Array<[string | null, unknown]> = Array.isArray(value)
    ? value.map((item) => [null, item])
    : Object.entries(record(value));
  const teams = rows.flatMap(([fallbackId, raw]) => {
    const item = record(raw);
    const externalTeamKey =
      firstText(item, ["id", "teamId", "teamID", "team_id"]) ?? fallbackId;
    if (!externalTeamKey) return [];
    return [
      {
        externalTeamKey,
        name:
          firstText(item, ["name", "teamName", "team_name", "shortName"]) ??
          `Fantrax Team ${externalTeamKey}`,
        division: firstText(item, ["division", "divisionName"]),
        isOwned: owned,
      },
    ];
  });
  return [...new Map(teams.map((team) => [team.externalTeamKey, team])).values()];
}

function discoveredLeagueRows(payload: unknown): Array<[string | null, unknown]> {
  if (Array.isArray(payload)) return payload.map((item) => [null, item]);
  const root = record(payload);
  const nested = root.leagues ?? root.leagueInfo ?? root.results;
  if (Array.isArray(nested)) return nested.map((item) => [null, item]);
  if (nested && typeof nested === "object") return Object.entries(record(nested));
  return Object.entries(root);
}

export function normalizeFantraxDiscovery(payload: unknown): FantraxDiscoveredLeague[] {
  const leagues = discoveredLeagueRows(payload).flatMap(([fallbackId, raw]) => {
    const item = record(raw);
    const externalLeagueKey =
      firstText(item, ["id", "leagueId", "leagueID", "league_id"]) ?? fallbackId;
    const name = firstText(item, ["name", "leagueName", "league_name"]);
    if (!externalLeagueKey || !name) return [];
    const sport = firstText(item, ["sport", "sportCode", "sport_code"]);
    if (sport && token(sport) !== "NHL" && token(sport) !== "HOCKEY") return [];
    let ownedTeams = teamRows(
      item.ownedTeams ?? item.teams ?? item.teamInfo ?? item.userTeams,
      true,
    );
    const singularTeamId = firstText(item, ["teamId", "teamID", "team_id"]);
    if (!ownedTeams.length && singularTeamId) {
      ownedTeams = [
        {
          externalTeamKey: singularTeamId,
          name:
            firstText(item, ["teamName", "team_name"]) ??
            `Fantrax Team ${singularTeamId}`,
          division: null,
          isOwned: true,
        },
      ];
    }
    return [{ externalLeagueKey, name, sport, ownedTeams }];
  });
  return [...new Map(leagues.map((league) => [league.externalLeagueKey, league])).values()];
}

function leagueType(value: unknown): FantraxLeagueType | null {
  const normalized = token(value);
  if (normalized.includes("POINT")) return "points";
  if (
    normalized.includes("ROTISSERIE") ||
    normalized.includes("ROTO") ||
    normalized.includes("CATEGORY") ||
    normalized.includes("CATEGORIES")
  ) {
    return "categories";
  }
  return null;
}

function draftOrderType(info: UnknownRecord): FantraxDraftOrderType {
  const draft = record(info.draftSettings);
  const normalized = token(draft.draftType ?? info.draftType);
  if (normalized.includes("SNAKE") || normalized.includes("SERPENTINE")) {
    return "snake";
  }
  if (normalized.includes("STRAIGHT") || normalized.includes("LINEAR")) {
    return "straight";
  }
  return "unknown";
}

function hasNonlinearRule(config: UnknownRecord): boolean {
  return [
    "ranges",
    "range",
    "thresholds",
    "threshold",
    "conditions",
    "condition",
    "tiers",
    "tier",
    "values",
    "minimum",
    "maximum",
    "lowerBound",
    "upperBound",
  ].some((key) => {
    const value = config[key];
    if (value == null || value === false || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(record(value)).length > 0;
    return true;
  });
}

function scoringCode(config: UnknownRecord): { code: string; label: string } {
  const rawCategory = config.scoringCategory ?? config.category;
  const category = record(rawCategory);
  const direct = text(rawCategory);
  return {
    code:
      firstText(category, ["code", "id", "shortName", "name"]) ??
      direct ??
      "UNKNOWN_SCORING_CATEGORY",
    label:
      firstText(category, ["name", "shortName", "code", "id"]) ??
      direct ??
      "Unknown scoring category",
  };
}

function scoringRole(value: unknown): "skater" | "goalie" | "team-goalie" | null {
  const source = record(value);
  const normalized = token(
    text(value) ?? source.code ?? source.id ?? source.name ?? source.shortName,
  );
  if (TEAM_GOALIE_GROUP_MARKERS.some((marker) => normalized.includes(marker))) {
    return "team-goalie";
  }
  if (
    normalized === "G" ||
    GOALIE_GROUP_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    return "goalie";
  }
  if (
    SKATER_POSITION_MARKERS.has(normalized) ||
    SKATER_GROUP_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    return "skater";
  }
  return null;
}

function resolvedScoringRole(setting: UnknownRecord, config: UnknownRecord) {
  const roles = [
    config.position,
    config.scoringGroup,
    setting.position,
    setting.group,
  ]
    .map(scoringRole)
    .filter((role): role is NonNullable<typeof role> => role != null);
  if (roles.includes("team-goalie")) return "team-goalie" as const;
  const playerRoles = [...new Set(roles)];
  return playerRoles.length === 1 ? playerRoles[0] : null;
}

function mappedStatKey(config: UnknownRecord, role: "skater" | "goalie") {
  const rawCategory = config.scoringCategory ?? config.category;
  const category = record(rawCategory);
  const candidates = [
    text(rawCategory),
    category.code,
    category.id,
    category.shortName,
    category.name,
  ];
  const aliases = role === "goalie" ? GOALIE_STAT_ALIASES : SKATER_STAT_ALIASES;
  for (const candidate of candidates) {
    if (
      role === "goalie" &&
      typeof candidate === "string" &&
      candidate.includes("%") &&
      token(candidate) === "SV"
    ) {
      return "SAVE_PERCENTAGE";
    }
    const mapped = aliases[token(candidate)];
    if (mapped) return mapped;
  }
  return null;
}

function addUnsupported(
  unsupported: FantraxUnsupportedItem[],
  item: FantraxUnsupportedItem,
) {
  if (
    !unsupported.some(
      (existing) =>
        existing.kind === item.kind &&
        existing.code === item.code &&
        existing.label === item.label &&
        existing.reason === item.reason,
    )
  ) {
    unsupported.push(item);
  }
}

function normalizeScoring(scoringSystem: UnknownRecord) {
  const type = leagueType(scoringSystem.type ?? scoringSystem.scoringType);
  const skaterScoringCategories: Record<string, number> = {};
  const goalieScoringCategories: Record<string, number> = {};
  const categoryWeights: Record<string, number> = {};
  const unsupported: FantraxUnsupportedItem[] = [];
  const warnings: string[] = [];
  const conflictingSkaterKeys = new Set<string>();
  const conflictingGoalieKeys = new Set<string>();
  const conflictingCategoryKeys = new Set<string>();
  const skaterSources: Record<string, { code: string; label: string }> = {};
  const goalieSources: Record<string, { code: string; label: string }> = {};
  const categorySources: Record<string, { code: string; label: string }> = {};

  for (const settingRaw of array(scoringSystem.scoringCategorySettings)) {
    const setting = record(settingRaw);
    for (const configRaw of array(setting.configs)) {
      const config = record(configRaw);
      if (
        config.enabled === false ||
        config.active === false ||
        config.included === false
      ) {
        continue;
      }
      const role = resolvedScoringRole(setting, config);
      const category = scoringCode(config);
      if (role === "team-goalie") {
        addUnsupported(unsupported, {
          kind: "scoring",
          code: category.code,
          label: category.label,
          reason: "Team-goalie scoring is not supported by FHFH player projections.",
        });
        continue;
      }
      if (!role) {
        addUnsupported(unsupported, {
          kind: "scoring",
          code: category.code,
          label: category.label,
          reason: "The Fantrax scoring group is not recognized as NHL skater or goalie scoring.",
        });
        continue;
      }
      const statKey = mappedStatKey(config, role);
      if (!statKey) {
        addUnsupported(unsupported, {
          kind: "scoring",
          code: category.code,
          label: category.label,
          reason: "No matching FHFH projection statistic exists.",
        });
        continue;
      }
      if (type === "points") {
        if (hasNonlinearRule(config)) {
          addUnsupported(unsupported, {
            kind: "scoring",
            code: category.code,
            label: category.label,
            reason: "Range, tier, threshold, and conditional point rules require manual setup.",
          });
          continue;
        }
        const points = finiteNumber(config.points);
        if (points == null) {
          addUnsupported(unsupported, {
            kind: "scoring",
            code: category.code,
            label: category.label,
            reason: "Fantrax did not provide a finite point value.",
          });
          continue;
        }
        const target = role === "goalie" ? goalieScoringCategories : skaterScoringCategories;
        const conflicts =
          role === "goalie" ? conflictingGoalieKeys : conflictingSkaterKeys;
        const sources = role === "goalie" ? goalieSources : skaterSources;
        if (conflicts.has(statKey)) continue;
        if (target[statKey] != null && target[statKey] !== points) {
          const previous = sources[statKey];
          if (previous) {
            addUnsupported(unsupported, {
              kind: "scoring",
              code: previous.code,
              label: previous.label,
              reason: "Multiple Fantrax rules map to the same FHFH statistic with conflicting values.",
            });
          }
          addUnsupported(unsupported, {
            kind: "scoring",
            code: category.code,
            label: category.label,
            reason: "Multiple Fantrax rules map to the same FHFH statistic with conflicting values.",
          });
          delete target[statKey];
          delete sources[statKey];
          conflicts.add(statKey);
          continue;
        }
        target[statKey] = points;
        sources[statKey] = category;
      } else if (type === "categories") {
        if (conflictingCategoryKeys.has(statKey)) continue;
        const weight = finiteNumber(config.weight ?? setting.weight) ?? 1;
        if (categoryWeights[statKey] != null && categoryWeights[statKey] !== weight) {
          const previous = categorySources[statKey];
          if (previous) {
            addUnsupported(unsupported, {
              kind: "scoring",
              code: previous.code,
              label: previous.label,
              reason: "Multiple Fantrax categories map to the same FHFH statistic with conflicting weights.",
            });
          }
          addUnsupported(unsupported, {
            kind: "scoring",
            code: category.code,
            label: category.label,
            reason: "Multiple Fantrax categories map to the same FHFH statistic with conflicting weights.",
          });
          delete categoryWeights[statKey];
          delete categorySources[statKey];
          conflictingCategoryKeys.add(statKey);
          continue;
        }
        categoryWeights[statKey] = weight;
        categorySources[statKey] = category;
      }
    }
  }

  if (!type) warnings.push("Fantrax returned an unrecognized scoring-system type.");
  if (
    type === "points" &&
    !Object.keys(skaterScoringCategories).length &&
    !Object.keys(goalieScoringCategories).length
  ) {
    warnings.push("No supported Fantrax point-scoring rules were found.");
  }
  if (type === "categories" && !Object.keys(categoryWeights).length) {
    warnings.push("No supported Fantrax scoring categories were found.");
  }
  return {
    type,
    skaterScoringCategories,
    goalieScoringCategories,
    categoryWeights,
    unsupported,
    warnings,
  };
}

function normalizeRoster(rosterInfo: UnknownRecord) {
  const rosterConfig: Record<string, number> = {};
  const unsupported: FantraxUnsupportedItem[] = [];
  const rawConstraints = rosterInfo.positionConstraints;
  const constraints: Array<[string | null, unknown]> = Array.isArray(rawConstraints)
    ? rawConstraints.map((item) => [null, item])
    : Object.entries(record(rawConstraints));
  if (!constraints.length) {
    addUnsupported(unsupported, {
      kind: "roster",
      code: "NO_ROSTER_CONSTRAINTS",
      label: "Roster configuration",
      reason: "Fantrax did not return roster-slot constraints, so the current FHFH roster will be retained.",
    });
  }
  for (const [fallbackCode, raw] of constraints) {
    const constraint = record(raw);
    const position = record(constraint.position);
    const code =
      firstText(constraint, ["code", "id", "shortName"]) ??
      firstText(position, ["code", "id", "shortName"]) ??
      text(constraint.position) ??
      fallbackCode ??
      firstText(constraint, ["name"]) ??
      firstText(position, ["name"]) ??
      "UNKNOWN_ROSTER_SLOT";
    const mapped = ROSTER_POSITION_ALIASES[token(code)];
    const count = integer(
      typeof raw === "number"
        ? raw
        : constraint.maxActive ??
            constraint.maxActivePlayers ??
            constraint.max ??
            constraint.count,
    );
    if (!mapped || count == null || count < 0) {
      addUnsupported(unsupported, {
        kind: "roster",
        code,
        label: firstText(constraint, ["name", "shortName"]) ?? code,
        reason: !mapped
          ? "This Fantrax roster slot has no exact FHFH equivalent."
          : "Fantrax did not provide a valid active-slot count.",
      });
      continue;
    }
    rosterConfig[mapped] = (rosterConfig[mapped] ?? 0) + count;
  }
  const reserve = integer(rosterInfo.maxTotalReservePlayers);
  if (reserve != null && reserve >= 0) rosterConfig.bench = reserve;
  return { rosterConfig, unsupported };
}

function mergeTeams(infoTeams: FantraxOwnedTeam[], ownedTeams: FantraxOwnedTeam[]) {
  const ownership = new Map(ownedTeams.map((team) => [team.externalTeamKey, team]));
  const teams = new Map(
    infoTeams.map((team) => [
      team.externalTeamKey,
      { ...team, isOwned: ownership.has(team.externalTeamKey) },
    ]),
  );
  for (const team of ownedTeams) {
    if (!teams.has(team.externalTeamKey)) teams.set(team.externalTeamKey, team);
  }
  return [...teams.values()].sort((left, right) =>
    left.externalTeamKey.localeCompare(right.externalTeamKey),
  );
}

export function relevantFantraxRawSettings(payload: unknown): FantraxStoredRawSettings {
  const info = record(payload);
  return {
    scoringSystem: info.scoringSystem ?? {},
    rosterInfo: info.rosterInfo ?? {},
    draftSettings: info.draftSettings ?? {},
    draftType: info.draftType ?? null,
    teamInfo: info.teamInfo ?? {},
  };
}

export function normalizeFantraxLeagueInfo(args: {
  externalLeagueKey: string;
  payload: unknown;
  ownedTeams?: FantraxOwnedTeam[];
  fetchedAt?: Date;
}): FantraxLeagueSettingsV1 {
  const info = record(args.payload);
  const scoring = normalizeScoring(record(info.scoringSystem));
  const roster = normalizeRoster(record(info.rosterInfo));
  const teams = mergeTeams(teamRows(info.teamInfo, false), args.ownedTeams ?? []);
  const draft = draftOrderType(info);
  const unsupported = [...scoring.unsupported, ...roster.unsupported];
  if (draft === "unknown") {
    unsupported.push({
      kind: "draft",
      code: firstText(record(info.draftSettings), ["draftType"]) ?? text(info.draftType) ?? "UNKNOWN",
      label: "Draft format",
      reason: "Only snake and straight drafts can be applied automatically.",
    });
  }
  const warnings = [...scoring.warnings];
  const sport = text(info.sport ?? info.sportCode);
  const unsupportedSport = Boolean(
    sport && token(sport) !== "NHL" && token(sport) !== "HOCKEY",
  );
  if (unsupportedSport) {
    warnings.push(`Fantrax identified this as ${sport}, not an NHL league.`);
  }
  if (!teams.length) {
    warnings.push("Fantrax did not return any league team identities.");
  }
  const explicitTeamCount = integer(info.numTeams ?? info.teamCount);
  const teamCount = explicitTeamCount ?? (teams.length || null);
  if (
    explicitTeamCount != null &&
    teams.length > 0 &&
    explicitTeamCount !== teams.length
  ) {
    warnings.push(
      `Fantrax reported ${explicitTeamCount} teams but returned ${teams.length} team identities.`,
    );
  }
  if (teamCount == null || teamCount < 2 || teamCount > 40) {
    warnings.push("Fantrax did not return a supported team count between 2 and 40.");
  }
  const hasUsableScoring =
    scoring.type === "points"
      ? Object.keys(scoring.skaterScoringCategories).length > 0 ||
        Object.keys(scoring.goalieScoringCategories).length > 0
      : scoring.type === "categories" && Object.keys(scoring.categoryWeights).length > 0;
  unsupported.sort((left, right) =>
    `${left.kind}:${left.code}:${left.reason}`.localeCompare(
      `${right.kind}:${right.code}:${right.reason}`,
    ),
  );
  const stableWarnings = [...new Set(warnings)].sort();
  const status: FantraxDiagnostics["status"] = unsupportedSport || !scoring.type || !hasUsableScoring
    ? "unsupported"
    : unsupported.length || stableWarnings.length
      ? "partial"
      : "supported";
  const canonical = {
    version: 1 as const,
    mappingVersion:
      FANTRAX_MAPPING_VERSION as FantraxLeagueSettingsV1["mappingVersion"],
    externalLeagueKey: args.externalLeagueKey,
    leagueName: text(info.leagueName) ?? `Fantrax League ${args.externalLeagueKey}`,
    seasonKey:
      text(info.seasonYear) ?? text(info.season) ?? text(record(info.draftSettings).season),
    leagueType: scoring.type ?? "points",
    teamCount: teamCount != null && teamCount >= 2 && teamCount <= 40 ? teamCount : null,
    teams,
    skaterScoringCategories: scoring.skaterScoringCategories,
    goalieScoringCategories: scoring.goalieScoringCategories,
    categoryWeights: scoring.categoryWeights,
    rosterConfig: roster.rosterConfig,
    draftOrderType: draft,
    diagnostics: { status, warnings: stableWarnings, unsupported },
  };
  return {
    ...canonical,
    sourceHash: sourceHash(canonical),
    fetchedAt: (args.fetchedAt ?? new Date()).toISOString(),
  };
}
