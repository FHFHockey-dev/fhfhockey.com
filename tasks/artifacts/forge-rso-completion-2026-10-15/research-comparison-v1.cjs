"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tasks/artifacts/forge-rso-completion-2026-10-15/research-comparison-v1.ts
var import_node_crypto3 = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_typescript = __toESM(require("typescript"));

// web/lib/player-forecasts/currentRosterNativeInputs.ts
var import_node_crypto2 = require("node:crypto");

// web/lib/projections/evidenceTime.ts
function timestampMicros(value) {
  const match = typeof value === "string" && value.match(/^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/);
  const milliseconds = Date.parse(value);
  if (!match || !Number.isFinite(milliseconds)) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return BigInt(milliseconds) * BigInt(1e3) + BigInt((match[4] ?? "").slice(3).padEnd(3, "0"));
}
function acceptedNewsSupersedes(acceptedAt, inputCutoff) {
  const accepted = timestampMicros(acceptedAt), cutoff = timestampMicros(inputCutoff);
  return accepted === null || cutoff === null || accepted > cutoff;
}

// web/lib/player-forecasts/sourceSnapshot.ts
var import_crypto = __toESM(require("crypto"));
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}
function playerForecastSourcePayloadHash(payload) {
  return import_crypto.default.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

// web/lib/player-forecasts/researchContract.ts
var PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION = "player-forecasts-research-v1";
var PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256 = "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574";
var PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION = "player-forecasts-research-v2-validation";
var PLAYER_FORECAST_VALIDATION_CONTRACT_SHA256 = "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed";
var PLAYER_FORECAST_APPROVED_CONTRACTS = {
  [PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION]: PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
  [PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION]: PLAYER_FORECAST_VALIDATION_CONTRACT_SHA256
};

// web/lib/player-forecasts/settlement.ts
var PROVISIONAL_DELAY_MS = 8 * 60 * 60 * 1e3;
var CORRECTION_WINDOW_MS = 48 * 60 * 60 * 1e3;
var DEFAULT_SETTLEMENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1e3;
var MAX_SETTLEMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1e3;
function parseTimeOnIceSeconds(value) {
  if (typeof value !== "string") return null;
  const parts = /^(\d+):([0-5]\d)$/.exec(value);
  if (!parts) return null;
  const minutes = Number(parts[1]);
  return Number.isSafeInteger(minutes) ? minutes * 60 + Number(parts[2]) : null;
}
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function finalBoxscoreForGame(row, game) {
  const payload = record(row.payload);
  const home = record(payload?.homeTeam), away = record(payload?.awayTeam);
  const stats = record(payload?.playerByGameStats);
  if (!payload || !home || !away || !stats || !["FINAL", "OFF"].includes(String(payload.gameState)) || Number(row.game_id) !== Number(game.id) || Number(row.season_id) !== Number(game.seasonId) || Number(payload.id) !== Number(game.id) || Number(payload.season) !== Number(game.seasonId) || Number(home.id) !== Number(game.homeTeamId) || Number(away.id) !== Number(game.awayTeamId) || !/^[a-f0-9]{64}$/i.test(String(row.payload_hash)) || !Number.isFinite(Date.parse(row.fetched_at)) || Date.parse(row.fetched_at) < Date.parse(game.startTime)) return null;
  for (const side of ["homeTeam", "awayTeam"]) {
    const team = record(stats[side]);
    if (!team || !Array.isArray(team.forwards) || !Array.isArray(team.defense) || !Array.isArray(team.goalies) || !team.goalies.length || !team.forwards.length && !team.defense.length) return null;
  }
  return {
    payload,
    payloadHash: String(row.payload_hash),
    fetchedAt: String(row.fetched_at),
    seasonId: Number(game.seasonId)
  };
}
function rawPlayerForOutput(output, source2) {
  const home = record(source2.payload.homeTeam), away = record(source2.payload.awayTeam);
  const stats = record(source2.payload.playerByGameStats);
  const side = Number(home?.id) === output.team_id ? "homeTeam" : Number(away?.id) === output.team_id ? "awayTeam" : null;
  if (!side || !stats) return null;
  const players = /* @__PURE__ */ new Set();
  let selectedSkater;
  let selectedGoalie;
  for (const teamSide of ["homeTeam", "awayTeam"]) {
    const team = record(stats[teamSide]);
    if (!team) return null;
    for (const group of ["forwards", "defense", "goalies"]) {
      const rows = team[group];
      if (!Array.isArray(rows)) return null;
      for (const value of rows) {
        const player = record(value), playerId = Number(player?.playerId);
        if (!player || !Number.isSafeInteger(playerId) || playerId <= 0 || players.has(playerId)) return null;
        players.add(playerId);
        if (teamSide === side && playerId === output.player_id) {
          if (group === "goalies") selectedGoalie = player;
          else selectedSkater = player;
        }
      }
    }
  }
  return { skater: selectedSkater, goalie: selectedGoalie, side };
}

// web/lib/projectionsConfig/formatToMMSS.ts
var formatToMMSS = (decimalMinutes) => {
  if (decimalMinutes === null || decimalMinutes === void 0 || Number.isNaN(decimalMinutes) || decimalMinutes < 0) {
    return "-";
  }
  let totalMinutes = Math.floor(decimalMinutes);
  const fractionalPart = decimalMinutes - totalMinutes;
  let seconds = Math.round(fractionalPart * 60);
  if (seconds === 60) {
    totalMinutes += 1;
    seconds = 0;
  }
  const mm = String(totalMinutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
};

// web/lib/projectionsConfig/projectionSourcesConfig.ts
var SKATER_STAT_MAPPINGS = [
  { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
  { key: "GOALS", dbColumnName: "Goals" },
  { key: "ASSISTS", dbColumnName: "Assists" },
  { key: "POINTS", dbColumnName: "Points" },
  { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
  { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
  { key: "PP_GOALS", dbColumnName: "PP_Goals" },
  { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
  { key: "PP_POINTS", dbColumnName: "PP_Points" },
  { key: "SH_GOALS", dbColumnName: "SH_Goals" },
  { key: "SH_ASSISTS", dbColumnName: "SH_Assists" },
  { key: "SH_POINTS", dbColumnName: "SH_Points" },
  { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
  { key: "SHOOTING_PERCENTAGE", dbColumnName: "Shooting_Percentage" },
  { key: "GAME_WINNING_GOALS", dbColumnName: "Game_Winning_Goals" },
  { key: "HITS", dbColumnName: "Hits" },
  { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
  { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
  { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
  { key: "FACEOFF_PERCENTAGE", dbColumnName: "Faceoff_Percentage" },
  { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Time_on_Ice_Per_Game", formatter: formatToMMSS }
];
var GOALIE_STAT_MAPPINGS = [
  { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
  { key: "GAMES_STARTED_GOALIE", dbColumnName: "Games_Started_Goalie" },
  { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
  { key: "LOSSES_GOALIE", dbColumnName: "Losses_Goalie" },
  { key: "OTL_GOALIE", dbColumnName: "Overtime_Losses_Goalie" },
  { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" },
  { key: "SAVES_GOALIE", dbColumnName: "Saves_Goalie" },
  { key: "GOALS_AGAINST_GOALIE", dbColumnName: "Goals_Against_Goalie" },
  { key: "SHOTS_AGAINST_GOALIE", dbColumnName: "Shots_Against" },
  { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
  { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" }
];
var PROJECTION_SOURCES_CONFIG = [
  {
    id: "ag_skaters",
    displayName: "Apples & Ginos",
    tableName: "PROJECTIONS_20262027_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS
  },
  {
    id: "blake_ag_skaters",
    displayName: "Blake A&G (component)",
    tableName: "PROJECTIONS_20262027_BLAKE_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
    defaultSelected: false
  },
  {
    id: "nate_ag_skaters",
    displayName: "Nate A&G (component)",
    tableName: "PROJECTIONS_20262027_NATE_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
    defaultSelected: false
  },
  {
    id: "cullen_skaters",
    displayName: "Cullen",
    tableName: "PROJECTIONS_20262027_CULLEN_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS
  },
  {
    id: "cullen_goalies",
    displayName: "Cullen",
    tableName: "PROJECTIONS_20262027_CULLEN_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS
  },
  {
    id: "dtz_skaters",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20262027_DTZ_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS
  },
  {
    id: "dtz_goalies",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20262027_DTZ_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS
  },
  {
    id: "5v5_skaters",
    displayName: "5v5",
    tableName: "PROJECTIONS_20262027_5V5_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS
  },
  {
    id: "5v5_goalies",
    displayName: "5v5",
    tableName: "PROJECTIONS_20262027_5V5_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS
  }
];

// web/lib/player-forecasts/baselinePolicy.ts
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}
var sourceIds = {
  skater: ["ag_skaters", "cullen_skaters", "dtz_skaters", "5v5_skaters"],
  goalie: ["cullen_goalies", "dtz_goalies", "5v5_goalies"]
};
var skipTargets = /* @__PURE__ */ new Set([
  "GAMES_PLAYED",
  "GAMES_STARTED_GOALIE",
  "SHOOTING_PERCENTAGE",
  "FACEOFF_PERCENTAGE",
  "TIME_ON_ICE_PER_GAME",
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
  "LOSSES_GOALIE",
  "OTL_GOALIE"
]);
var currentSchemas = Object.fromEntries([...sourceIds.skater, ...sourceIds.goalie].map((id4) => {
  const source2 = PROJECTION_SOURCES_CONFIG.find((row) => row.id === id4);
  if (!source2) throw new Error(`Frozen baseline source mapping is missing: ${id4}`);
  return [id4, {
    id: id4,
    tableTemplate: `PROJECTIONS_{season}_${id4.toUpperCase()}`,
    appearanceColumn: "Games_Played",
    startColumn: source2.playerType === "goalie" ? "Games_Started_Goalie" : null,
    statMappings: source2.statMappings.filter((row) => !skipTargets.has(row.key)).map(({ key, dbColumnName }) => ({ key, dbColumnName }))
  }];
}));
var legacyColumns = {
  ag_skaters: ["Goals", "Assists", "Points", "PP_Points", "Shots_on_Goal", "Hits", "Blocked_Shots", "Penalty_Minutes"],
  cullen_skaters: ["Goals", "Assists", "Points", "Plus_Minus", "PP_Points", "Penalty_Minutes", "Hits", "Blocked_Shots", "Shots_on_Goal"],
  dtz_skaters: null,
  "5v5_skaters": null,
  cullen_goalies: ["Wins_Goalie", "Shutouts_Goalie"],
  dtz_goalies: ["Wins_Goalie", "Shutouts_Goalie", "Saves_Goalie", "Ga", "Sa"],
  "5v5_goalies": null
};
var legacySchemas = Object.fromEntries(Object.entries(currentSchemas).map(([id4, schema]) => {
  const columns = legacyColumns[id4];
  return [id4, {
    id: id4,
    tableName: columns ? schema.tableTemplate.replace("{season}", "20252026") : null,
    appearanceColumn: schema.appearanceColumn,
    startColumn: null,
    statMappings: schema.statMappings.map((row) => id4 === "dtz_goalies" && row.key === "GOALS_AGAINST_GOALIE" ? { ...row, dbColumnName: "Ga" } : id4 === "dtz_goalies" && row.key === "SHOTS_AGAINST_GOALIE" ? { ...row, dbColumnName: "Sa" } : row).filter((row) => columns?.includes(row.dbColumnName))
  }];
}));
var BASELINE_CANDIDATE_POLICY = freeze({
  definitionVersion: "baseline-candidate-definition-v1",
  sourceIds,
  excludedComponents: ["blake_ag_skaters", "nate_ag_skaters"],
  consensus: "equal_source_rates_per_target",
  projectionPriorWeight: 0.6,
  historyPriorWeight: 0.4,
  previousAppearanceWindow: 82,
  recentAppearanceWindow: 20,
  recentDecay: 0.9,
  priorAppearanceWeight: 20,
  recentIndex: "all_appearances_in_window; missing_target_skips_numerator_and_denominator",
  participation: "excluded",
  adjustments: "none",
  negativeTargets: ["PLUS_MINUS"],
  units: {
    skater: "count_per_appearance",
    goalieVolume: "count_per_appearance",
    goalieMinutes: "minutes_per_appearance",
    goalieOutcome: "count_per_start"
  },
  goalieVolumeTargets: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"],
  goalieStartTargets: ["WINS_GOALIE", "SHUTOUTS_GOALIE"],
  goalieShots: "saves_plus_goals_against_when_both_present",
  maximumGoalieProjectedAppearances: 100,
  appearanceCutoff: "prior_utc_date_or_same_day_final_boxscore_available_by_cutoff",
  seasonSchema: { legacySeason: 20252026, legacySchemas, canonicalSchemaFrom: 20262027, currentSchemas }
});
var BASELINE_CANDIDATE_DEFINITION_HASH = "431c0fa877c2046d011e612b630a08737d3a8a061a9148479d0788ca8ed8cdd8";
if (playerForecastSourcePayloadHash(BASELINE_CANDIDATE_POLICY) !== BASELINE_CANDIDATE_DEFINITION_HASH) {
  throw new Error("Baseline candidate ingredients changed; version and review the definition before use");
}
function validBaselineSeasonId(value) {
  const text = String(value);
  return Number.isSafeInteger(value) && /^[1-9]\d{7}$/.test(text) && Number(text.slice(4)) === Number(text.slice(0, 4)) + 1;
}
function baselineProjectionSchemas(playerType, seasonId) {
  if (!validBaselineSeasonId(seasonId) || seasonId < BASELINE_CANDIDATE_POLICY.seasonSchema.legacySeason) {
    throw new Error("No versioned baseline projection schema for this season");
  }
  return BASELINE_CANDIDATE_POLICY.sourceIds[playerType].map((id4) => {
    if (seasonId === BASELINE_CANDIDATE_POLICY.seasonSchema.legacySeason) return legacySchemas[id4];
    const schema = currentSchemas[id4];
    return {
      id: id4,
      tableName: schema.tableTemplate.replace("{season}", String(seasonId)),
      appearanceColumn: schema.appearanceColumn,
      startColumn: schema.startColumn,
      statMappings: schema.statMappings
    };
  });
}
function baselineDefinitionHash(playerType, seasonId) {
  return playerForecastSourcePayloadHash({
    definitionHash: BASELINE_CANDIDATE_DEFINITION_HASH,
    playerType,
    seasonId,
    sourceSchemas: baselineProjectionSchemas(playerType, seasonId)
  });
}

// web/lib/player-forecasts/baselineSourceLineage.ts
function baselineNumber(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
function baselineSkaterTargets(player) {
  const count3 = (key) => {
    const value = baselineNumber(player[key]);
    return value != null && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const goals = count3("goals"), assists = count3("assists");
  const shots = count3("sog") ?? count3("shots");
  if (count3("sog") != null && count3("shots") != null && count3("sog") !== count3("shots")) {
    throw new Error("Conflicting boxscore shot components");
  }
  const points = count3("points") ?? (goals != null && assists != null ? goals + assists : null);
  if (points != null && goals != null && assists != null && points !== goals + assists) {
    throw new Error("Conflicting boxscore point components");
  }
  const faceoffs = /^(\d+)\/(\d+)$/.exec(String(player.faceoffs ?? ""));
  return {
    GOALS: goals,
    ASSISTS: assists,
    POINTS: points,
    PLUS_MINUS: Number.isSafeInteger(baselineNumber(player.plusMinus)) ? baselineNumber(player.plusMinus) : null,
    PENALTY_MINUTES: count3("pim"),
    HITS: count3("hits"),
    BLOCKED_SHOTS: count3("blockedShots"),
    PP_GOALS: count3("powerPlayGoals"),
    PP_POINTS: count3("powerPlayPoints"),
    SH_GOALS: count3("shorthandedGoals"),
    SH_POINTS: count3("shPoints"),
    SHOTS_ON_GOAL: shots,
    FACEOFFS_WON: faceoffs ? Number(faceoffs[1]) : null,
    FACEOFFS_LOST: faceoffs ? Number(faceoffs[2]) : null
  };
}
function baselineGoalieComponents(player) {
  const match = /^(\d+)\/(\d+)$/.exec(String(player.saveShotsAgainst ?? ""));
  const saves = baselineNumber(player.saves) ?? (match ? Number(match[1]) : null);
  const shotsAgainst = baselineNumber(player.shotsAgainst) ?? (match ? Number(match[2]) : null);
  const goalsAgainst = baselineNumber(player.goalsAgainst);
  const seconds = parseTimeOnIceSeconds(player.toi);
  if (saves == null || shotsAgainst == null || goalsAgainst == null || seconds == null || ![saves, shotsAgainst, goalsAgainst].every(Number.isSafeInteger) || saves < 0 || goalsAgainst < 0 || saves + goalsAgainst !== shotsAgainst || match && (saves !== Number(match[1]) || shotsAgainst !== Number(match[2]))) {
    throw new Error("Incomplete or conflicting boxscore goalie components");
  }
  return { saves, shotsAgainst, goalsAgainst, toiMinutes: seconds / 60 };
}
function baselineAppearanceFromBoxscore(args) {
  const { rawRow, game } = args;
  const evidence = finalBoxscoreForGame(rawRow, game);
  if (!evidence || rawRow.id == null || !Number.isFinite(Date.parse(args.cutoffAt)) || !Number.isFinite(Date.parse(game.startTime)) || acceptedNewsSupersedes(rawRow.fetched_at, args.cutoffAt) || evidence.payload.gameDate !== game.date || Number(evidence.payload.gameType) !== 2 || evidence.payload.startTimeUTC != null && Date.parse(String(evidence.payload.startTimeUTC)) !== Date.parse(game.startTime) || Number(game.type) !== 2) throw new Error("Baseline boxscore identity/finality/cutoff is inconsistent");
  const own = rawPlayerForOutput({ team_id: args.teamId, player_id: args.nhlPlayerId }, evidence);
  const player = args.population === "goalie" ? own?.goalie : own?.skater;
  const seconds = parseTimeOnIceSeconds(player?.toi);
  if (!player || seconds == null) throw new Error("Baseline boxscore player or appearance is unverified");
  if (!seconds) return null;
  const finalBoxscore = {
    payloadHash: String(rawRow.payload_hash),
    fetchedAt: String(rawRow.fetched_at),
    contentHash: playerForecastSourcePayloadHash(rawRow.payload),
    rawRow,
    game,
    appearanceSeconds: seconds
  };
  const common = {
    gameId: Number(game.id),
    seasonId: Number(game.seasonId),
    gameDate: String(game.date),
    availableAt: args.cutoffAt,
    teamId: args.teamId,
    regularSeason: true,
    finalBoxscore
  };
  return args.population === "goalie" ? { ...common, ...baselineGoalieComponents(player) } : { ...common, targets: baselineSkaterTargets(player) };
}
function verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, population) {
  const receipt = appearance.finalBoxscore;
  if (!receipt?.rawRow || !receipt.game || receipt.contentHash !== playerForecastSourcePayloadHash(receipt.rawRow.payload) || receipt.payloadHash !== receipt.rawRow.payload_hash || receipt.fetchedAt !== receipt.rawRow.fetched_at) {
    throw new Error("Baseline appearance requires bound retained boxscore content");
  }
  const derived = baselineAppearanceFromBoxscore({
    rawRow: receipt.rawRow,
    game: receipt.game,
    teamId: appearance.teamId,
    nhlPlayerId,
    cutoffAt,
    population
  });
  if (!derived || playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(appearance)) {
    throw new Error("Baseline appearance values do not match retained boxscore content");
  }
}

// web/lib/player-forecasts/baselineRates.ts
var BASELINE_RATE_POLICY_VERSION = "skater-baseline-rates-v1";
var PRIOR_APPEARANCE_POLICY_VERSION = "native-prior-appearance-skater-rates-v1";
var priorAppearanceDefinitionHash = (seasonId) => playerForecastSourcePayloadHash({
  version: PRIOR_APPEARANCE_POLICY_VERSION,
  seasonId,
  legacyDefinitionHash: baselineDefinitionHash("skater", seasonId),
  population: "verified_immediate_prior_regular_season_positive_minutes",
  maximumAppearances: BASELINE_CANDIDATE_POLICY.previousAppearanceWindow,
  externalProjections: "none",
  countHeads: "unchanged_legacy_prior_means",
  toi: "arithmetic_mean_original_appearance_seconds_divided_by_60",
  toiMissingness: "every_selected_appearance_requires_verified_positive_minutes",
  participation: "not_supplied",
  populationCoverage: "unverified"
});
var CURRENT_APPEARANCE_POLICY_VERSION = "current-appearance-skater-rates-v1";
var CURRENT_APPEARANCE_POLICY = Object.freeze({
  version: CURRENT_APPEARANCE_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes",
  maximumAppearances: 20,
  decay: 0.9,
  targets: ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"],
  missingness: "missing_target_skips_numerator_and_denominator_with_original_appearance_age",
  prior: "none",
  participation: "not_supplied",
  populationCoverage: "unverified"
});
var currentAppearanceDefinitionHash = (seasonId) => playerForecastSourcePayloadHash({ policy: CURRENT_APPEARANCE_POLICY, seasonId });
var ADDITIVE_SKATER_TARGETS = new Set(baselineProjectionSchemas("skater", 20262027).flatMap((source2) => source2.statMappings.map((mapping) => mapping.key)));
var validTarget = (value, targetKey) => value != null && Number.isFinite(value) && (BASELINE_CANDIDATE_POLICY.negativeTargets.includes(targetKey) || value >= 0);
function rateBoxscoreReference(value) {
  const retained = value;
  return {
    payloadHash: value.payloadHash,
    fetchedAt: value.fetchedAt,
    ...retained.contentHash && retained.rawRow?.id != null ? { contentHash: retained.contentHash, rawRowId: retained.rawRow.id } : {}
  };
}
function buildSkaterBaselineRates(input) {
  if (!Number.isInteger(input.playerId) || !Number.isInteger(input.nhlPlayerId) || !validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark) throw new Error("Baseline identity, cutoff and source watermark are required.");
  const schemas = new Map(baselineProjectionSchemas("skater", input.seasonId).map((row) => [row.id, row]));
  const projections = input.projections.filter((row) => row.seasonId === input.seasonId && Number.isFinite(Date.parse(row.availableAt)) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt) && !!schemas.get(row.sourceId)?.tableName && (row.sourceTable == null || row.sourceTable === schemas.get(row.sourceId)?.tableName) && Number.isFinite(row.projectedAppearances) && row.projectedAppearances > 0);
  if (new Set(projections.map((row) => row.sourceId)).size !== projections.length) {
    throw new Error("Baseline requires one immutable row per approved source.");
  }
  const availableGames = input.appearances.filter((row) => row.regularSeason && Number.isFinite(Date.parse(row.availableAt)) && Number.isFinite(Date.parse(row.gameDate)) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt) && (row.gameDate < input.cutoffAt.slice(0, 10) || row.gameDate === input.cutoffAt.slice(0, 10) && !!row.finalBoxscore && /^[a-f0-9]{64}$/i.test(row.finalBoxscore.payloadHash) && Number.isFinite(Date.parse(row.finalBoxscore.fetchedAt)) && Date.parse(row.finalBoxscore.fetchedAt) <= Date.parse(input.cutoffAt)) && [input.seasonId, input.seasonId - 10001].includes(row.seasonId)).sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(availableGames.map((row) => row.gameId)).size !== availableGames.length) {
    throw new Error("Baseline appearances must have unique canonical game IDs.");
  }
  const previous = availableGames.filter((row) => row.seasonId === input.seasonId - 10001).slice(0, BASELINE_CANDIDATE_POLICY.previousAppearanceWindow);
  const recent = availableGames.filter((row) => row.seasonId === input.seasonId).slice(0, BASELINE_CANDIDATE_POLICY.recentAppearanceWindow);
  const targetKeys = /* @__PURE__ */ new Set([
    ...projections.flatMap((row) => Object.keys(row.totals)),
    ...previous.flatMap((row) => Object.keys(row.targets)),
    ...recent.flatMap((row) => Object.keys(row.targets))
  ]);
  const targets = [];
  for (const targetKey of [...targetKeys].filter((key) => ADDITIVE_SKATER_TARGETS.has(key)).sort()) {
    const sourceRows = projections.filter((row) => schemas.get(row.sourceId).statMappings.some((mapping) => mapping.key === targetKey) && validTarget(row.totals[targetKey], targetKey));
    const consensusRate = sourceRows.length ? sourceRows.reduce((sum, row) => sum + row.totals[targetKey] / row.projectedAppearances, 0) / sourceRows.length : null;
    const previousRows = previous.filter((row) => validTarget(row.targets[targetKey], targetKey));
    const previousSeasonRate = previousRows.length ? previousRows.reduce((sum, row) => sum + row.targets[targetKey], 0) / previousRows.length : null;
    if (consensusRate == null && previousSeasonRate == null) continue;
    const prior = consensusRate != null && previousSeasonRate != null ? BASELINE_CANDIDATE_POLICY.projectionPriorWeight * consensusRate + BASELINE_CANDIDATE_POLICY.historyPriorWeight * previousSeasonRate : consensusRate ?? previousSeasonRate;
    let weightedRecent = 0;
    let recentWeight = 0;
    const recentGameIds = [];
    const recentObservations = [];
    for (const [index, row] of recent.entries()) {
      const value = row.targets[targetKey];
      if (!validTarget(value, targetKey)) continue;
      const weight = BASELINE_CANDIDATE_POLICY.recentDecay ** index;
      weightedRecent += weight * value;
      recentWeight += weight;
      recentGameIds.push(row.gameId);
      recentObservations.push({
        gameId: row.gameId,
        teamId: row.teamId,
        gameDate: row.gameDate,
        availableAt: row.availableAt,
        ...row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}
      });
    }
    targets.push({
      targetKey,
      ratePerAppearance: (BASELINE_CANDIDATE_POLICY.priorAppearanceWeight * prior + weightedRecent) / (BASELINE_CANDIDATE_POLICY.priorAppearanceWeight + recentWeight),
      consensusRate,
      previousSeasonRate,
      recentAppearanceCount: recentGameIds.length,
      sourceRows: sourceRows.map((row) => ({
        sourceId: row.sourceId,
        rowId: row.sourceRowId,
        availableAt: row.availableAt
      })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      sourceRowIds: sourceRows.map((row) => row.sourceRowId).sort(),
      previousObservations: previousRows.map((row) => ({
        gameId: row.gameId,
        teamId: row.teamId,
        gameDate: row.gameDate,
        availableAt: row.availableAt,
        ...row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}
      })),
      recentObservations,
      previousGameIds: previousRows.map((row) => row.gameId),
      recentGameIds,
      missingSourceIds: BASELINE_CANDIDATE_POLICY.sourceIds.skater.filter((id4) => !sourceRows.some((row) => row.sourceId === id4))
    });
  }
  return {
    policyVersion: BASELINE_RATE_POLICY_VERSION,
    definitionHash: baselineDefinitionHash("skater", input.seasonId),
    validation: "unvalidated",
    playerId: input.playerId,
    nhlPlayerId: input.nhlPlayerId,
    seasonId: input.seasonId,
    cutoffAt: input.cutoffAt,
    sourceWatermark: input.sourceWatermark,
    targets,
    missingSourceIds: BASELINE_CANDIDATE_POLICY.sourceIds.skater.filter((id4) => !projections.some((row) => row.sourceId === id4)),
    missingTargetKeys: [...ADDITIVE_SKATER_TARGETS].filter((key) => !targets.some((row) => row.targetKey === key)).sort(),
    limitations: [
      "Unvalidated per-appearance rates; no participation, role, opponent or deployment adjustment.",
      "Missing projection sources are renormalized per target; missing ability priors leave targets unavailable.",
      `Candidate definition: ${baselineDefinitionHash("skater", input.seasonId)}.`,
      ...input.limitations ?? []
    ]
  };
}
function buildPriorAppearanceSkaterRates(input) {
  if (input.projections.length || !input.appearances.length || input.appearances.length > BASELINE_CANDIDATE_POLICY.previousAppearanceWindow || input.appearances.some((row) => row.seasonId !== input.seasonId - 10001 || !row.regularSeason || !Number.isFinite(Date.parse(row.availableAt)) || Date.parse(row.availableAt) > Date.parse(input.cutoffAt) || !/^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) || row.gameDate < `${String(input.seasonId - 10001).slice(0, 4)}-07-01` || row.gameDate >= `${String(input.seasonId).slice(0, 4)}-07-01` || !row.finalBoxscore || !Number.isSafeInteger(row.finalBoxscore.appearanceSeconds) || row.finalBoxscore.appearanceSeconds <= 0 || row.finalBoxscore.appearanceSeconds > 65 * 60)) {
    throw new Error("Prior appearance baseline requires bounded previous-season original positive minutes and no projections.");
  }
  const legacy = buildSkaterBaselineRates(input);
  const previous = [...input.appearances].sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  const minutes = previous.reduce((sum, row) => sum + row.finalBoxscore.appearanceSeconds, 0) / (60 * previous.length);
  const target = {
    targetKey: "TIME_ON_ICE_PER_GAME",
    ratePerAppearance: minutes,
    consensusRate: null,
    previousSeasonRate: minutes,
    recentAppearanceCount: 0,
    sourceRows: [],
    sourceRowIds: [],
    previousGameIds: previous.map((row) => row.gameId),
    recentGameIds: [],
    recentObservations: [],
    previousObservations: previous.map((row) => ({
      gameId: row.gameId,
      teamId: row.teamId,
      gameDate: row.gameDate,
      availableAt: row.availableAt,
      finalBoxscore: rateBoxscoreReference(row.finalBoxscore)
    })),
    missingSourceIds: [...BASELINE_CANDIDATE_POLICY.sourceIds.skater]
  };
  return {
    ...legacy,
    policyVersion: PRIOR_APPEARANCE_POLICY_VERSION,
    definitionHash: priorAppearanceDefinitionHash(input.seasonId),
    targets: [...legacy.targets, target].sort((a, b) => a.targetKey.localeCompare(b.targetKey)),
    limitations: [
      ...legacy.limitations,
      "Prior-only native extension adds arithmetic mean verified positive appearance minutes; count heads use unchanged legacy calculation.",
      "Selected prior history coverage is unverified; no current role, injury, participation or deployment adjustment."
    ]
  };
}
function buildCurrentAppearanceSkaterRates(input) {
  if (!Number.isSafeInteger(input.playerId) || input.playerId <= 0 || !Number.isSafeInteger(input.nhlPlayerId) || input.nhlPlayerId <= 0 || !validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark || input.projections.length || input.appearances.length > 200) throw new Error("Current appearance baseline requires bounded native identities and no projections.");
  const cutoff = Date.parse(input.cutoffAt);
  const eligible = input.appearances.filter((row) => row.seasonId === input.seasonId && row.regularSeason && Number.isFinite(Date.parse(row.availableAt)) && Date.parse(row.availableAt) <= cutoff && /^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) && row.gameDate <= input.cutoffAt.slice(0, 10) && !!row.finalBoxscore && Number.isFinite(Date.parse(row.finalBoxscore.fetchedAt)) && Date.parse(row.finalBoxscore.fetchedAt) <= cutoff).sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(eligible.map((row) => row.gameId)).size !== eligible.length) throw new Error("Current appearance game IDs must be unique.");
  const recent = eligible.slice(0, CURRENT_APPEARANCE_POLICY.maximumAppearances);
  const targets = [];
  for (const targetKey of CURRENT_APPEARANCE_POLICY.targets) {
    let numerator = 0, denominator = 0;
    const selected = [];
    for (const [index, row] of recent.entries()) {
      const value = row.targets[targetKey];
      if (!validTarget(value, targetKey)) continue;
      const weight = CURRENT_APPEARANCE_POLICY.decay ** index;
      numerator += weight * value;
      denominator += weight;
      selected.push(row);
    }
    if (!denominator) continue;
    targets.push({
      targetKey,
      ratePerAppearance: numerator / denominator,
      consensusRate: null,
      previousSeasonRate: null,
      recentAppearanceCount: selected.length,
      sourceRows: [],
      sourceRowIds: [],
      previousObservations: [],
      previousGameIds: [],
      missingSourceIds: [],
      recentGameIds: selected.map((row) => row.gameId),
      recentObservations: selected.map((row) => ({
        gameId: row.gameId,
        teamId: row.teamId,
        gameDate: row.gameDate,
        availableAt: row.availableAt,
        ...row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}
      }))
    });
  }
  return {
    policyVersion: CURRENT_APPEARANCE_POLICY_VERSION,
    definitionHash: currentAppearanceDefinitionHash(input.seasonId),
    validation: "unvalidated",
    playerId: input.playerId,
    nhlPlayerId: input.nhlPlayerId,
    seasonId: input.seasonId,
    cutoffAt: input.cutoffAt,
    sourceWatermark: input.sourceWatermark,
    targets,
    missingSourceIds: [],
    missingTargetKeys: CURRENT_APPEARANCE_POLICY.targets.filter((key) => !targets.some((row) => row.targetKey === key)),
    limitations: [
      "Unvalidated weighted current-season positive-minute appearance means; no prior or external projections.",
      "Selected history coverage is unverified; sparse support is retained explicitly and no participation probability is inferred.",
      "Whole-game boxscore counts include all strengths; TOI is verified positive appearance minutes. Missing targets remain unavailable.",
      ...input.limitations ?? []
    ]
  };
}

// web/lib/player-forecasts/contributions.ts
function forecastCalendarPolicy(calendarDays = 14) {
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 21) {
    throw new RangeError("Calendar horizon must be 1\u201321 days.");
  }
  return { version: "forecast-calendar-v1", calendarDays, overlapDays: 7, timeZone: "UTC" };
}
var DAY_MS = 24 * 60 * 60 * 1e3;

// web/lib/player-forecasts/contracts.ts
var PLAYER_FORECAST_DEBOUNCE_MS = 5 * 60 * 1e3;

// web/lib/player-forecasts/schedule.ts
var PLAYER_FORECAST_CALENDAR_HORIZON_DAYS = forecastCalendarPolicy().calendarDays;

// web/lib/supabase/server.ts
var import_supabase_js = require("@supabase/supabase-js");

// web/lib/projections/queryCaptureHook.ts
var interceptor;
function interceptProjectionQuery(method, args, live) {
  return interceptor?.(method, args, live);
}

// web/lib/supabase/server.ts
var cachedServiceRoleClient;
function getServiceRoleClient() {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Server-only Supabase access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  cachedServiceRoleClient = (0, import_supabase_js.createClient)(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return cachedServiceRoleClient;
}
var serviceRoleClient = new Proxy({}, {
  get(_target, property) {
    if (property === "from" || property === "rpc") {
      return (...args) => {
        const live = () => getServiceRoleClient()[property](...args);
        return interceptProjectionQuery(property, args, live) ?? live();
      };
    }
    const client = getServiceRoleClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// web/lib/player-forecasts/nativeGoalieOutcomes.ts
var import_node_crypto = require("node:crypto");
var id = (value) => Number.isSafeInteger(value) && Number(value) > 0;
var count = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
var invalid = () => {
  throw new Error("Native goalie outcomes require matching final boxscore and explicit starter/decision evidence.");
};
function deriveNativeGoalieOutcomes(input) {
  const { appearance, nhlPlayerId, cutoffAt } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "goalie");
  const receipt = appearance.finalBoxscore;
  const raw = receipt.rawRow, game = receipt.game, body = raw.payload;
  const cutoff = timestampMicros(cutoffAt), fetched = timestampMicros(receipt.fetchedAt), start = timestampMicros(game.startTime), bodyStart = timestampMicros(body.startTimeUTC);
  const period = body.periodDescriptor;
  const sourceIdValid = id(raw.id) || /^[a-f0-9]{64}$/.test(raw.payload_hash) && raw.id === `http:${raw.payload_hash}`;
  if (!id(nhlPlayerId) || !sourceIdValid || raw.endpoint !== "boxscore" || cutoff === null || fetched === null || start === null || bodyStart === null || bodyStart !== start || fetched < start || fetched > cutoff || timestampMicros(appearance.availableAt) !== cutoff || !period || ![3, 4, 5].includes(period.number) || period.maxRegulationPeriods !== 3 || period.periodType !== (period.number === 3 ? "REG" : period.number === 4 ? "OT" : "SO") || !count(body.homeTeam?.score) || !count(body.awayTeam?.score) || body.homeTeam.score === body.awayTeam.score || period.number > 3 && Math.abs(body.homeTeam.score - body.awayTeam.score) !== 1) invalid();
  const winner = body.homeTeam.score > body.awayTeam.score ? "homeTeam" : "awayTeam";
  let selected;
  let winCredits = 0, lossCredits = 0;
  for (const side of ["homeTeam", "awayTeam"]) {
    const goalies = body.playerByGameStats[side].goalies;
    if (!Array.isArray(goalies) || !goalies.length || goalies.length > 20 || goalies.filter((row) => row.starter === true).length !== 1) invalid();
    for (const goalie of goalies) {
      if (!goalie || !id(goalie.playerId) || goalie.position !== "G" || typeof goalie.starter !== "boolean") invalid();
      const components = baselineGoalieComponents(goalie);
      const decision = goalie.decision == null || goalie.decision === "" ? null : goalie.decision;
      if (decision !== null && !["W", "L", "O"].includes(decision)) invalid();
      if (decision !== null && components.toiMinutes <= 0) invalid();
      if (decision === "W") {
        if (side !== winner || ++winCredits > 1) invalid();
      } else if (decision === "L" || decision === "O") {
        if (side === winner || ++lossCredits > 1 || decision === "O" !== period.number > 3) invalid();
      }
      if (goalie.playerId === nhlPlayerId) selected = { row: goalie, decision };
    }
  }
  if (!selected) invalid();
  return {
    version: "native-goalie-outcomes-receipt-v1",
    classification: "private_historical_observed_outcomes",
    gameId: game.id,
    seasonId: game.seasonId,
    teamId: appearance.teamId,
    nhlPlayerId,
    conditioning: "positive_minute_historical_appearance",
    officialStarter: selected.row.starter,
    officialDecision: selected.decision,
    winCredit: selected.decision === null ? null : selected.decision === "W" ? 1 : 0,
    shutoutCredit: null,
    missingOutcomeEvidence: ["SHUTOUTS_GOALIE", ...selected.decision === null ? ["WINS_GOALIE"] : []],
    limitations: [
      "Explicit goalie decisions are observed win credits; relief wins are not start-conditioned observations.",
      "No credited shutout field is declared by this receipt; zero goals against and a team result cannot substitute.",
      "Historical labels do not establish a future start/appearance probability or authorize a rate-policy change."
    ],
    cutoffAt,
    sourceReceipt: {
      rawRowId: raw.id,
      providerPayloadHash: receipt.payloadHash,
      contentHash: receipt.contentHash,
      fetchedAt: receipt.fetchedAt
    },
    forecastIssued: false,
    released: false,
    qualificationEligible: false
  };
}
function nativeGoalieSummaryUrl(scope) {
  const season = String(scope.seasonId);
  const realDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!id(scope.nhlPlayerId) || !/^\d{8}$/.test(season) || Number(season.slice(0, 4)) + 1 !== Number(season.slice(4)) || !realDate(scope.startDate) || !realDate(scope.endDate) || scope.startDate > scope.endDate || scope.startDate < `${season.slice(0, 4)}-07-01` || scope.endDate >= `${season.slice(4)}-07-01` || Date.parse(scope.endDate) - Date.parse(scope.startDate) >= 60 * 864e5 || !Array.isArray(scope.approvedGameIds) || !scope.approvedGameIds.length || scope.approvedGameIds.length > 60 || new Set(scope.approvedGameIds).size !== scope.approvedGameIds.length || !scope.approvedGameIds.every(id)) {
    throw new Error("Native SO summary requires the bounded declared player/season/date/game scope.");
  }
  const params = new URLSearchParams({
    isAggregate: "false",
    isGame: "true",
    start: "0",
    limit: "50",
    factCayenneExp: "gamesPlayed>=1",
    cayenneExp: `playerId=${scope.nhlPlayerId} and seasonId=${scope.seasonId} and gameDate>="${scope.startDate}" and gameDate<="${scope.endDate}" and gameTypeId=2`
  });
  return `https://api.nhle.com/stats/rest/en/goalie/summary?${params.toString().replace(/\+/g, "%20")}`;
}
function deriveNativeGoalieShutoutCredit(input) {
  const { appearance, nhlPlayerId, cutoffAt, summary } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "goalie");
  const expectedUrl = nativeGoalieSummaryUrl(summary.scope), original = summary.receipts;
  if (summary.scope.nhlPlayerId !== nhlPlayerId || summary.scope.seasonId !== appearance.seasonId || !summary.scope.approvedGameIds.includes(appearance.gameId) || appearance.gameDate < summary.scope.startDate || appearance.gameDate > summary.scope.endDate || !Array.isArray(original) || original.length !== 1) throw new Error("SO appearance is outside the approved summary cohort.");
  const receipt = original[0], fetched = timestampMicros(receipt.capturedAt), cutoff = timestampMicros(cutoffAt);
  const source2 = appearance.finalBoxscore;
  if (receipt.url !== expectedUrl || typeof receipt.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024 || !/^[a-f0-9]{64}$/.test(receipt.bodySha256) || (0, import_node_crypto.createHash)("sha256").update(receipt.rawBody, "utf8").digest("hex") !== receipt.bodySha256 || fetched === null || cutoff === null || fetched > cutoff || fetched < timestampMicros(source2.game.startTime)) {
    throw new Error("Invalid original SO summary receipt URL/hash/clock.");
  }
  const body = JSON.parse(receipt.rawBody);
  if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total !== body.data.length || body.total < 0 || body.total >= 50) throw new Error("SO summary single-page completeness is unverified.");
  const matches = body.data.filter((row2) => row2?.gameId === appearance.gameId);
  const row = matches.length === 1 ? matches[0] : null;
  const coherent = row && row.playerId === nhlPlayerId && (row.seasonId === void 0 || row.seasonId === appearance.seasonId) && row.gameDate === appearance.gameDate && row.gamesPlayed === 1 && [0, 1].includes(row.shutouts) && [row.saves, row.goalsAgainst, row.shotsAgainst, row.timeOnIce].every(count) && row.saves === appearance.saves && row.goalsAgainst === appearance.goalsAgainst && row.shotsAgainst === appearance.shotsAgainst && row.saves + row.goalsAgainst === row.shotsAgainst && row.timeOnIce === source2.appearanceSeconds && row.timeOnIce > 0 && row.timeOnIce <= 65 * 60 && !(row.shutouts === 1 && row.goalsAgainst !== 0);
  return {
    shutoutCredit: coherent ? row.shutouts : null,
    reason: coherent ? null : matches.length > 1 ? "ambiguous_summary_row" : !row ? "missing_summary_row" : "incoherent_or_unsupported_summary_fields",
    fullPageRows: body.data.length,
    usedGameId: appearance.gameId,
    sourceReceipt: { id: `http:${receipt.bodySha256}`, url: receipt.url, fetchedAt: receipt.capturedAt, bodySha256: receipt.bodySha256 },
    conditioning: "positive_minute_historical_appearance",
    released: false,
    forecastIssued: false
  };
}

// web/lib/player-forecasts/goalieBaselineRates.ts
var GOALIE_BASELINE_POLICY_VERSION = "goalie-baseline-rates-v1";
var NATIVE_GOALIE_WIN_POLICY_VERSION = "native-goalie-appearance-win-rates-v1";
var NATIVE_GOALIE_WIN_POLICY = Object.freeze({
  version: NATIVE_GOALIE_WIN_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes",
  maximumAppearances: 20,
  target: "WINS_GOALIE",
  basis: "per_appearance",
  weighting: "equal",
  missingness: "any_missing_selected_outcome_withholds_rate",
  prior: "none",
  participation: "not_supplied",
  populationCoverage: "unverified",
  shutouts: "unavailable_without_credited_outcome_receipt"
});
var nativeGoalieWinDefinitionHash = (seasonId) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_WIN_POLICY, seasonId });
var NATIVE_GOALIE_VOLUME_POLICY_VERSION = "native-goalie-appearance-volume-rates-v1";
var NATIVE_GOALIE_VOLUME_POLICY = Object.freeze({
  version: NATIVE_GOALIE_VOLUME_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes",
  maximumAppearances: 20,
  targets: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"],
  basis: "per_appearance",
  weighting: "equal",
  missingness: "all_four_components_required_on_every_selected_appearance",
  maximumMinutes: 65,
  prior: "none",
  participation: "not_supplied",
  populationCoverage: "unverified"
});
var nativeGoalieVolumeDefinitionHash = (seasonId) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_VOLUME_POLICY, seasonId });
var NATIVE_GOALIE_SHUTOUT_POLICY_VERSION = "native-goalie-appearance-shutout-rates-v1";
var NATIVE_GOALIE_SHUTOUT_POLICY = Object.freeze({
  version: NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
  maximumAppearances: 20,
  target: "SHUTOUTS_GOALIE",
  basis: "per_appearance",
  weighting: "equal",
  source: "official_per_game_summary_credited_shutouts",
  missingness: "any_missing_or_ambiguous_selected_credit_withholds_rate",
  summaryMaximumDays: 60,
  summaryMaximumGames: 60,
  participation: "not_supplied",
  prior: "none"
});
var nativeGoalieShutoutDefinitionHash = (seasonId) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_SHUTOUT_POLICY, seasonId });
var APPEARANCE_TARGETS = BASELINE_CANDIDATE_POLICY.goalieVolumeTargets;
var START_TARGETS = BASELINE_CANDIDATE_POLICY.goalieStartTargets;
var validCount = (value) => value != null && Number.isFinite(value) && value >= 0;
var validTime = (value) => Number.isFinite(Date.parse(value));
function buildGoalieBaselineRates(input) {
  if (!Number.isSafeInteger(input.playerId) || input.playerId <= 0 || !Number.isSafeInteger(input.nhlPlayerId) || input.nhlPlayerId <= 0 || !validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark) {
    throw new Error("Goalie baseline identity and cutoff are required.");
  }
  const schemas = new Map(baselineProjectionSchemas("goalie", input.seasonId).map((row) => [row.id, row]));
  const projections = input.projections.filter((row) => row.seasonId === input.seasonId && !!schemas.get(row.sourceId)?.tableName && (row.sourceTable == null || row.sourceTable === schemas.get(row.sourceId)?.tableName) && Number.isFinite(Date.parse(row.availableAt)) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt) && Number.isFinite(row.projectedAppearances) && row.projectedAppearances > 0 && row.projectedAppearances <= BASELINE_CANDIDATE_POLICY.maximumGoalieProjectedAppearances);
  if (new Set(projections.map((row) => row.sourceId)).size !== projections.length) {
    throw new Error("Goalie baseline requires one row per approved source.");
  }
  const appearances = input.appearances.filter((row) => row.regularSeason && [input.seasonId, input.seasonId - 10001].includes(row.seasonId) && Number.isFinite(Date.parse(row.availableAt)) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt) && (row.gameDate < input.cutoffAt.slice(0, 10) || row.gameDate === input.cutoffAt.slice(0, 10) && !!row.finalBoxscore && /^[a-f0-9]{64}$/i.test(row.finalBoxscore.payloadHash) && validTime(row.finalBoxscore.fetchedAt) && Date.parse(row.finalBoxscore.fetchedAt) <= Date.parse(input.cutoffAt))).sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(appearances.map((row) => row.gameId)).size !== appearances.length) {
    throw new Error("Goalie baseline appearances must have unique games.");
  }
  const previous = appearances.filter((row) => row.seasonId === input.seasonId - 10001).slice(0, BASELINE_CANDIDATE_POLICY.previousAppearanceWindow);
  const recent = appearances.filter((row) => row.seasonId === input.seasonId).slice(0, BASELINE_CANDIDATE_POLICY.recentAppearanceWindow);
  const targets = [];
  for (const targetKey of [...APPEARANCE_TARGETS, ...START_TARGETS]) {
    const basis = START_TARGETS.includes(targetKey) ? "per_start" : "per_appearance";
    const rows = projections.filter((row) => schemas.get(row.sourceId).statMappings.some((mapping) => mapping.key === targetKey) && validCount(row.totals[targetKey]) && (basis === "per_appearance" || !!schemas.get(row.sourceId).startColumn && row.projectedStarts != null && Number.isFinite(row.projectedStarts) && row.projectedStarts > 0 && row.projectedStarts <= row.projectedAppearances));
    const rates = rows.map((row) => ({ row, rate: row.totals[targetKey] / (basis === "per_start" ? row.projectedStarts : row.projectedAppearances) })).filter((item) => basis !== "per_start" || item.rate <= 1);
    const sourceRates = rates.map((item) => item.rate);
    const consensusRate = sourceRates.length ? sourceRates.reduce((sum, value2) => sum + value2, 0) / sourceRates.length : null;
    const value = (row) => targetKey === "SAVES_GOALIE" ? row.saves : targetKey === "GOALS_AGAINST_GOALIE" ? row.goalsAgainst : targetKey === "GOALIE_MINUTES" ? row.toiMinutes : row.shotsAgainst;
    const previousRows = basis === "per_appearance" ? previous.filter((row) => validCount(value(row))) : [];
    const previousSeasonRate = previousRows.length ? previousRows.reduce((sum, row) => sum + value(row), 0) / previousRows.length : null;
    if (consensusRate == null && previousSeasonRate == null) continue;
    const prior = consensusRate != null && previousSeasonRate != null ? BASELINE_CANDIDATE_POLICY.projectionPriorWeight * consensusRate + BASELINE_CANDIDATE_POLICY.historyPriorWeight * previousSeasonRate : consensusRate ?? previousSeasonRate;
    let recentWeighted = 0;
    let recentWeight = 0;
    const recentGameIds = [];
    if (basis === "per_appearance") for (const [index, row] of recent.entries()) {
      const observation = value(row);
      if (!validCount(observation)) continue;
      const weight = BASELINE_CANDIDATE_POLICY.recentDecay ** index;
      recentWeighted += weight * observation;
      recentWeight += weight;
      recentGameIds.push(row.gameId);
    }
    targets.push({
      targetKey,
      basis,
      rate: (BASELINE_CANDIDATE_POLICY.priorAppearanceWeight * prior + recentWeighted) / (BASELINE_CANDIDATE_POLICY.priorAppearanceWeight + recentWeight),
      consensusRate,
      previousSeasonRate,
      sourceRows: rates.map(({ row }) => ({
        sourceId: row.sourceId,
        rowId: row.sourceRowId,
        availableAt: row.availableAt
      })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      previousGameIds: previousRows.map((row) => row.gameId),
      recentGameIds,
      missingSourceIds: BASELINE_CANDIDATE_POLICY.sourceIds.goalie.filter((id4) => !rates.some((item) => item.row.sourceId === id4))
    });
  }
  return {
    policyVersion: GOALIE_BASELINE_POLICY_VERSION,
    validation: "unvalidated",
    definitionHash: baselineDefinitionHash("goalie", input.seasonId),
    playerId: input.playerId,
    nhlPlayerId: input.nhlPlayerId,
    seasonId: input.seasonId,
    cutoffAt: input.cutoffAt,
    sourceWatermark: input.sourceWatermark,
    targets,
    missingSourceIds: BASELINE_CANDIDATE_POLICY.sourceIds.goalie.filter((id4) => !projections.some((row) => row.sourceId === id4)),
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter((key) => !targets.some((row) => row.targetKey === key)).sort(),
    limitations: [
      "Goalie rates are unvalidated. Starts and appearances have separate denominators.",
      "Historical game logs do not establish starts, wins or shutouts; those start rates use public projection totals only.",
      "Save percentage and GAA require aggregate saves/shots and goals-against/TOI components; they are not direct baseline targets.",
      "Missing projection sources are renormalized per target; missing ability priors leave targets unavailable.",
      `Candidate definition: ${baselineDefinitionHash("goalie", input.seasonId)}.`,
      ...input.limitations ?? []
    ]
  };
}
function currentGoalieAppearanceWindow(input, maximum) {
  return input.appearances.filter((row) => row.regularSeason && row.seasonId === input.seasonId && validTime(row.availableAt) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt) && /^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) && row.gameDate <= input.cutoffAt.slice(0, 10)).sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId).slice(0, maximum);
}
function buildNativeGoalieWinRates(input) {
  if (input.projections.length || input.appearances.length > 200) {
    throw new Error("Native goalie win rates require bounded original appearances without projections.");
  }
  const base2 = buildGoalieBaselineRates(input);
  const selected = currentGoalieAppearanceWindow(input, NATIVE_GOALIE_WIN_POLICY.maximumAppearances);
  let wins = 0;
  const missingGameIds = [];
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    try {
      const receipt = deriveNativeGoalieOutcomes({ appearance, nhlPlayerId: input.nhlPlayerId, cutoffAt: input.cutoffAt });
      if (receipt.winCredit === null) missingGameIds.push(appearance.gameId);
      else wins += receipt.winCredit;
    } catch (error) {
      if (!(error instanceof Error) || ![
        "Native goalie outcomes require matching final boxscore and explicit starter/decision evidence.",
        "Incomplete or conflicting boxscore goalie components"
      ].includes(error.message)) throw error;
      missingGameIds.push(appearance.gameId);
    }
  }
  const targets = selected.length && !missingGameIds.length ? [{
    targetKey: "WINS_GOALIE",
    basis: "per_appearance",
    rate: wins / selected.length,
    consensusRate: null,
    previousSeasonRate: null,
    sourceRows: [],
    previousGameIds: [],
    recentGameIds: selected.map((row) => row.gameId),
    missingSourceIds: []
  }] : [];
  return {
    ...base2,
    policyVersion: NATIVE_GOALIE_WIN_POLICY_VERSION,
    definitionHash: nativeGoalieWinDefinitionHash(input.seasonId),
    targets,
    missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter((key) => !targets.some((row) => row.targetKey === key)).sort(),
    limitations: [
      "Unvalidated current-season observed win credits per positive-minute appearance, including relief; no start or appearance probability is inferred.",
      `Equal-weight mean over ${selected.length} selected captured appearances; historical population coverage is unverified.`,
      "Any missing selected win decision withholds the entire rate; missing decisions are never zero or omitted from the denominator.",
      "Credited shutouts remain unavailable without an explicit credited-outcome source; zero goals against does not establish shutout credit.",
      ...missingGameIds.length ? [`Win evidence is unavailable for selected games: ${missingGameIds.join(", ")}.`] : [],
      ...input.limitations ?? []
    ]
  };
}
function buildNativeGoalieVolumeRates(input) {
  if (input.projections.length || input.appearances.length > 200) {
    throw new Error("Native goalie volume rates require bounded original appearances without projections.");
  }
  const base2 = buildGoalieBaselineRates(input);
  const selected = currentGoalieAppearanceWindow(input, NATIVE_GOALIE_VOLUME_POLICY.maximumAppearances);
  const totals = { SAVES_GOALIE: 0, GOALS_AGAINST_GOALIE: 0, SHOTS_AGAINST_GOALIE: 0, GOALIE_MINUTES: 0 };
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    const { saves, goalsAgainst, shotsAgainst, toiMinutes } = appearance;
    if (!validCount(saves) || !validCount(goalsAgainst) || !validCount(shotsAgainst) || saves + goalsAgainst !== shotsAgainst || !validCount(toiMinutes) || toiMinutes <= 0 || toiMinutes > NATIVE_GOALIE_VOLUME_POLICY.maximumMinutes) {
      throw new Error("Native goalie appearance volume requires coherent counts and positive minutes at most 65.");
    }
    totals.SAVES_GOALIE += saves;
    totals.GOALS_AGAINST_GOALIE += goalsAgainst;
    totals.SHOTS_AGAINST_GOALIE += shotsAgainst;
    totals.GOALIE_MINUTES += toiMinutes;
  }
  const targets = selected.length ? Object.entries(totals).map(([targetKey, total]) => ({
    targetKey,
    basis: "per_appearance",
    rate: total / selected.length,
    consensusRate: null,
    previousSeasonRate: null,
    sourceRows: [],
    previousGameIds: [],
    recentGameIds: selected.map((row) => row.gameId),
    missingSourceIds: []
  })) : [];
  return {
    ...base2,
    policyVersion: NATIVE_GOALIE_VOLUME_POLICY_VERSION,
    definitionHash: nativeGoalieVolumeDefinitionHash(input.seasonId),
    targets,
    missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter((key) => !targets.some((row) => row.targetKey === key)).sort(),
    limitations: [
      "Unvalidated joint current-season volume means per positive-minute appearance, including relief; no start or appearance probability is inferred.",
      `Equal-weight means over the same ${selected.length} selected captured appearances; historical population coverage is unverified.`,
      "Saves, goals against, shots against and positive TOI minutes require original final-boxscore support on every selected appearance.",
      "Wins and credited shutouts are not volume observations; neither is inferred from goals against or TOI.",
      ...input.limitations ?? []
    ]
  };
}
function buildNativeGoalieShutoutRates(input) {
  if (input.projections.length || input.appearances.length > 200) throw new Error("Native SO rates require bounded original appearances without projections.");
  const base2 = buildGoalieBaselineRates(input), selected = currentGoalieAppearanceWindow(input, 20);
  let credits = 0;
  const missingGameIds = [];
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    const credit = input.shutoutSummary ? deriveNativeGoalieShutoutCredit({
      appearance,
      nhlPlayerId: input.nhlPlayerId,
      cutoffAt: input.cutoffAt,
      summary: input.shutoutSummary
    }).shutoutCredit : null;
    if (credit === null) missingGameIds.push(appearance.gameId);
    else credits += credit;
  }
  const targets = selected.length && !missingGameIds.length ? [{
    targetKey: "SHUTOUTS_GOALIE",
    basis: "per_appearance",
    rate: credits / selected.length,
    consensusRate: null,
    previousSeasonRate: null,
    sourceRows: [],
    previousGameIds: [],
    recentGameIds: selected.map((row) => row.gameId),
    missingSourceIds: []
  }] : [];
  return {
    ...base2,
    policyVersion: NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
    definitionHash: nativeGoalieShutoutDefinitionHash(input.seasonId),
    targets,
    missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter((key) => !targets.some((row) => row.targetKey === key)).sort(),
    limitations: [
      "Unvalidated explicit official credited shutouts per selected positive-minute appearance; no GA=0 inference or participation probability.",
      "The original full summary page is exposed; only approved game IDs bound to original boxscore appearances enter this mean.",
      ...missingGameIds.length ? [`Missing or ambiguous credited SO for selected games: ${missingGameIds.join(",")}.`] : [],
      ...input.limitations ?? []
    ]
  };
}

// web/lib/player-forecasts/nativePowerPlayPoints.ts
var id2 = (value) => Number.isSafeInteger(value) && Number(value) > 0;
var receiptId = (raw) => id2(raw.id) || typeof raw.id === "string" && /^[a-f0-9]{64}$/.test(raw.payload_hash) && raw.id === `http:${raw.payload_hash}`;
var count2 = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
var record2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var invalid2 = () => {
  throw new Error("Private PPP requires complete, matching original landing and boxscore receipts.");
};
function deriveNativePowerPlayPoints(input) {
  const { appearance, landing, nhlPlayerId, cutoffAt } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "skater");
  const boxscore = appearance.finalBoxscore;
  const game = boxscore.game, raw = landing.rawRow, body = raw?.payload;
  const cutoff = timestampMicros(cutoffAt), fetched = timestampMicros(raw?.fetched_at);
  const gameStart = timestampMicros(game.startTime), landingStart = timestampMicros(body?.startTimeUTC), boxscoreFetched = timestampMicros(boxscore.fetchedAt);
  if (!id2(nhlPlayerId) || !record2(raw) || !receiptId(raw) || !receiptId(boxscore.rawRow) || raw.endpoint !== "landing" || raw.game_id !== game.id || raw.season_id !== game.seasonId || !record2(body) || body.id !== game.id || body.season !== game.seasonId || body.gameDate !== game.date || body.gameType !== 2 || !["FINAL", "OFF"].includes(body.gameState) || cutoff === null || fetched === null || gameStart === null || landingStart === null || boxscoreFetched === null || fetched < gameStart || fetched > cutoff || boxscoreFetched < gameStart || boxscoreFetched > cutoff || !/^[a-f0-9]{64}$/.test(raw.payload_hash) || landing.contentHash !== playerForecastSourcePayloadHash(body) || landingStart !== gameStart || body.homeTeam?.id !== game.homeTeamId || body.awayTeam?.id !== game.awayTeamId || !count2(body.homeTeam?.score) || !count2(body.awayTeam?.score)) invalid2();
  const players = /* @__PURE__ */ new Map();
  for (const side of ["homeTeam", "awayTeam"]) {
    const stats = boxscore.rawRow.payload.playerByGameStats[side];
    if (!record2(stats) || !Array.isArray(stats.forwards) || !Array.isArray(stats.defense) || !Array.isArray(stats.goalies) || !stats.goalies.length || stats.forwards.length + stats.defense.length === 0) invalid2();
    for (const [population, rows] of [["skater", [...stats.forwards, ...stats.defense]], ["goalie", stats.goalies]]) {
      for (const player of rows) {
        if (!record2(player) || !id2(player.playerId) || players.has(player.playerId) || population === "skater" && ![player.goals, player.assists, player.powerPlayGoals].every(count2)) invalid2();
        players.set(player.playerId, {
          home: side === "homeTeam",
          skater: population === "skater",
          row: player,
          goals: 0,
          assists: 0,
          ppGoals: 0
        });
      }
    }
  }
  if (!players.get(nhlPlayerId)?.skater || players.get(nhlPlayerId).home !== (appearance.teamId === game.homeTeamId)) invalid2();
  const finalPeriod = body.periodDescriptor, periods = body.summary?.scoring;
  if (!record2(finalPeriod) || !id2(finalPeriod.number) || finalPeriod.number < 3 || finalPeriod.number > 5 || finalPeriod.periodType !== (finalPeriod.number === 5 ? "SO" : finalPeriod.number === 4 ? "OT" : "REG") || !Array.isArray(periods) || periods.length !== finalPeriod.number) invalid2();
  const periodIds = /* @__PURE__ */ new Set(), eventIds = /* @__PURE__ */ new Set();
  const teamGoals = { home: 0, away: 0 };
  const credits = [];
  let powerPlayGoals = 0, powerPlayAssists = 0;
  for (const period of periods) {
    const descriptor = period?.periodDescriptor;
    if (!record2(descriptor) || !id2(descriptor.number) || descriptor.number > finalPeriod.number || periodIds.has(descriptor.number) || descriptor.maxRegulationPeriods !== 3 || descriptor.periodType !== (descriptor.number === 5 ? "SO" : descriptor.number === 4 ? "OT" : "REG") || !Array.isArray(period.goals) || period.goals.length > 50) invalid2();
    periodIds.add(descriptor.number);
    for (const goal of period.goals) {
      if (!record2(goal) || !id2(goal.eventId) || eventIds.has(goal.eventId)) invalid2();
      eventIds.add(goal.eventId);
      if (descriptor.periodType === "SO") continue;
      const scorer = players.get(goal.playerId);
      if (!scorer || typeof goal.isHome !== "boolean" || scorer.home !== goal.isHome || !["ev", "pp", "sh"].includes(goal.strength) || !Array.isArray(goal.assists) || goal.assists.length > 2) invalid2();
      const assistIds = goal.assists.map((assist) => assist?.playerId);
      if (new Set(assistIds).size !== assistIds.length || assistIds.includes(goal.playerId) || assistIds.some((playerId) => !id2(playerId) || !players.has(playerId) || players.get(playerId).home !== scorer.home)) invalid2();
      scorer.goals++;
      teamGoals[scorer.home ? "home" : "away"]++;
      for (const playerId of assistIds) players.get(playerId).assists++;
      if (goal.strength === "pp") {
        scorer.ppGoals++;
        if (goal.playerId === nhlPlayerId) {
          powerPlayGoals++;
          credits.push({ eventId: goal.eventId, period: descriptor.number, role: "goal" });
        }
        if (assistIds.includes(nhlPlayerId)) {
          powerPlayAssists++;
          credits.push({ eventId: goal.eventId, period: descriptor.number, role: "assist" });
        }
      }
    }
  }
  const homeScore = body.homeTeam.score, awayScore = body.awayTeam.score;
  const shootout = finalPeriod.periodType === "SO";
  if (shootout && Math.abs(homeScore - awayScore) !== 1 || teamGoals.home !== homeScore - (shootout && homeScore > awayScore ? 1 : 0) || teamGoals.away !== awayScore - (shootout && awayScore > homeScore ? 1 : 0)) invalid2();
  for (const player of players.values()) {
    if (player.skater && (player.goals !== player.row.goals || player.assists !== player.row.assists || player.ppGoals !== player.row.powerPlayGoals)) invalid2();
  }
  return {
    version: "native-power-play-points-count-v1",
    classification: "private_historical_observed_counts",
    targetKey: "PP_POINTS",
    gameId: game.id,
    seasonId: game.seasonId,
    teamId: appearance.teamId,
    nhlPlayerId,
    unit: "count",
    conditioning: "positive_minute_historical_appearance",
    powerPlayGoals,
    powerPlayAssists,
    powerPlayPoints: powerPlayGoals + powerPlayAssists,
    credits,
    cutoffAt,
    sourceReceipts: {
      landing: { rawRowId: raw.id, providerPayloadHash: raw.payload_hash, contentHash: landing.contentHash, fetchedAt: raw.fetched_at },
      boxscore: {
        rawRowId: boxscore.rawRow.id,
        providerPayloadHash: boxscore.payloadHash,
        contentHash: boxscore.contentHash,
        fetchedAt: boxscore.fetchedAt
      }
    },
    forecastIssued: false,
    released: false,
    qualificationEligible: false
  };
}

// web/lib/player-forecasts/currentRosterInjuryEvidence.ts
function classifyCurrentRosterInjuryEvidence(evidence, player, seasonId, cutoffAt) {
  const unknown = (reason) => ({ sourceId: evidence.sourceId, status: "unknown", reason });
  const cutoff = timestampMicros(cutoffAt), observed = timestampMicros(evidence.observedAt), captured = timestampMicros(evidence.capturedAt), expires = timestampMicros(evidence.expiresAt);
  if (evidence.playerId !== player.playerId || evidence.nhlPlayerId !== player.nhlPlayerId || evidence.seasonId !== seasonId) return unknown("identity_or_season_mismatch");
  if (cutoff === null || observed === null || captured === null || expires === null || observed > captured || captured > cutoff || expires <= cutoff || cutoff - observed > BigInt(24 * 60 * 60 * 1e6)) return unknown("stale_or_invalid_source_clock");
  if (typeof evidence.sourceId !== "string" || !evidence.sourceId.trim() || !/^[a-f0-9]{64}$/.test(evidence.contentHash) || playerForecastSourcePayloadHash(evidence.payload) !== evidence.contentHash) return unknown("source_provenance_unverified");
  if (evidence.provider === "yahoo") {
    if (evidence.sourceKind !== "original_provider_payload") return unknown("merged_yahoo_field_freshness_unknown");
    if (!player.yahooPlayerKey || evidence.payload.player_key !== player.yahooPlayerKey) return unknown("yahoo_identity_binding_unverified");
    const strings = [evidence.payload.status, evidence.payload.status_full, evidence.payload.injury_note].map((value) => typeof value === "string" ? value.trim().toLowerCase() : "");
    const injury = strings.some((value) => /^(?:ir|ir-lt|ltir|injured|injured reserve|(?:upper|lower)[ -]body injury|(?:ankle|arm|back|foot|hand|hip|knee|leg|shoulder|wrist) injury|concussion)$/.test(value));
    const conflicting = strings.some((value) => /\b(?:healthy|available|active|no injury|not injured|cleared to play)\b/.test(value));
    if (!injury || conflicting) return unknown(conflicting ? "conflicting_or_return_status" : "no_unambiguous_injury_status");
  } else if (evidence.provider === "ifttt") {
    const { event, text } = evidence.payload;
    if (!event || event.playerId !== player.playerId || event.teamId != null && event.teamId !== player.teamId || event.kind !== "injury" || event.modality !== "affirmative" || event.reviewReason || !["new_injury", "ongoing", "setback"].includes(event.state) || ["available", "uncertain"].includes(event.availability) || event.availabilityScope !== "unspecified" || event.effectiveDate != null || !event.evidence || !Number.isSafeInteger(event.evidence.start) || !Number.isSafeInteger(event.evidence.end) || event.evidence.start < 0 || event.evidence.end <= event.evidence.start || typeof text !== "string" || event.evidence.end > text.length || text.slice(event.evidence.start, event.evidence.end) !== event.evidence.text || !/\b(?:injur\w*|surgery|concussion|setback|rehab\w*|recover\w*)\b/i.test(event.evidence.text)) {
      return unknown("injury_claim_or_current_applicability_unverified");
    }
  } else return unknown("unsupported_provider");
  return { sourceId: evidence.sourceId, status: "injury_supported", reason: "current_explicit_injury_evidence" };
}

// web/lib/player-forecasts/currentRosterNativeInputs.ts
var id3 = (value) => Number.isSafeInteger(value) && Number(value) > 0;
var urlFor = (gameId, endpoint) => `https://api-web.nhle.com/v1/gamecenter/${gameId}/${endpoint}`;
var sha = (value) => (0, import_node_crypto2.createHash)("sha256").update(value, "utf8").digest("hex");
function assembleCurrentRosterNativeInputs(input, now = /* @__PURE__ */ new Date()) {
  const cutoff = timestampMicros(input.cutoffAt), clock = Number.isFinite(now.getTime()) ? BigInt(now.getTime()) * BigInt(1e3) : null;
  if (cutoff === null || clock === null || cutoff > clock || !Number.isSafeInteger(input.seasonId) || !/^\d{8}$/.test(String(input.seasonId)) || Math.floor(input.seasonId / 1e4) + 1 !== input.seasonId % 1e4 || !Array.isArray(input.roster) || !input.roster.length || input.roster.length > 50 || new Set(input.roster.map((row) => row.playerId)).size !== input.roster.length || new Set(input.roster.map((row) => row.nhlPlayerId)).size !== input.roster.length || input.roster.some((row) => ![row.playerId, row.nhlPlayerId, row.teamId].every(id3) || !row.rosterRevision?.trim() || !["skater", "goalie"].includes(row.playerClass)) || !Array.isArray(input.games) || input.games.length > 60 || new Set(input.games.map((game) => game.id)).size !== input.games.length || !Array.isArray(input.receipts) || input.receipts.length + (input.failures?.length ?? 0) > 120) throw new Error("Invalid bounded current-roster native scope.");
  if (input.injuryEvidence !== void 0 && (!Array.isArray(input.injuryEvidence) || input.injuryEvidence.length > 100 || input.injuryEvidence.some((row) => !row || typeof row !== "object" || !row.payload || Buffer.byteLength(JSON.stringify(row)) > 16384))) throw new Error("Invalid bounded optional injury evidence.");
  const approved = /* @__PURE__ */ new Map();
  for (const game of input.games) {
    const start = timestampMicros(game.startTime);
    if (![game.id, game.homeTeamId, game.awayTeamId].every(id3) || game.homeTeamId === game.awayTeamId || game.seasonId !== input.seasonId || game.type !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(game.date) || !Number.isFinite(Date.parse(game.date)) || new Date(game.date).toISOString().slice(0, 10) !== game.date || start === null || start >= cutoff || !Array.isArray(game.endpoints) || !game.endpoints.includes("boxscore") || new Set(game.endpoints).size !== game.endpoints.length || game.endpoints.some((endpoint) => !["boxscore", "landing"].includes(endpoint))) {
      throw new Error("Historical game is outside the approved identity/clock scope.");
    }
    for (const endpoint of game.endpoints) approved.set(urlFor(game.id, endpoint), { game, endpoint });
  }
  if (approved.size > 120) throw new Error("Approved source request bound exceeded.");
  const failures = /* @__PURE__ */ new Map();
  for (const failure of input.failures ?? []) {
    if (!approved.has(failure.url) || failures.has(failure.url) || typeof failure.reason !== "string" || !failure.reason.trim()) throw new Error("Invalid or unapproved failed source receipt.");
    failures.set(failure.url, failure.reason);
  }
  const rows = /* @__PURE__ */ new Map();
  let totalBytes = 0;
  for (const receipt of input.receipts) {
    const bound = approved.get(receipt.url), captured = timestampMicros(receipt.capturedAt);
    if (!bound || rows.has(receipt.url) || failures.has(receipt.url) || typeof receipt.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024 || !/^[a-f0-9]{64}$/.test(receipt.bodySha256) || sha(receipt.rawBody) !== receipt.bodySha256 || captured === null || captured > cutoff || captured < timestampMicros(bound.game.startTime)) throw new Error("Invalid original HTTP receipt/hash/URL/clock.");
    totalBytes += Buffer.byteLength(receipt.rawBody);
    if (totalBytes > 32 * 1024 * 1024) throw new Error("Original source byte budget exceeded.");
    const body = JSON.parse(receipt.rawBody), game = bound.game;
    if (!body || typeof body !== "object" || Array.isArray(body) || body.id !== game.id || body.season !== game.seasonId || body.gameDate !== game.date || body.gameType !== 2 || timestampMicros(body.startTimeUTC) !== timestampMicros(game.startTime) || body.homeTeam?.id !== game.homeTeamId || body.awayTeam?.id !== game.awayTeamId) throw new Error("HTTP source game identity conflicts with approved scope.");
    rows.set(receipt.url, {
      id: `http:${receipt.bodySha256}`,
      endpoint: bound.endpoint,
      game_id: game.id,
      season_id: game.seasonId,
      payload_hash: receipt.bodySha256,
      fetched_at: receipt.capturedAt,
      payload: body,
      httpReceipt: structuredClone(receipt)
    });
  }
  const skaters = [], goalieWins = [], goalieVolume = [];
  const coverage = input.roster.map((player) => {
    const appearances = [], goalieAppearances = [];
    const landings = [];
    const games = [];
    for (const game of input.games) {
      const boxUrl = urlFor(game.id, "boxscore"), raw = rows.get(boxUrl), reasons = [];
      if (!raw) {
        games.push({ gameId: game.id, historicalTeamId: null, status: "unavailable", reasons: [failures.get(boxUrl) ?? "missing_boxscore_receipt"] });
        continue;
      }
      const final = finalBoxscoreForGame(raw, game);
      if (!final) throw new Error("Historical boxscore is malformed or not final.");
      const home = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.homeTeamId }, final);
      const away = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.awayTeamId }, final);
      if (!home || !away) throw new Error("Boxscore player identities are malformed or duplicated across teams.");
      const own = home.skater || home.goalie ? home : away.skater || away.goalie ? away : null;
      if (!own) {
        games.push({ gameId: game.id, historicalTeamId: null, status: "excluded", reasons: ["absent_from_selected_game"] });
        continue;
      }
      if (!(player.playerClass === "skater" ? own.skater : own.goalie)) throw new Error("Canonical player class conflicts with original boxscore.");
      const teamId = own.side === "homeTeam" ? game.homeTeamId : game.awayTeamId;
      const appearance = baselineAppearanceFromBoxscore({
        rawRow: raw,
        game,
        nhlPlayerId: player.nhlPlayerId,
        teamId,
        cutoffAt: input.cutoffAt,
        population: player.playerClass
      });
      if (!appearance) {
        games.push({ gameId: game.id, historicalTeamId: teamId, status: "excluded", reasons: ["observed_zero_minutes"] });
        continue;
      }
      if (player.playerClass === "skater") {
        const skater = appearance;
        appearances.push(skater);
        for (const target of ["GOALS", "ASSISTS", "POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES"]) {
          if (skater.targets[target] == null) reasons.push(`missing_target:${target}`);
        }
        const landing = rows.get(urlFor(game.id, "landing"));
        if (landing) {
          const receipt = { rawRow: landing, contentHash: playerForecastSourcePayloadHash(landing.payload) };
          try {
            deriveNativePowerPlayPoints({ appearance: skater, landing: receipt, nhlPlayerId: player.nhlPlayerId, cutoffAt: input.cutoffAt });
            landings.push(receipt);
          } catch {
            reasons.push("unsupported_landing_ppp");
          }
        } else reasons.push(failures.get(urlFor(game.id, "landing")) ?? "missing_landing_ppp");
      } else {
        const goalie = appearance;
        goalieAppearances.push(goalie);
        reasons.push("missing_target:SHUTOUTS_GOALIE");
        try {
          if (deriveNativeGoalieOutcomes({ appearance: goalie, nhlPlayerId: player.nhlPlayerId, cutoffAt: input.cutoffAt }).winCredit === null) reasons.push("missing_target:WINS_GOALIE");
        } catch {
          reasons.push("unsupported_goalie_outcome_context");
        }
      }
      games.push({ gameId: game.id, historicalTeamId: teamId, status: "verified_positive_minutes", reasons });
    }
    const selected = player.playerClass === "skater" ? appearances : goalieAppearances;
    const common = {
      basis: "captured_current",
      capturedAt: input.cutoffAt,
      playerId: player.playerId,
      nhlPlayerId: player.nhlPlayerId,
      teamId: player.teamId,
      rosterRevision: player.rosterRevision,
      projections: [],
      limitations: ["History is limited to explicitly approved games; current-club discovery cannot certify complete player or traded-player history."]
    };
    const envelope = { provider: "fhfh", entity_kind: "player", entity_key: `${input.seasonId}:${player.playerId}`, available_at: input.cutoffAt };
    if (appearances.length) {
      const payload = {
        ...common,
        policyVersion: CURRENT_APPEARANCE_POLICY_VERSION,
        definitionHash: currentAppearanceDefinitionHash(input.seasonId),
        appearances,
        ...landings.length === appearances.length ? { derivedPowerPlayPoints: { version: "native-power-play-points-inputs-v1", landings } } : {}
      };
      skaters.push({ ...envelope, dataset_key: "baseline-inputs-v1", payload_hash: playerForecastSourcePayloadHash(payload), payload });
    }
    if (goalieAppearances.length) for (const [policyVersion, definitionHash, output] of [
      [NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, goalieWins],
      [NATIVE_GOALIE_VOLUME_POLICY_VERSION, nativeGoalieVolumeDefinitionHash, goalieVolume]
    ]) {
      const payload = { ...common, policyVersion, definitionHash: definitionHash(input.seasonId), appearances: goalieAppearances };
      output.push({ ...envelope, dataset_key: "goalie-baseline-inputs-v1", payload_hash: playerForecastSourcePayloadHash(payload), payload });
    }
    const injuryEvidence = (input.injuryEvidence ?? []).filter((row) => row.playerId === player.playerId).map((row) => classifyCurrentRosterInjuryEvidence(row, player, input.seasonId, input.cutoffAt));
    const injurySupported = injuryEvidence.length > 0 && injuryEvidence.every((row) => row.status === "injury_supported");
    return {
      playerId: player.playerId,
      nhlPlayerId: player.nhlPlayerId,
      playerClass: player.playerClass,
      verifiedAppearances: selected.length,
      observationEmitted: selected.length > 0,
      historyStatus: selected.length ? "verified_current_appearances" : "no_verified_appearances_in_selected_games",
      missingHistoryContext: selected.length ? "not_applicable" : injurySupported ? "injury_supported" : "unknown",
      seasonAppearanceAbsence: "unverified",
      priorAbilityInference: "none",
      injuryEvidence,
      games
    };
  });
  return {
    version: "current-roster-native-inputs-v1",
    cutoffAt: input.cutoffAt,
    assembledAt: now.toISOString(),
    skaters,
    goalieWins,
    goalieVolume,
    coverage,
    injuryEvidence: structuredClone(input.injuryEvidence ?? []),
    injuryClassification: "diagnostic_only",
    originalReceipts: structuredClone(input.receipts),
    sourceReceiptCoverage: [...approved.keys()].every((url) => rows.has(url)) ? "complete_for_approved_urls" : "partial_for_approved_urls",
    missingSources: [...approved.keys()].filter((url) => !rows.has(url)).map((url) => ({ url, reason: failures.get(url) ?? "not_supplied" })),
    selectedHistoryCoverage: "unverified",
    sourceRequests: 0,
    databaseWrites: 0,
    forecastIssued: false,
    publicUsesApproved: false
  };
}

// web/lib/player-forecasts/baselineGeneration.ts
function buildNativeSkaterBaselineSnapshot(input) {
  if (input.projections.length) throw new Error("Native baseline excludes external projection inputs.");
  const derived = input.derivedPowerPlayPoints;
  for (const appearance of input.appearances) {
    if (derived !== void 0) {
      const available = timestampMicros(appearance.availableAt), cutoff = timestampMicros(input.cutoffAt);
      if (available === null || cutoff === null || available > cutoff) throw new Error("Native PPP base receipt exceeds capture cutoff.");
    }
    verifyBaselineBoxscoreReceipt(
      appearance,
      input.nhlPlayerId,
      derived === void 0 ? input.cutoffAt : appearance.availableAt,
      "skater"
    );
  }
  let appearances = input.appearances;
  if (derived !== void 0) {
    if (!derived || derived.version !== "native-power-play-points-inputs-v1" || !Array.isArray(derived.landings) || !appearances.length || derived.landings.length !== appearances.length || derived.landings.length > 200) {
      throw new Error("Native PPP requires a versioned complete landing input set.");
    }
    const landings = /* @__PURE__ */ new Map();
    for (const landing of derived.landings) {
      const gameId = landing?.rawRow?.game_id;
      if (!Number.isSafeInteger(gameId) || gameId <= 0 || landings.has(gameId)) {
        throw new Error("Native PPP landing game identities are invalid or duplicated.");
      }
      landings.set(gameId, landing);
    }
    appearances = appearances.map((appearance) => {
      const landing = landings.get(appearance.gameId);
      if (!landing) throw new Error("Native PPP landing evidence is missing for an appearance.");
      const receipt = appearance.finalBoxscore;
      const current = baselineAppearanceFromBoxscore({
        rawRow: receipt.rawRow,
        game: receipt.game,
        nhlPlayerId: input.nhlPlayerId,
        teamId: appearance.teamId,
        cutoffAt: input.cutoffAt,
        population: "skater"
      });
      if (!current) throw new Error("Native PPP lacks a verified positive-minute appearance.");
      const counts = deriveNativePowerPlayPoints({
        nhlPlayerId: input.nhlPlayerId,
        cutoffAt: input.cutoffAt,
        appearance: current,
        landing
      });
      if (appearance.targets.PP_POINTS != null && appearance.targets.PP_POINTS !== counts.powerPlayPoints) {
        throw new Error("Native PPP conflicts with the original boxscore target.");
      }
      return {
        ...appearance,
        availableAt: input.cutoffAt,
        targets: { ...appearance.targets, PP_POINTS: counts.powerPlayPoints }
      };
    });
  }
  if (input.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION) {
    appearances = appearances.map((appearance) => ({ ...appearance, targets: {
      ...appearance.targets,
      TIME_ON_ICE_PER_GAME: appearance.finalBoxscore.appearanceSeconds / 60
    } }));
    return buildCurrentAppearanceSkaterRates({ ...input, appearances });
  }
  if (input.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION) return buildPriorAppearanceSkaterRates({ ...input, appearances });
  if (input.policyVersion !== void 0) throw new Error("Unsupported native appearance policy.");
  return buildSkaterBaselineRates({ ...input, appearances });
}

// tasks/artifacts/forge-rso-completion-2026-10-15/research-comparison-v1.ts
var repo = (0, import_node_path.resolve)(__dirname, "../../..");
var base = "/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1";
var protocolPath = (0, import_node_path.resolve)(repo, "tasks/artifacts/forge-rso-completion-2026-10-15/research-comparison-protocol-v1.md");
var protocolHash = "0233b918bf2a43bc10ca7140e5b7d598ca816e0bf5b72a14fb82a130b2504e9e";
var sha2 = (value) => (0, import_node_crypto3.createHash)("sha256").update(value).digest("hex");
var source = (0, import_node_fs.readFileSync)((0, import_node_path.resolve)(repo, "web/lib/projections/seasonBootstrap.ts"), "utf8");
var ast = import_typescript.default.createSourceFile("seasonBootstrap.ts", source, import_typescript.default.ScriptTarget.Latest, true);
var declaration = ast.statements.find((node) => import_typescript.default.isFunctionDeclaration(node) && node.name?.text === "averageBootstrapStats");
if (!declaration) throw new Error("Missing existing pure arithmetic helper");
var arithmetic = new Function(import_typescript.default.transpileModule(
  declaration.getText(ast).replace(/^export\s+/, ""),
  { compilerOptions: { target: import_typescript.default.ScriptTarget.ES2022 } }
).outputText + "\nreturn averageBootstrapStats;")();
var skaterKeys = ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"];
var goalieKeys = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE"];
var finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
if (process.argv.includes("--self-check")) {
  const mean = arithmetic([{ GOALS: 0, HITS: null }, { GOALS: 2, HITS: null }]);
  if (mean.GOALS !== 1 || mean.HITS !== null || JSON.stringify(arithmetic([])) !== "{}") throw new Error("Arithmetic self-check failed");
  console.log("Pure existing arithmetic/missingness self-check passed; no source bodies read.");
} else {
  if (process.argv[2] !== "--execute-frozen" || process.argv[3] !== protocolHash) throw new Error("Exact frozen protocol SHA required");
  if (sha2((0, import_node_fs.readFileSync)(protocolPath)) !== protocolHash) throw new Error("Protocol changed");
  const started = performance.now(), cutoffAt = (/* @__PURE__ */ new Date()).toISOString();
  let bytes = 0, bodyReads = 0, outputBytes = 0, producerCalls = 0;
  const out = (0, import_node_path.resolve)(base, "research-native-comparison-v1-recovery");
  (0, import_node_fs.mkdirSync)(out, { mode: 448 });
  const guard = () => {
    if (performance.now() - started > 18e4 || bytes > 4 * 1024 * 1024 || bodyReads > 122) throw new Error("Comparison budget exceeded");
  };
  const save = (name, value) => {
    guard();
    const raw = JSON.stringify(value, null, 2) + "\n";
    outputBytes += Buffer.byteLength(raw);
    if (outputBytes > 16 * 1024 * 1024) throw new Error("Output budget exceeded");
    (0, import_node_fs.writeFileSync)((0, import_node_path.resolve)(out, name), raw, { mode: 384, flag: "wx" });
    return sha2(raw);
  };
  save("intent.json", {
    protocolHash,
    authority: "Root task directive: scoped standing authorization for checklist3.2 development-purpose extension",
    startedAt: cutoffAt,
    recoveryAuthority: "Root authorized one bounded continuation using equivalent verified ISO game metadata; prior attempt had0producer calls/predictions/scoring game reads",
    exposedDevelopment: true,
    noPromotion: true,
    arithmeticSourceHash: sha2(source),
    implementationHashes: Object.fromEntries([
      "baselineRates.ts",
      "baselineGeneration.ts",
      "goalieBaselineRates.ts",
      "nativeGoalieOutcomes.ts",
      "currentRosterNativeInputs.ts",
      "baselineSourceLineage.ts",
      "nativePowerPlayPoints.ts",
      "settlement.ts"
    ].map((name) => [name, sha2((0, import_node_fs.readFileSync)((0, import_node_path.resolve)(repo, "web/lib/player-forecasts", name)))])),
    runnerHash: sha2((0, import_node_fs.readFileSync)(__filename))
  });
  try {
    const metadata = (0, import_node_fs.readFileSync)((0, import_node_path.resolve)(base, "candidate-development-reuse-allocation-v1.json"));
    if (sha2(metadata) !== "7464a036b119d286629aafeba4b6fbbde1271093c6b21bb5eb83473852b4b078") throw new Error("Allocation changed");
    const allocation = JSON.parse(metadata.toString());
    const scopeBytes = (0, import_node_fs.readFileSync)((0, import_node_path.resolve)(base, "native-assembly-scope-v2.json"));
    if (sha2(scopeBytes) !== "ef001e6f3addf93feb7d5214081905bd79b3224d915bb566f73c3a33b87c8794") throw new Error("Owned scope changed");
    const scope = JSON.parse(scopeBytes.toString());
    if (scope.roster.length !== 19 || allocation.games.length !== 60 || allocation.originalBodies.length !== 120 || allocation.games.some((g) => g.date < "2026-09-29" || g.date > "2026-10-12" || allocation.reservedGameIds.includes(g.id))) throw new Error("Scope/reservation conflict");
    const scopeGames = new Map(scope.games.map((g) => [g.id, g]));
    if (scopeGames.size !== 60 || allocation.games.some((g) => {
      const verified = scopeGames.get(g.id);
      return !verified || ["id", "date", "seasonId", "type", "homeTeamId", "awayTeamId"].some((key) => g[key] !== verified[key]) || !Number.isFinite(Date.parse(g.startTime)) || Date.parse(g.startTime) !== Date.parse(verified.startTime);
    })) throw new Error("Verified ISO metadata does not bind original allocation");
    save("corrected-metadata-binding.json", {
      allocationHash: sha2(metadata),
      scopeHash: sha2(scopeBytes),
      games: allocation.games.map((g) => ({ original: g, verified: scopeGames.get(g.id) })),
      reason: "Equivalent SQL/ISO timestamp representation; original response clocks and split unchanged"
    });
    const reservation = allocation.reservationMetadata;
    if (!reservation?.path || !reservation?.sha256 || sha2((0, import_node_fs.readFileSync)(reservation.path)) !== reservation.sha256) throw new Error("Reservation metadata changed");
    const summaries = /* @__PURE__ */ new Map();
    for (const directory of ["goalie-shutout-hart-v1", "goalie-shutout-oettinger-v1"]) {
      const observations = JSON.parse((0, import_node_fs.readFileSync)((0, import_node_path.resolve)(base, directory, "observation.json"), "utf8"));
      if (observations.length !== 1 || !scope.roster.some((p) => p.playerId === observations[0].payload.playerId && p.playerClass === "goalie")) throw new Error("SO scope mismatch");
      const summary = observations[0].payload.shutoutSummary;
      if (summary.scope.approvedGameIds.some((id4) => !allocation.games.some((g) => g.id === id4))) throw new Error("SO outside60games");
      for (const receipt of summary.receipts) {
        bodyReads++;
        bytes += Buffer.byteLength(receipt.rawBody);
        if (sha2(receipt.rawBody) !== receipt.bodySha256 || Buffer.byteLength(receipt.rawBody) > 1024 * 1024) throw new Error("SO original hash/cap failed");
      }
      summaries.set(observations[0].payload.playerId, summary);
    }
    const loadSplit = (training2) => {
      const games = allocation.games.filter((g) => g.date <= "2026-10-05" === training2);
      if (games.length !== (training2 ? 29 : 31)) throw new Error("Split mismatch");
      const ids = new Set(games.map((g) => g.id));
      const receipts = allocation.originalBodies.filter((r) => ids.has(r.gameId)).map((r) => {
        guard();
        const raw = (0, import_node_fs.readFileSync)(r.path);
        bodyReads++;
        bytes += raw.length;
        if (raw.length !== r.bytes || raw.length > 1024 * 1024 || sha2(raw) !== r.sha256) throw new Error("Original hash/cap failed");
        return { url: r.url, capturedAt: r.capturedAt, bodySha256: r.sha256, rawBody: raw.toString("utf8") };
      });
      const normalized = assembleCurrentRosterNativeInputs({
        ...scope,
        cutoffAt,
        games: games.map((g) => scopeGames.get(g.id)),
        receipts
      }, new Date(cutoffAt));
      return normalized;
    };
    const rowValues = (observation, appearance, goalie) => {
      const p = observation.payload;
      if (!goalie) {
        const values2 = { ...appearance.targets, TIME_ON_ICE_PER_GAME: appearance.finalBoxscore.appearanceSeconds / 60 };
        const landing = p.derivedPowerPlayPoints?.landings.find((row) => row.rawRow.game_id === appearance.gameId);
        values2.PP_POINTS = landing ? deriveNativePowerPlayPoints({ appearance, landing, nhlPlayerId: p.nhlPlayerId, cutoffAt }).powerPlayPoints : null;
        return Object.fromEntries(skaterKeys.map((key) => [key, finite(values2[key]) ? values2[key] : null]));
      }
      const values = {
        SAVES_GOALIE: appearance.saves,
        GOALS_AGAINST_GOALIE: appearance.goalsAgainst,
        SHOTS_AGAINST_GOALIE: appearance.shotsAgainst,
        GOALIE_MINUTES: appearance.toiMinutes,
        WINS_GOALIE: null,
        SHUTOUTS_GOALIE: null
      };
      try {
        values.WINS_GOALIE = deriveNativeGoalieOutcomes({ appearance, nhlPlayerId: p.nhlPlayerId, cutoffAt }).winCredit;
      } catch {
      }
      values.SHUTOUTS_GOALIE = deriveNativeGoalieShutoutCredit({ appearance, nhlPlayerId: p.nhlPlayerId, cutoffAt, summary: summaries.get(p.playerId) }).shutoutCredit;
      return values;
    };
    const training = loadSplit(true), predictions = [];
    for (const player of scope.roster) {
      guard();
      const goalie = player.playerClass === "goalie", keys = goalie ? goalieKeys : skaterKeys;
      const observation = (goalie ? training.goalieVolume : training.skaters).find((o) => o.payload.playerId === player.playerId);
      const a = Object.fromEntries(keys.map((key) => [key, null]));
      let b = { ...a }, support = {}, selectedGameIds = [];
      if (observation) {
        const p = observation.payload;
        const input = { ...p, cutoffAt, seasonId: scope.seasonId, sourceWatermark: observation.payload_hash };
        const selected = [...p.appearances].sort((a2, b2) => b2.gameDate.localeCompare(a2.gameDate) || b2.gameId - a2.gameId).slice(0, 20);
        selectedGameIds = selected.map((r) => r.gameId);
        const values = selected.map((row) => rowValues(observation, row, goalie));
        b = { ...b, ...arithmetic(values) };
        support = Object.fromEntries(keys.map((key) => [key, values.filter((row) => finite(row[key])).length]));
        if (goalie) {
          for (const fn of [buildNativeGoalieVolumeRates, buildNativeGoalieWinRates, buildNativeGoalieShutoutRates]) {
            producerCalls++;
            for (const target of fn({ ...input, shutoutSummary: summaries.get(player.playerId) }).targets) a[target.targetKey] = target.rate;
          }
          for (const key of keys) if (!finite(a[key])) b[key] = null;
          for (const key of keys) if (finite(a[key]) && Math.abs(a[key] - b[key]) > 1e-12) throw new Error("Goalie arithmetic identity mismatch");
        } else {
          producerCalls++;
          for (const target of buildNativeSkaterBaselineSnapshot(input).targets) a[target.targetKey] = target.ratePerAppearance;
          for (const key of keys) if (!finite(a[key])) b[key] = null;
        }
      }
      predictions.push({
        playerId: player.playerId,
        playerClass: player.playerClass,
        a,
        b,
        selectedGameIds,
        support,
        unavailable: keys.filter((key) => !finite(a[key]) || !finite(b[key]))
      });
    }
    if (producerCalls > 23) throw new Error("Producer bound exceeded");
    const predictionHash = save("frozen-predictions.json", { frozenAt: (/* @__PURE__ */ new Date()).toISOString(), protocolHash, cutoffAt, predictions });
    const scoring = loadSplit(false), cases = [], omissions = [], ratioDiagnostics = [];
    for (const player of scope.roster) {
      const goalie = player.playerClass === "goalie", keys = goalie ? goalieKeys : skaterKeys;
      const observation = (goalie ? scoring.goalieVolume : scoring.skaters).find((o) => o.payload.playerId === player.playerId);
      const prediction = predictions.find((p) => p.playerId === player.playerId);
      if (!observation) {
        omissions.push({ playerId: player.playerId, reason: "no_verified_scoring_appearance" });
        continue;
      }
      if (goalie) {
        const appearances = observation.payload.appearances;
        const totals = appearances.reduce(
          (sum, row) => ({
            saves: sum.saves + row.saves,
            shots: sum.shots + row.shotsAgainst,
            ga: sum.ga + row.goalsAgainst,
            minutes: sum.minutes + row.toiMinutes
          }),
          { saves: 0, shots: 0, ga: 0, minutes: 0 }
        );
        const ratios = (v) => ({
          SAVE_PERCENTAGE: finite(v.SAVES_GOALIE) && finite(v.SHOTS_AGAINST_GOALIE) && v.SHOTS_AGAINST_GOALIE > 0 ? v.SAVES_GOALIE / v.SHOTS_AGAINST_GOALIE : null,
          GOALS_AGAINST_AVERAGE: finite(v.GOALS_AGAINST_GOALIE) && finite(v.GOALIE_MINUTES) && v.GOALIE_MINUTES > 0 ? 60 * v.GOALS_AGAINST_GOALIE / v.GOALIE_MINUTES : null
        });
        ratioDiagnostics.push({
          playerId: player.playerId,
          scoringAppearances: appearances.length,
          a: ratios(prediction.a),
          b: ratios(prediction.b),
          observed: ratios({
            SAVES_GOALIE: totals.saves,
            SHOTS_AGAINST_GOALIE: totals.shots,
            GOALS_AGAINST_GOALIE: totals.ga,
            GOALIE_MINUTES: totals.minutes
          }),
          interpretation: "Ratios of coherent summed primitives; not expected realized ratios or separately scored forecast heads."
        });
      }
      for (const appearance of observation.payload.appearances) {
        const values = rowValues(observation, appearance, goalie);
        for (const key of keys) {
          const label = values[key], a = prediction.a[key], b = prediction.b[key];
          if (!finite(label) || !finite(a) || !finite(b)) {
            omissions.push({
              playerId: player.playerId,
              gameId: appearance.gameId,
              key,
              reason: !finite(label) ? "unknown_label" : "no_paired_training_prediction"
            });
            continue;
          }
          cases.push({
            playerId: player.playerId,
            playerClass: player.playerClass,
            gameId: appearance.gameId,
            date: appearance.gameDate,
            key,
            label,
            a,
            b,
            squaredA: (label - a) ** 2,
            squaredB: (label - b) ** 2,
            absoluteA: Math.abs(label - a),
            absoluteB: Math.abs(label - b)
          });
        }
      }
    }
    const metric = (rows) => ({
      n: rows.length,
      players: new Set(rows.map((r) => r.playerId)).size,
      games: new Set(rows.map((r) => r.gameId)).size,
      dates: new Set(rows.map((r) => r.date)).size,
      ...Object.fromEntries(["squaredA", "squaredB", "absoluteA", "absoluteB"].map((k) => [k, rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : null]))
    });
    const heads = Object.fromEntries([...skaterKeys, ...goalieKeys].map((key) => {
      const rows = cases.filter((r) => r.key === key), perPlayer = predictions.filter((p) => (p.playerClass === "goalie" ? goalieKeys : skaterKeys).includes(key)).map((p) => ({ playerId: p.playerId, ...metric(rows.filter((r) => r.playerId === p.playerId)) }));
      const covered = perPlayer.filter((p) => p.n > 0);
      const values = metric(rows);
      return [key, {
        ...values,
        mseDifferenceAminusB: values.n ? values.squaredA - values.squaredB : null,
        maeDifferenceAminusB: values.n ? values.absoluteA - values.absoluteB : null,
        perPlayer,
        macro: Object.fromEntries(["squaredA", "squaredB", "absoluteA", "absoluteB"].map((k) => [k, covered.length ? covered.reduce((s, row) => s + row[k], 0) / covered.length : null]))
      }];
    }));
    save("paired-cases.json", cases);
    save("omissions.json", { omissions, trainingCoverage: training.coverage, scoringCoverage: scoring.coverage });
    save("report.json", {
      protocolHash,
      predictionHash,
      status: "completed_exposed_development_only",
      heads,
      ratioDiagnostics,
      sources: { bodyReads, bytes },
      producerCalls,
      coverage: { trainingGames: 29, scoringGames: 31, players: 19 },
      unsupported: ["scheduled_game_expectations", "participation", "pStart", "per_start_ability", "full_fantasy_points", "predictive_uncertainty"],
      unchangedProduction: true,
      originalAsOfReplay: false,
      endAt: (/* @__PURE__ */ new Date()).toISOString(),
      elapsedMs: performance.now() - started
    });
    console.log(JSON.stringify({ status: "completed_exposed_development_only", bodyReads, bytes, producerCalls, pairedCases: cases.length, out }));
  } catch (error) {
    save("stopped.json", { status: "stopped_no_retry", error: error instanceof Error ? error.message : "unknown", bodyReads, bytes, producerCalls });
    throw error;
  }
}
