import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export const YAHOO_DRAFT_SESSION_STORAGE_KEY =
  "draftDashboard.yahooLiveDraft.v3";

export type DraftDashboardMode = "manual" | "yahoo";

export type YahooDraftSessionStatus =
  | "predraft"
  | "active"
  | "stopped"
  | "complete"
  | "error"
  | "reauth_required";

export interface YahooDraftLeague {
  externalLeagueId: string;
  name: string;
  teamName?: string;
  season?: string | number;
  draftStatus?: string;
  yahooLeagueUrl?: string;
  supported: boolean;
  unsupportedReason?: string;
  session?: Pick<YahooDraftSession, "id" | "status" | "providerStatus"> | null;
}

export interface YahooDraftRankingOption {
  id: string;
  name?: string;
}

export interface YahooDraftSession {
  id: string;
  status: YahooDraftSessionStatus;
  providerStatus?: string | null;
  snapshotVersion?: number;
  lastSuccessfulPollAt?: string | null;
  lastPickNumber?: number;
  nextPollAt?: string | null;
  yahooLeagueUrl?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  yahooSeason?: string | null;
  targetSeasonId?: number | null;
  diagnostics?: Record<string, unknown> | null;
  stale?: boolean;
}

export interface YahooDraftTeam {
  yahooTeamKey: string;
  name: string;
  draftPosition?: number;
  isUserTeam?: boolean;
}

export interface YahooDraftPick {
  pickNumber: number;
  roundNumber: number;
  pickInRound?: number;
  yahooTeamKey: string;
  yahooPlayerKey?: string | null;
  yahooPlayerId?: string | null;
  fhfhPlayerId?: string | null;
  displayName?: string | null;
  mappingStatus?: string | null;
  cost?: number | null;
  active: boolean;
  isCorrection?: boolean;
  revision?: number;
}

export interface YahooDraftState {
  session: YahooDraftSession;
  teams: YahooDraftTeam[];
  settings: Record<string, unknown>;
  picks: YahooDraftPick[];
}

export interface YahooDraftListState {
  enabled: boolean;
  leagues: YahooDraftLeague[];
  ranking: YahooDraftRankingOption | null;
}

export function yahooUnsupportedLeagueMessage(reason?: string): string {
  switch (reason) {
    case "yahoo_salary_cap_unsupported":
      return "Salary-cap Yahoo drafts are not supported by live sync.";
    case "yahoo_draft_type_unsupported":
      return "Offline and autopick Yahoo drafts are not supported by live sync.";
    case "yahoo_settings_unavailable":
      return "Yahoo league settings are unavailable, so live sync cannot start.";
    default:
      return "This Yahoo league does not have a supported live draft configuration.";
  }
}

export interface YahooReconciledDraftedPlayer {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  source: "yahoo";
  yahooSessionId: string;
  yahooPlayerKey?: string;
  yahooPlayerId?: string;
  yahooDisplayName?: string;
  yahooMappingStatus: "mapped" | "unresolved" | "review_required";
  auctionCost?: number | null;
}

export interface YahooUnresolvedPick {
  pickNumber: number;
  yahooPlayerKey?: string;
  yahooPlayerId?: string;
  displayName: string;
  reason: string;
}

export interface YahooDraftReconciliation {
  draftedPlayers: YahooReconciledDraftedPlayer[];
  unresolved: YahooUnresolvedPick[];
  warnings: string[];
  currentPick: number;
  expectedNext: {
    pickNumber: number;
    roundNumber: number;
    pickInRound: number;
    yahooTeamKey?: string;
    teamName?: string;
    predicted: true;
  };
}

export interface YahooDraftDashboardConfiguration {
  teamCount: number;
  draftOrder: string[];
  customTeamNames: Record<string, string>;
  myTeamId?: string;
  isSnakeDraft?: boolean;
  rosterConfig?: Record<string, number>;
  leagueType?: "points" | "categories";
  scoringCategories?: Record<string, number>;
  categoryWeights?: Record<string, number>;
}

export interface YahooDraftPersistenceV3 {
  v: 3;
  mode: DraftDashboardMode;
  sessionId: string | null;
  externalLeagueId: string | null;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(
  value: JsonRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return undefined;
}

function readNumber(
  value: JsonRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    const parsed =
      typeof candidate === "number"
        ? candidate
        : typeof candidate === "string" && candidate.trim()
          ? Number(candidate)
          : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readBoolean(
  value: JsonRecord,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "boolean") return candidate;
    if (candidate === "true" || candidate === 1) return true;
    if (candidate === "false" || candidate === 0) return false;
  }
  return undefined;
}

function readRecord(value: JsonRecord, ...keys: string[]): JsonRecord {
  for (const key of keys) {
    if (isRecord(value[key])) return value[key] as JsonRecord;
  }
  return {};
}

function normalizeSessionStatus(value: unknown): YahooDraftSessionStatus {
  switch (String(value || "").toLowerCase()) {
    case "active":
    case "drafting":
      return "active";
    case "stopped":
      return "stopped";
    case "complete":
    case "completed":
    case "postdraft":
      return "complete";
    case "error":
      return "error";
    case "reauth_required":
    case "reauth-required":
      return "reauth_required";
    default:
      return "predraft";
  }
}

export function normalizeYahooDraftListResponse(
  value: unknown,
): YahooDraftListState {
  const root = isRecord(value) ? value : {};
  const payload = isRecord(root.data) ? root.data : root;
  const leagues = Array.isArray(payload.leagues) ? payload.leagues : [];
  const rankingValue = isRecord(payload.ranking) ? payload.ranking : null;

  return {
    // The feature is deliberately fail-closed. Only an explicit true exposes it.
    enabled: payload.enabled === true,
    leagues: leagues.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const externalLeagueId = readString(
        candidate,
        "externalLeagueId",
        "external_league_id",
        "id",
      );
      if (!externalLeagueId) return [];
      const rawLeagueSession = isRecord(candidate.session)
        ? candidate.session
        : null;
      const leagueSessionId = rawLeagueSession
        ? readString(rawLeagueSession, "id")
        : undefined;
      return [
        {
          externalLeagueId,
          name:
            readString(candidate, "name", "leagueName", "league_name") ||
            "Yahoo league",
          teamName: readString(candidate, "teamName", "team_name"),
          season: readString(candidate, "season") || readNumber(candidate, "season"),
          draftStatus: readString(
            candidate,
            "draftStatus",
            "draft_status",
          ),
          yahooLeagueUrl: readString(
            candidate,
            "yahooLeagueUrl",
            "yahoo_league_url",
          ),
          supported:
            readBoolean(candidate, "supported", "isSupported", "is_supported") ??
            true,
          unsupportedReason: readString(
            candidate,
            "unsupportedReason",
            "unsupported_reason",
          ),
          session: leagueSessionId
            ? {
                id: leagueSessionId,
                status: normalizeSessionStatus(
                  rawLeagueSession?.status || rawLeagueSession?.providerStatus,
                ),
                providerStatus:
                  readString(
                    rawLeagueSession as JsonRecord,
                    "providerStatus",
                    "provider_status",
                  ) || null,
              }
            : null,
        },
      ];
    }),
    ranking:
      rankingValue && readString(rankingValue, "id")
        ? {
            id: readString(rankingValue, "id") as string,
            name: readString(rankingValue, "name", "title"),
          }
        : null,
  };
}

function normalizeYahooDraftPick(value: unknown): YahooDraftPick | null {
  if (!isRecord(value)) return null;
  const pickNumber = readNumber(value, "pickNumber", "pick_number", "pick");
  if (!pickNumber || pickNumber < 1) return null;
  const roundNumber =
    readNumber(value, "roundNumber", "round_number", "round") || 1;
  const yahooTeamKey =
    readString(value, "yahooTeamKey", "yahoo_team_key", "teamKey") || "";
  return {
    pickNumber,
    roundNumber,
    pickInRound: readNumber(value, "pickInRound", "pick_in_round"),
    yahooTeamKey,
    yahooPlayerKey: readString(
      value,
      "yahooPlayerKey",
      "yahoo_player_key",
      "playerKey",
    ),
    yahooPlayerId: readString(
      value,
      "yahooPlayerId",
      "yahoo_player_id",
      "playerId",
    ),
    fhfhPlayerId: readString(value, "fhfhPlayerId", "fhfh_player_id"),
    displayName: readString(
      value,
      "displayName",
      "playerName",
      "player_name",
    ),
    mappingStatus: readString(value, "mappingStatus", "mapping_status"),
    cost: readNumber(value, "cost", "auctionCost", "auction_cost"),
    active: readBoolean(value, "active", "isActive", "is_active") ?? true,
    isCorrection:
      readBoolean(value, "isCorrection", "is_correction") || false,
    revision: readNumber(value, "revision"),
  };
}

function normalizeYahooDraftTeam(value: unknown): YahooDraftTeam | null {
  if (!isRecord(value)) return null;
  const yahooTeamKey = readString(
    value,
    "yahooTeamKey",
    "yahoo_team_key",
    "teamKey",
    "externalTeamKey",
    "external_team_key",
  );
  if (!yahooTeamKey) return null;
  return {
    yahooTeamKey,
    name:
      readString(value, "name", "displayName", "teamName", "team_name") ||
      yahooTeamKey,
    draftPosition: readNumber(
      value,
      "draftPosition",
      "draft_position",
      "position",
    ),
    isUserTeam:
      readBoolean(
        value,
        "isUserTeam",
        "is_user_team",
        "isMyTeam",
        "isOwned",
      ) || false,
  };
}

export function normalizeYahooDraftStateResponse(
  value: unknown,
): YahooDraftState | null {
  const root = isRecord(value) ? value : {};
  const payload = isRecord(root.data) ? root.data : root;
  const rawSession = readRecord(payload, "session");
  const id = readString(rawSession, "id");
  if (!id) return null;

  const picks = (Array.isArray(payload.picks) ? payload.picks : [])
    .map(normalizeYahooDraftPick)
    .filter((pick): pick is YahooDraftPick => Boolean(pick));
  const teams = (Array.isArray(payload.teams) ? payload.teams : [])
    .map(normalizeYahooDraftTeam)
    .filter((team): team is YahooDraftTeam => Boolean(team));

  return {
    session: {
      id,
      status: normalizeSessionStatus(
        rawSession.status || rawSession.providerStatus || rawSession.provider_status,
      ),
      providerStatus:
        readString(rawSession, "providerStatus", "provider_status") || null,
      snapshotVersion: readNumber(
        rawSession,
        "snapshotVersion",
        "snapshot_version",
      ),
      lastSuccessfulPollAt:
        readString(
          rawSession,
          "lastSuccessfulPollAt",
          "last_successful_poll_at",
          "lastSnapshotAt",
          "last_snapshot_at",
        ) || null,
      lastPickNumber: readNumber(
        rawSession,
        "lastPickNumber",
        "last_pick_number",
      ),
      nextPollAt:
        readString(rawSession, "nextPollAt", "next_poll_at") || null,
      yahooLeagueUrl:
        readString(rawSession, "yahooLeagueUrl", "yahoo_league_url") || null,
      lastErrorCode:
        readString(rawSession, "lastErrorCode", "last_error_code") || null,
      lastErrorMessage:
        readString(rawSession, "lastErrorMessage", "last_error_message") ||
        null,
      yahooSeason:
        readString(rawSession, "yahooSeason", "yahoo_season") || null,
      targetSeasonId:
        readNumber(rawSession, "targetSeasonId", "target_season_id") || null,
      diagnostics: isRecord(rawSession.diagnostics)
        ? rawSession.diagnostics
        : null,
      stale: readBoolean(rawSession, "stale") || false,
    },
    teams,
    settings: readRecord(payload, "settings"),
    picks,
  };
}

export function getFirstMissingYahooPick(picks: YahooDraftPick[]): number {
  const occupied = new Set(
    picks
      .filter((pick) => pick.active && pick.pickNumber > 0)
      .map((pick) => pick.pickNumber),
  );
  let pickNumber = 1;
  while (occupied.has(pickNumber)) pickNumber += 1;
  return pickNumber;
}

function yahooIdFromPlayerKey(playerKey?: string | null): string | undefined {
  if (!playerKey) return undefined;
  return playerKey.match(/^477\.p\.(\d+)$/)?.[1];
}

function readDraftOrderMode(settings: Record<string, unknown>): {
  isSnakeDraft: boolean;
  explicit: boolean;
} {
  const diagnostics = isRecord(settings.diagnostics)
    ? settings.diagnostics
    : {};
  const inferred =
    readBoolean(
      diagnostics,
      "inferredDraftOrder",
      "inferred_draft_order",
    ) === true;
  const explicit = readBoolean(
    settings,
    "isSnakeDraft",
    "is_snake_draft",
    "snakeDraft",
  );
  if (explicit !== undefined) {
    return { isSnakeDraft: explicit, explicit: !inferred };
  }
  const draftOrder = readString(
    settings,
    "draftOrder",
    "draft_order",
    "draftOrderType",
    "draft_order_type",
  )?.toLowerCase();
  if (draftOrder === "snake") return { isSnakeDraft: true, explicit: true };
  if (draftOrder === "straight") return { isSnakeDraft: false, explicit: true };
  return { isSnakeDraft: true, explicit: false };
}

function orderedTeams(state: YahooDraftState): YahooDraftTeam[] {
  const teams = [...state.teams];
  teams.sort((a, b) => {
    if (a.draftPosition && b.draftPosition) {
      return a.draftPosition - b.draftPosition;
    }
    if (a.draftPosition) return -1;
    if (b.draftPosition) return 1;
    return a.yahooTeamKey.localeCompare(b.yahooTeamKey);
  });
  return teams;
}

export function reconcileYahooDraftState(
  state: YahooDraftState | null,
  players: ProcessedPlayer[],
): YahooDraftReconciliation {
  const picks = state?.picks || [];
  const currentPick = getFirstMissingYahooPick(picks);
  const teamCount = Math.max(
    1,
    state?.teams.length ||
      readNumber(state?.settings || {}, "teamCount", "numTeams", "num_teams") ||
      1,
  );
  const roundNumber = Math.ceil(currentPick / teamCount);
  const pickInRound = ((currentPick - 1) % teamCount) + 1;

  const byYahooId = new Map<string, ProcessedPlayer[]>();
  for (const player of players) {
    if (player.yahooPlayerId != null && String(player.yahooPlayerId)) {
      const yahooPlayerId = String(player.yahooPlayerId);
      byYahooId.set(yahooPlayerId, [
        ...(byYahooId.get(yahooPlayerId) || []),
        player,
      ]);
    }
  }

  const activeByPickNumber = new Map<number, YahooDraftPick>();
  for (const pick of picks) {
    if (pick.active) activeByPickNumber.set(pick.pickNumber, pick);
  }

  const draftedPlayers: YahooReconciledDraftedPlayer[] = [];
  const unresolved: YahooUnresolvedPick[] = [];
  for (const pick of [...activeByPickNumber.values()].sort(
    (a, b) => a.pickNumber - b.pickNumber,
  )) {
    const exactYahooId =
      pick.yahooPlayerId || yahooIdFromPlayerKey(pick.yahooPlayerKey);
    const candidates = exactYahooId
      ? byYahooId.get(String(exactYahooId)) || []
      : [];
    const matchedPlayer = candidates.length === 1 ? candidates[0] : undefined;
    const reviewRequired = pick.mappingStatus === "review_required";
    const displayName = pick.displayName || pick.yahooPlayerKey || "Unknown Yahoo player";

    if (!matchedPlayer || reviewRequired) {
      unresolved.push({
        pickNumber: pick.pickNumber,
        yahooPlayerKey: pick.yahooPlayerKey || undefined,
        yahooPlayerId: exactYahooId,
        displayName,
        reason: reviewRequired
          ? "This identity match requires review and was not applied automatically."
          : candidates.length > 1
            ? "The Yahoo player ID matched multiple projection players, so no player was selected."
            : "No exact Yahoo player ID mapping was found. Name matching was not attempted.",
      });
    }

    draftedPlayers.push({
      playerId: matchedPlayer && !reviewRequired
        ? String(matchedPlayer.playerId)
        : String(-pick.pickNumber),
      teamId: pick.yahooTeamKey || `Yahoo Team ${pick.pickInRound || 1}`,
      pickNumber: pick.pickNumber,
      round: pick.roundNumber,
      pickInRound:
        pick.pickInRound || ((pick.pickNumber - 1) % teamCount) + 1,
      source: "yahoo",
      yahooSessionId: state?.session.id || "",
      yahooPlayerKey: pick.yahooPlayerKey || undefined,
      yahooPlayerId: exactYahooId,
      yahooDisplayName: displayName,
      yahooMappingStatus: reviewRequired
        ? "review_required"
        : matchedPlayer
          ? "mapped"
          : "unresolved",
      auctionCost: pick.cost,
    });
  }

  const teams = state ? orderedTeams(state) : [];
  const baseIndex = (currentPick - 1) % teamCount;
  const draftOrderMode = readDraftOrderMode(state?.settings || {});
  const teamIndex =
    state && draftOrderMode.isSnakeDraft && roundNumber % 2 === 0
      ? teamCount - baseIndex - 1
      : baseIndex;
  const expectedTeam = teams[teamIndex];

  return {
    draftedPlayers,
    unresolved,
    warnings: draftOrderMode.explicit
      ? []
      : [
          "Yahoo did not provide an explicit snake or straight draft order. The companion is predicting a snake draft until confirmed.",
        ],
    currentPick,
    expectedNext: {
      pickNumber: currentPick,
      roundNumber,
      pickInRound,
      yahooTeamKey: expectedTeam?.yahooTeamKey,
      teamName: expectedTeam?.name,
      predicted: true,
    },
  };
}

function normalizeNumericRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([key, candidate]) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? [[key, parsed] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function deriveYahooDraftDashboardConfiguration(
  state: YahooDraftState,
): YahooDraftDashboardConfiguration {
  const teams = orderedTeams(state);
  const draftOrder = teams.map((team) => team.yahooTeamKey);
  for (const pick of state.picks) {
    if (pick.active && pick.yahooTeamKey && !draftOrder.includes(pick.yahooTeamKey)) {
      draftOrder.push(pick.yahooTeamKey);
    }
  }

  const rawRoster =
    state.settings.rosterConfig || state.settings.roster_config || undefined;
  const rawScoring =
    state.settings.scoringCategories ||
    state.settings.scoring_categories ||
    undefined;
  const rawCategoryWeights =
    state.settings.categoryWeights || state.settings.category_weights || undefined;
  const leagueType = readString(
    state.settings,
    "leagueType",
    "league_type",
  );

  return {
    teamCount:
      readNumber(state.settings, "teamCount", "numTeams", "num_teams") ||
      draftOrder.length ||
      1,
    draftOrder,
    customTeamNames: Object.fromEntries(
      teams.map((team) => [team.yahooTeamKey, team.name]),
    ),
    myTeamId: teams.find((team) => team.isUserTeam)?.yahooTeamKey,
    isSnakeDraft: readDraftOrderMode(state.settings).isSnakeDraft,
    rosterConfig: normalizeNumericRecord(rawRoster),
    leagueType:
      leagueType === "points" || leagueType === "categories"
        ? leagueType
        : undefined,
    scoringCategories: normalizeNumericRecord(rawScoring),
    categoryWeights: normalizeNumericRecord(rawCategoryWeights),
  };
}

export function yahooSettingsRequireScoringConfirmation(
  state: YahooDraftState | null,
): boolean {
  if (!state) return false;
  const settings = state.settings;
  if (
    readBoolean(
      settings,
      "requiresScoringConfirmation",
      "requires_scoring_confirmation",
    ) === true
  ) {
    return true;
  }

  const diagnostics = isRecord(settings.scoringDiagnostics)
    ? settings.scoringDiagnostics
    : isRecord(settings.scoring_diagnostics)
      ? settings.scoring_diagnostics
      : state.session.diagnostics || {};
  const unsupported =
    settings.unsupportedScoringStats ||
    settings.unsupported_scoring_stats ||
    diagnostics.unsupportedStats ||
    diagnostics.unsupported_stats ||
    diagnostics.unsupportedStatIds ||
    diagnostics.unsupported_stat_ids ||
    diagnostics.unmappedStats ||
    diagnostics.unmapped_stats;
  if (Array.isArray(unsupported) && unsupported.length > 0) return true;

  const configuration = deriveYahooDraftDashboardConfiguration(state);
  return (
    !configuration.scoringCategories && !configuration.categoryWeights
  );
}

export function yahooSettingsRequireDraftOrderConfirmation(
  state: YahooDraftState | null,
): boolean {
  if (!state) return false;
  if (
    readBoolean(
      state.settings,
      "requiresDraftOrderConfirmation",
      "requires_draft_order_confirmation",
    ) === true
  ) {
    return true;
  }
  const diagnostics = isRecord(state.settings.diagnostics)
    ? state.settings.diagnostics
    : {};
  if (
    readBoolean(
      diagnostics,
      "inferredDraftOrder",
      "inferred_draft_order",
    ) === true
  ) {
    return true;
  }
  return !readDraftOrderMode(state.settings).explicit;
}

export function yahooSettingsWarnings(state: YahooDraftState | null): string[] {
  if (!state) return [];
  const diagnostics = isRecord(state.settings.diagnostics)
    ? state.settings.diagnostics
    : {};
  return Array.isArray(diagnostics.warnings)
    ? diagnostics.warnings.filter(
        (warning): warning is string =>
          typeof warning === "string" && Boolean(warning.trim()),
      )
    : [];
}

export function yahooSettingsRequireGeneralConfirmation(
  state: YahooDraftState | null,
): boolean {
  return state
    ? readBoolean(
        state.settings,
        "requiresConfirmation",
        "requires_confirmation",
      ) === true || yahooSettingsWarnings(state).length > 0
    : false;
}

export function loadYahooDraftPersistence(
  storage: Pick<Storage, "getItem">,
): YahooDraftPersistenceV3 {
  const fallback: YahooDraftPersistenceV3 = {
    v: 3,
    mode: "manual",
    sessionId: null,
    externalLeagueId: null,
  };
  try {
    const raw = storage.getItem(YAHOO_DRAFT_SESSION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<YahooDraftPersistenceV3>;
    if (parsed.v !== 3) return fallback;
    return {
      v: 3,
      mode: parsed.mode === "yahoo" ? "yahoo" : "manual",
      sessionId:
        typeof parsed.sessionId === "string" && parsed.sessionId
          ? parsed.sessionId
          : null,
      externalLeagueId:
        typeof parsed.externalLeagueId === "string" && parsed.externalLeagueId
          ? parsed.externalLeagueId
          : null,
    };
  } catch {
    return fallback;
  }
}

export function saveYahooDraftPersistence(
  storage: Pick<Storage, "setItem">,
  value: Omit<YahooDraftPersistenceV3, "v">,
): void {
  storage.setItem(
    YAHOO_DRAFT_SESSION_STORAGE_KEY,
    JSON.stringify({ v: 3, ...value } satisfies YahooDraftPersistenceV3),
  );
}

export function selectDraftedPlayersForMode<T>(
  mode: DraftDashboardMode,
  manualDraftedPlayers: T[],
  yahooDraftedPlayers: T[],
): T[] {
  return mode === "yahoo" ? yahooDraftedPlayers : manualDraftedPlayers;
}

export function continueManuallyFromYahoo(
  reconciliation: YahooDraftReconciliation,
): {
  draftedPlayers: YahooReconciledDraftedPlayer[];
  currentPick: number;
} {
  return {
    draftedPlayers: reconciliation.draftedPlayers.map((player) => ({
      ...player,
      source: "yahoo",
    })),
    currentPick: reconciliation.currentPick,
  };
}
