import { createHash } from "node:crypto";

import {
  ESPN_MAPPING_VERSION,
  type EspnDiagnostics,
  type EspnDraftOrderType,
  type EspnDraftPick,
  type EspnLeagueSettingsV1,
  type EspnLeagueStateV1,
  type EspnLeagueTeam,
  type EspnNormalizedMatchup,
  type EspnNormalizedTeamState,
  type EspnNormalizedTransaction,
  type EspnRosterEntry,
  type EspnUnsupportedItem,
} from "./contracts";

type UnknownRecord = Record<string, unknown>;

const SKATER_STAT_BY_ID: Record<number, string> = {
  13: "GOALS",
  14: "ASSISTS",
  15: "PLUS_MINUS",
  16: "POINTS",
  17: "PENALTY_MINUTES",
  18: "PP_GOALS",
  19: "PP_ASSISTS",
  20: "SH_GOALS",
  21: "SH_ASSISTS",
  23: "FACEOFFS_WON",
  24: "FACEOFFS_LOST",
  29: "SHOTS_ON_GOAL",
  31: "HITS",
  32: "BLOCKED_SHOTS",
  38: "PP_POINTS",
  39: "SH_POINTS",
};

const GOALIE_STAT_BY_ID: Record<number, string> = {
  0: "GAMES_PLAYED",
  1: "WINS_GOALIE",
  2: "LOSSES_GOALIE",
  3: "SHOTS_AGAINST_GOALIE",
  4: "GOALS_AGAINST_GOALIE",
  6: "SAVES_GOALIE",
  7: "SHUTOUTS_GOALIE",
  9: "OTL_GOALIE",
  10: "GOALS_AGAINST_AVERAGE",
  11: "SAVE_PERCENTAGE",
};

const APP_INVERTED_CATEGORY_KEYS = new Set([
  "GOALS_AGAINST_AVERAGE",
  "GOALS_AGAINST_GOALIE",
  "LOSSES_GOALIE",
]);

const ROSTER_SLOT_BY_ID: Record<number, string> = {
  0: "C",
  1: "LW",
  2: "RW",
  3: "FWD",
  4: "D",
  5: "G",
  6: "utility",
  7: "bench",
};

const POSITION_BY_ID: Record<number, string> = {
  1: "C",
  2: "LW",
  3: "RW",
  4: "D",
  5: "G",
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

function number(value: unknown): number | null {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : null;
}

function integer(value: unknown): number | null {
  const next = number(value);
  return next != null && Number.isInteger(next) ? next : null;
}

function boolean(value: unknown): boolean {
  return value === true;
}

function isoDate(value: unknown): string | null {
  const milliseconds = number(value);
  if (milliseconds == null) return null;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

export function hashEspnValue(value: unknown) {
  return sourceHash(value);
}

export function hashEspnLeagueState(
  value: Omit<EspnLeagueStateV1, "sourceHash"> | EspnLeagueStateV1,
) {
  const {
    sourceHash: _sourceHash,
    sectionFreshness: _sectionFreshness,
    fetchedAt: _fetchedAt,
    ...materialState
  } = value as EspnLeagueStateV1;
  return sourceHash(materialState);
}

function normalizedSwid(value: string) {
  return value.trim().replace(/^"|"$/g, "").toUpperCase();
}

function teamName(team: UnknownRecord, id: string) {
  const combined = [text(team.location), text(team.nickname)]
    .filter(Boolean)
    .join(" ");
  return text(team.name) ?? (combined || `ESPN Team ${id}`);
}

function teams(payload: UnknownRecord, swid: string): EspnLeagueTeam[] {
  const ownerId = normalizedSwid(swid);
  return array(payload.teams).flatMap((rawTeam) => {
    const team = record(rawTeam);
    const id = text(team.id);
    if (!id) return [];
    const owners = array(team.owners)
      .map(text)
      .filter((value): value is string => Boolean(value))
      .map(normalizedSwid);
    const primaryOwner = text(team.primaryOwner);
    return [
      {
        externalTeamKey: id,
        name: teamName(team, id),
        abbreviation: text(team.abbrev),
        divisionId: integer(team.divisionId),
        isOwned:
          owners.includes(ownerId) ||
          (primaryOwner != null && normalizedSwid(primaryOwner) === ownerId),
      },
    ];
  });
}

function leagueType(scoringType: string) {
  if (["H2H_POINTS", "TOTAL_SEASON_POINTS"].includes(scoringType)) {
    return "points" as const;
  }
  if (
    ["H2H_CATEGORY", "H2H_MOST_CATEGORIES", "ROTO", "ROTISSERIE"].includes(
      scoringType,
    )
  ) {
    return "categories" as const;
  }
  return null;
}

function draftOrder(settings: UnknownRecord): {
  order: EspnDraftOrderType;
  draftType: string | null;
  liveSupported: boolean;
} {
  const draft = record(settings.draftSettings);
  const draftType = text(draft.type)?.toUpperCase() ?? null;
  if (draftType === "SNAKE") {
    return { order: "snake", draftType, liveSupported: true };
  }
  if (["LINEAR", "STRAIGHT"].includes(draftType ?? "")) {
    return { order: "straight", draftType, liveSupported: true };
  }
  return { order: "unknown", draftType, liveSupported: false };
}

function scoringMapping(args: {
  settings: UnknownRecord;
  leagueType: "points" | "categories" | null;
  unsupported: EspnUnsupportedItem[];
  warnings: string[];
}) {
  const skater: Record<string, number> = {};
  const goalie: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const scoring = record(args.settings.scoringSettings);
  for (const rawItem of array(scoring.scoringItems)) {
    const item = record(rawItem);
    const statId = integer(item.statId);
    if (statId == null) {
      args.unsupported.push({
        kind: "scoring",
        code: "unknown",
        label: "Unknown ESPN scoring item",
        reason: "The scoring item did not include an integer stat ID.",
      });
      continue;
    }
    const skaterKey = SKATER_STAT_BY_ID[statId];
    const goalieKey = GOALIE_STAT_BY_ID[statId];
    const key = skaterKey ?? goalieKey;
    if (!key) {
      args.unsupported.push({
        kind: "scoring",
        code: String(statId),
        label: `ESPN stat ${statId}`,
        reason: "This hockey stat has not been validated against an FHFH projection key.",
      });
      continue;
    }
    const overrides = record(item.pointsOverrides);
    if (Object.keys(overrides).length > 0) {
      args.unsupported.push({
        kind: "scoring",
        code: String(statId),
        label: key,
        reason: "Per-threshold or per-position scoring overrides are not supported.",
      });
      continue;
    }
    if (args.leagueType === "points") {
      const points = number(item.points);
      if (points == null) {
        args.unsupported.push({
          kind: "scoring",
          code: String(statId),
          label: key,
          reason: "The point value is missing or non-numeric.",
        });
        continue;
      }
      (goalieKey ? goalie : skater)[key] = points;
      continue;
    }
    if (args.leagueType === "categories") {
      const reversed = boolean(item.isReverseItem);
      const appAlreadyInverts = APP_INVERTED_CATEGORY_KEYS.has(key);
      categories[key] = reversed === appAlreadyInverts ? 1 : -1;
      if (reversed !== appAlreadyInverts && appAlreadyInverts) {
        args.warnings.push(
          `${key} is normally lower-is-better in FHFH but ESPN did not mark it as reversed.`,
        );
      }
    }
  }
  return { skater, goalie, categories };
}

function rosterMapping(
  settings: UnknownRecord,
  unsupported: EspnUnsupportedItem[],
) {
  const result: Record<string, number> = {};
  const counts = record(record(settings.rosterSettings).lineupSlotCounts);
  for (const [rawId, rawCount] of Object.entries(counts)) {
    const id = integer(rawId);
    const count = integer(rawCount);
    if (id == null || count == null || count <= 0) continue;
    const key = ROSTER_SLOT_BY_ID[id];
    if (!key) {
      const knownReserveLabel = id === 8 ? "IR" : id === 9 ? "IR+" : null;
      unsupported.push({
        kind: "roster",
        code: String(id),
        label: knownReserveLabel ?? `ESPN lineup slot ${id}`,
        reason: knownReserveLabel
          ? "Injured-reserve slots are retained by ESPN but cannot be represented in the current FHFH roster settings."
          : "This active lineup slot has not been mapped to the Draft Dashboard.",
      });
      continue;
    }
    result[key] = (result[key] ?? 0) + count;
  }
  return result;
}

function diagnostics(args: {
  leagueType: "points" | "categories" | null;
  scoringCount: number;
  unsupported: EspnUnsupportedItem[];
  warnings: string[];
}): EspnDiagnostics {
  const fatal = !args.leagueType || args.scoringCount === 0;
  return {
    status: fatal
      ? "unsupported"
      : args.unsupported.length || args.warnings.length
        ? "partial"
        : "supported",
    warnings: [...new Set(args.warnings)],
    unsupported: args.unsupported,
  };
}

function playerFromEntry(rawEntry: unknown): EspnRosterEntry | null {
  const entry = record(rawEntry);
  const pool = record(entry.playerPoolEntry);
  const player = record(pool.player);
  const externalPlayerId = text(entry.playerId ?? pool.id ?? player.id);
  if (!externalPlayerId) return null;
  const defaultPositionId = integer(player.defaultPositionId);
  return {
    externalPlayerId,
    playerName: text(player.fullName),
    position:
      defaultPositionId == null ? null : POSITION_BY_ID[defaultPositionId] ?? null,
    proTeamId: integer(player.proTeamId),
    lineupSlotId: integer(entry.lineupSlotId),
    acquisitionType: text(entry.acquisitionType),
    injuryStatus: text(entry.injuryStatus ?? player.injuryStatus),
  };
}

function normalizedRecord(team: UnknownRecord) {
  const overall = record(record(team.record).overall);
  return {
    wins: integer(overall.wins) ?? 0,
    losses: integer(overall.losses) ?? 0,
    ties: integer(overall.ties) ?? 0,
    pointsFor: number(overall.pointsFor) ?? 0,
    pointsAgainst: number(overall.pointsAgainst) ?? 0,
    percentage: number(overall.percentage),
    rank: integer(team.rank ?? team.playoffSeed),
  };
}

function teamStates(payload: UnknownRecord, normalizedTeams: EspnLeagueTeam[]) {
  const teamById = new Map(normalizedTeams.map((team) => [team.externalTeamKey, team]));
  return array(payload.teams).flatMap((rawTeam): EspnNormalizedTeamState[] => {
    const team = record(rawTeam);
    const id = text(team.id);
    const normalized = id ? teamById.get(id) : null;
    if (!id || !normalized) return [];
    const roster = record(team.roster);
    return [
      {
        ...normalized,
        roster: array(roster.entries).flatMap((entry) => {
          const player = playerFromEntry(entry);
          return player ? [player] : [];
        }),
        record: normalizedRecord(team),
      },
    ];
  });
}

function matchups(payload: UnknownRecord): EspnNormalizedMatchup[] {
  return array(payload.schedule).flatMap((rawMatchup) => {
    const matchup = record(rawMatchup);
    const id = text(matchup.id);
    if (!id) return [];
    const home = record(matchup.home);
    const away = record(matchup.away);
    return [
      {
        id,
        matchupPeriodId: integer(matchup.matchupPeriodId),
        homeTeamId: text(home.teamId),
        awayTeamId: text(away.teamId),
        homeScore: number(home.totalPoints),
        awayScore: number(away.totalPoints),
        winner: text(matchup.winner),
        playoffTierType: text(matchup.playoffTierType),
      },
    ];
  });
}

function transactions(payload: UnknownRecord): EspnNormalizedTransaction[] {
  const unique = new Map<string, EspnNormalizedTransaction>();
  for (const rawTransaction of array(payload.transactions)) {
    const transaction = record(rawTransaction);
    const id = text(transaction.id);
    const type = text(transaction.type);
    if (!id || !type) continue;
    unique.set(id, {
      id,
      type,
      status: text(transaction.status),
      teamId: text(transaction.teamId),
      proposedDate: isoDate(transaction.proposedDate),
      scoringPeriodId: integer(transaction.scoringPeriodId),
      bidAmount: number(transaction.bidAmount),
      items: array(transaction.items).map((rawItem) => {
        const item = record(rawItem);
        return {
          type: text(item.type),
          externalPlayerId: text(item.playerId),
          fromTeamId: text(item.fromTeamId),
          toTeamId: text(item.toTeamId),
          fromLineupSlotId: integer(item.fromLineupSlotId),
          toLineupSlotId: integer(item.toLineupSlotId),
          isKeeper: boolean(item.isKeeper),
        };
      }),
    });
  }
  return [...unique.values()].sort(
    (left, right) =>
      (left.proposedDate ?? "").localeCompare(right.proposedDate ?? "") ||
      left.id.localeCompare(right.id),
  );
}

export function normalizeEspnTransactions(payload: unknown) {
  return transactions(record(payload));
}

function playerLookup(states: EspnNormalizedTeamState[]) {
  return new Map(
    states.flatMap((team) =>
      team.roster.map((player) => [player.externalPlayerId, player] as const),
    ),
  );
}

function draftPicks(payload: UnknownRecord, states: EspnNormalizedTeamState[]) {
  const detail = record(payload.draftDetail);
  const players = playerLookup(states);
  return array(detail.picks)
    .flatMap((rawPick): EspnDraftPick[] => {
      const pick = record(rawPick);
      const pickNumber = integer(pick.overallPickNumber ?? pick.id);
      const roundNumber = integer(pick.roundId);
      const pickInRound = integer(pick.roundPickNumber);
      const externalPlayerId = text(pick.playerId);
      const externalTeamKey = text(pick.teamId);
      if (
        pickNumber == null ||
        roundNumber == null ||
        pickInRound == null ||
        !externalPlayerId ||
        !externalTeamKey
      ) {
        return [];
      }
      const player = players.get(externalPlayerId);
      return [
        {
          externalPickKey: `${pickNumber}:${externalPlayerId}:${externalTeamKey}`,
          pickNumber,
          roundNumber,
          pickInRound,
          externalTeamKey,
          externalPlayerId,
          playerName: player?.playerName ?? null,
          position: player?.position ?? null,
          proTeamId: player?.proTeamId ?? null,
          isKeeper: boolean(pick.keeper ?? pick.reservedForKeeper),
          bidAmount: number(pick.bidAmount),
        },
      ];
    })
    .sort((left, right) => left.pickNumber - right.pickNumber);
}

export function normalizeEspnLeaguePayload(args: {
  leagueId: string;
  season: number;
  swid: string;
  payload: unknown;
  fetchedAt?: Date;
}): { settings: EspnLeagueSettingsV1; state: EspnLeagueStateV1 } {
  const payload = record(args.payload);
  const settingsSource = record(payload.settings);
  const scoring = record(settingsSource.scoringSettings);
  const scoringType = text(scoring.scoringType)?.toUpperCase() ?? "UNKNOWN";
  const normalizedLeagueType = leagueType(scoringType);
  const unsupported: EspnUnsupportedItem[] = [];
  const warnings: string[] = [];
  if (!normalizedLeagueType) {
    unsupported.push({
      kind: "scoring",
      code: scoringType,
      label: "ESPN scoring type",
      reason: "This scoring type cannot be represented safely by FHFH.",
    });
  }
  const scoringMaps = scoringMapping({
    settings: settingsSource,
    leagueType: normalizedLeagueType,
    unsupported,
    warnings,
  });
  const rosterConfig = rosterMapping(settingsSource, unsupported);
  const draft = draftOrder(settingsSource);
  const normalizedTeams = teams(payload, args.swid);
  const rawDraftOrder = array(record(settingsSource.draftSettings).pickOrder)
    .map(text)
    .filter((value): value is string => Boolean(value));
  const teamKeys = new Set(normalizedTeams.map((team) => team.externalTeamKey));
  const orderedDraft =
    normalizedTeams.length > 0 &&
    rawDraftOrder.length === normalizedTeams.length &&
    new Set(rawDraftOrder).size === rawDraftOrder.length &&
    rawDraftOrder.every((teamKey) => teamKeys.has(teamKey));
  if (!draft.liveSupported && draft.draftType) {
    warnings.push(
      `${draft.draftType} draft state will sync, but live companion mode is unavailable.`,
    );
  } else if (draft.liveSupported && !orderedDraft) {
    warnings.push(
      "ESPN did not provide a complete ordered pick list; live companion mode is unavailable.",
    );
  }
  if (normalizedTeams.length && !normalizedTeams.some((team) => team.isOwned)) {
    warnings.push("ESPN did not identify an owned team; choose a team manually.");
  }
  const fetchedAt = (args.fetchedAt ?? new Date()).toISOString();
  const externalLeagueKey = `fhl:${args.season}:${args.leagueId}`;
  const leagueName = text(settingsSource.name) ?? `ESPN League ${args.leagueId}`;
  const scoringCount =
    normalizedLeagueType === "points"
      ? Object.keys(scoringMaps.skater).length + Object.keys(scoringMaps.goalie).length
      : Object.keys(scoringMaps.categories).length;
  const normalizedDiagnostics = diagnostics({
    leagueType: normalizedLeagueType,
    scoringCount,
    unsupported,
    warnings,
  });
  const teamCount =
    integer(settingsSource.size) ??
    (normalizedTeams.length > 0 ? normalizedTeams.length : null);
  const source = {
    mappingVersion: ESPN_MAPPING_VERSION,
    scoringType,
    teamCount,
    skaterScoringCategories: scoringMaps.skater,
    goalieScoringCategories: scoringMaps.goalie,
    categoryWeights: scoringMaps.categories,
    rosterConfig,
    draftOrderType: draft.order,
    draftOrder: orderedDraft ? rawDraftOrder : [],
    draftType: draft.draftType,
    diagnostics: normalizedDiagnostics,
  };
  const settings: EspnLeagueSettingsV1 = {
    version: 1,
    mappingVersion: ESPN_MAPPING_VERSION,
    externalLeagueKey,
    espnLeagueId: args.leagueId,
    leagueName,
    seasonKey: String(args.season),
    leagueType: normalizedLeagueType ?? "points",
    scoringType,
    teamCount,
    teams: normalizedTeams,
    skaterScoringCategories: scoringMaps.skater,
    goalieScoringCategories: scoringMaps.goalie,
    categoryWeights: scoringMaps.categories,
    rosterConfig,
    draftOrderType: draft.order,
    draftOrder: orderedDraft ? rawDraftOrder : [],
    draftType: draft.draftType,
    liveDraftSupported: draft.liveSupported && orderedDraft,
    sourceHash: sourceHash(source),
    fetchedAt,
    diagnostics: normalizedDiagnostics,
  };
  const states = teamStates(payload, normalizedTeams);
  const picks = draftPicks(payload, states);
  const status = record(payload.status);
  const detail = record(payload.draftDetail);
  const normalizedTransactions = transactions(payload);
  const stateSource = {
    version: 1 as const,
    externalLeagueKey,
    espnLeagueId: args.leagueId,
    seasonKey: String(args.season),
    currentScoringPeriodId: integer(payload.scoringPeriodId),
    currentMatchupPeriodId: integer(status.currentMatchupPeriod),
    isActive: boolean(status.isActive),
    teams: states,
    matchups: matchups(payload),
    transactions: normalizedTransactions,
    draft: {
      drafted: boolean(detail.drafted),
      inProgress: boolean(detail.inProgress),
      completeDate: isoDate(detail.completeDate),
      picks,
    },
    cursor: { transactionCount: normalizedTransactions.length, complete: true },
  };
  const stateWithoutHash = {
    ...stateSource,
    sectionFreshness: {
      settings: fetchedAt,
      teams: fetchedAt,
      rosters: fetchedAt,
      standings: fetchedAt,
      matchups: fetchedAt,
      transactions: fetchedAt,
      draft: fetchedAt,
    },
    fetchedAt,
  };
  return {
    settings,
    state: {
      ...stateWithoutHash,
      sourceHash: hashEspnLeagueState(stateWithoutHash),
    },
  };
}

export function normalizeEspnDraftPayload(args: {
  leagueId: string;
  season: number;
  swid: string;
  payload: unknown;
  fetchedAt?: Date;
}) {
  const payload = record(args.payload);
  const normalizedTeams = teams(payload, args.swid);
  const states = teamStates(payload, normalizedTeams);
  const detail = record(payload.draftDetail);
  return {
    drafted: boolean(detail.drafted),
    inProgress: boolean(detail.inProgress),
    completeDate: isoDate(detail.completeDate),
    picks: draftPicks(payload, states),
  };
}
