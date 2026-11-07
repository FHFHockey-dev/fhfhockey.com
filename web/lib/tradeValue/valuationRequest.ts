import type { GameExpectationsResponse } from "lib/player-forecasts/gameExpectations";
import type { TradeScoring } from "lib/buyLowSellHigh/trade";
import { uniqueVerifiedYahooIdentities, yahooIdentityContextKey } from "lib/integrations/yahoo/yahooIdentity";
import type { Result } from "./contracts";
import { leagueValuationComponents } from "./valuationComponents";

/**
 * FR1 request binding plus the dated Yahoo ADP component. Pure: no loader, query, route or UI.
 * Projected points are delegated unchanged to `leagueValuationComponents`; a caller-supplied
 * view is still not proof of admission. Actuals, rank, VOR, combined value and the suggestion
 * guard stay unavailable until their upstream inputs and methods are qualified.
 */
export const ADP_HISTORY_TABLE = "yahoo_player_draft_analysis_history" as const;
export const ADP_ATOMIC_WRITER = "upsert_yahoo_players_atomic" as const;
export const IDENTITY_TABLE = "fhfh_player_external_identities" as const;

export type ValuationRequest = {
  leagueKey: string; gameKey: string; seasonId: number;
  scoringProfile: { id: string; version: string; origin: "connected" | "manual" | "fhfh_standard"; scoring: TradeScoring };
  horizon: { mode: "next_n"; games: 5 | 10 | 20 };
  decisionCutoff: string; fhfhPlayerId: string;
  adpPolicy: { id: string; maxCaptureAgeDays: number };
};
/** One row of the existing history table, as captured by the caller. */
export type AdpHistoryRow = {
  player_key: string; captured_at: string; average_draft_pick: number | null;
  average_draft_round?: number | null; average_draft_cost?: number | null; percent_drafted?: number | null;
  source: string | null;
};
export type ValuationInputs = {
  forecastView: GameExpectationsResponse | null;
  adp: { capture: { table: string; retrievedAt: string; sha256: string } | null; rows: readonly AdpHistoryRow[] };
  identity: IdentityCapture;
};
/** One `fhfh_player_external_identities` row, with the scope metadata the existing verified loader filters on. */
export type IdentityRow = {
  provider: string; context_key: string; season_id: number | null; verification_status: string;
  external_player_id: string; fhfh_player_id: number | string;
};
/**
 * Caller's capture of identity rows for the request's Yahoo game and season.
 * Checked here: table name, every row's provider/context/season/verification_status, and two-way uniqueness.
 * Asserted upstream, not authenticated here: capture bytes/origin, and `completeness: "two_way"` meaning every
 * row for the candidate keys and for the requested player was included (as `loadVerifiedYahooIdentitiesForKeys` reads).
 */
export type IdentityCapture = {
  capture: { table: string; retrievedAt: string; sha256: string; completeness: "two_way" } | null;
  rows: readonly IdentityRow[];
};
export type DatedAdp = {
  value: number; capturedAt: string; playerKey: string; scope: "yahoo_public_adp";
  source: typeof ADP_ATOMIC_WRITER; captureSha256: string; policyId: string;
};

const DAY_MS = 86_400_000;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const time = (value: unknown) => typeof value === "string" && TIMESTAMP.test(value) ? Date.parse(value) : NaN;
const blank = (value: unknown) => typeof value !== "string" || !value.trim();
const withheld = <T>(reasons: string[]): Result<T> => ({ status: "unavailable", reasons: [...new Set(reasons)] });

function requestReasons(request: ValuationRequest): string[] {
  const reasons: string[] = [];
  const gameKeyValid = typeof request.gameKey === "string" && /^\d+$/.test(request.gameKey);
  if (!gameKeyValid) reasons.push("request_game_key_invalid");
  if (blank(request.leagueKey)) reasons.push("request_league_key_missing");
  else if (gameKeyValid && !new RegExp(`^${request.gameKey}\\.l\\.\\d+$`).test(request.leagueKey)) reasons.push("league_game_mismatch");
  if (!Number.isSafeInteger(request.seasonId) || request.seasonId <= 0) reasons.push("request_season_invalid");
  if (blank(request.scoringProfile?.id) || blank(request.scoringProfile?.version)) reasons.push("request_scoring_profile_missing");
  if (request.horizon?.mode !== "next_n" || ![5, 10, 20].includes(request.horizon?.games)) reasons.push("request_horizon_invalid");
  if (!Number.isFinite(time(request.decisionCutoff))) reasons.push("request_cutoff_invalid");
  if (typeof request.fhfhPlayerId !== "string" || !/^[1-9]\d{0,14}$/.test(request.fhfhPlayerId)) reasons.push("request_player_invalid");
  if (blank(request.adpPolicy?.id) || !Number.isFinite(request.adpPolicy?.maxCaptureAgeDays) || request.adpPolicy.maxCaptureAgeDays <= 0) reasons.push("request_adp_policy_invalid");
  return reasons;
}

function viewReasons(request: ValuationRequest, view: GameExpectationsResponse | null): string[] {
  if (!view) return [];
  const reasons: string[] = [];
  if (view.scope.seasonId !== request.seasonId) reasons.push("season_mismatch");
  if (view.scope.mode !== request.horizon.mode || view.scope.games !== request.horizon.games) reasons.push("horizon_mismatch");
  if (time(view.readAsOf) !== time(request.decisionCutoff)) reasons.push("cutoff_mismatch");
  if (!view.players.some(player => player.playerId === request.fhfhPlayerId)) reasons.push("player_mismatch");
  return reasons;
}

/** Every supplied identity row must carry the request's Yahoo scope and verified status; uniqueness alone is not verification. */
function identityReasons(request: ValuationRequest, identity: IdentityCapture): string[] {
  const { capture, rows } = identity;
  if (!capture || capture.table !== IDENTITY_TABLE || !Number.isFinite(time(capture.retrievedAt)) || blank(capture.sha256)
    || capture.completeness !== "two_way") return ["identity_capture_unavailable"];
  const context = yahooIdentityContextKey({ gameKey: request.gameKey, targetSeasonId: request.seasonId });
  const reasons: string[] = [];
  for (const row of rows) {
    if (row.provider !== "yahoo") reasons.push("identity_wrong_provider");
    if (row.season_id !== request.seasonId) reasons.push("identity_wrong_season");
    if (row.context_key !== context) reasons.push("identity_wrong_context");
    if (row.verification_status !== "verified") reasons.push("identity_unverified");
  }
  return [...new Set(reasons)].sort();
}

/**
 * Latest atomic-writer ADP row for the scope-verified, unique player at or before the cutoff. Missing is never zero.
 * Validates the request itself, so direct callers cannot bypass the policy checks the wrapper applies.
 */
export function datedAdp(request: ValuationRequest, inputs: Pick<ValuationInputs, "adp" | "identity">): Result<DatedAdp> {
  const invalid = requestReasons(request);
  if (invalid.length) return withheld(invalid);
  const { capture, rows } = inputs.adp;
  const cutoff = time(request.decisionCutoff), retrievedAt = time(capture?.retrievedAt);
  if (!capture || capture.table !== ADP_HISTORY_TABLE || !Number.isFinite(retrievedAt) || blank(capture.sha256)) return withheld(["adp_capture_unavailable"]);
  const scopeReasons = identityReasons(request, inputs.identity);
  if (scopeReasons.length) return withheld(scopeReasons);
  // Rows above are all provider/context/season-scoped and verified; this map adds two-way uniqueness only.
  const identities = uniqueVerifiedYahooIdentities([...inputs.identity.rows], request.gameKey);
  const gameRows = rows.filter(row => typeof row.player_key === "string" && row.player_key.startsWith(`${request.gameKey}.p.`));
  if (rows.length && !gameRows.length) return withheld(["adp_wrong_game"]);
  const playerRows = gameRows.filter(row => identities.get(row.player_key) === request.fhfhPlayerId);
  if (!playerRows.length) return withheld(["adp_identity_unresolved"]);
  const writerRows = playerRows.filter(row => row.source === ADP_ATOMIC_WRITER);
  if (!writerRows.length) return withheld(["adp_unqualified_source"]);
  const dated = writerRows.filter(row => Number.isFinite(time(row.captured_at)));
  if (!dated.length) return withheld(["adp_capture_time_invalid"]);
  const eligible = dated.filter(row => time(row.captured_at) <= cutoff && time(row.captured_at) <= retrievedAt);
  if (!eligible.length) return withheld(["adp_after_cutoff"]);
  const latestAt = Math.max(...eligible.map(row => time(row.captured_at)));
  const latest = eligible.filter(row => time(row.captured_at) === latestAt);
  if (new Set(latest.map(row => JSON.stringify([row.average_draft_pick, row.average_draft_round ?? null, row.average_draft_cost ?? null, row.percent_drafted ?? null]))).size > 1) return withheld(["conflicting_adp_rows"]);
  const row = latest[0];
  if (cutoff - latestAt > request.adpPolicy.maxCaptureAgeDays * DAY_MS) return withheld(["adp_stale"]);
  const value = row.average_draft_pick;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return withheld(["adp_missing_value"]);
  return { status: "available", value: {
    value, capturedAt: row.captured_at, playerKey: row.player_key, scope: "yahoo_public_adp",
    source: ADP_ATOMIC_WRITER, captureSha256: capture.sha256, policyId: request.adpPolicy.id,
  } };
}

export function qualifiedValuationComponents(request: ValuationRequest, inputs: ValuationInputs) {
  const bindingReasons = requestReasons(request);
  if (!bindingReasons.length) bindingReasons.push(...viewReasons(request, inputs.forecastView));
  const bound = bindingReasons.length === 0;
  const projectedPoints: Result<number> = bound
    ? leagueValuationComponents({
      view: inputs.forecastView, playerId: request.fhfhPlayerId, asOf: request.decisionCutoff,
      leagueProfile: { id: request.scoringProfile.id, version: request.scoringProfile.version, origin: request.scoringProfile.origin },
      scoring: request.scoringProfile.scoring,
    }).projectedPoints
    : withheld(bindingReasons);
  return {
    version: "qualified-valuation-components-v1" as const,
    binding: bound ? { status: "bound" as const } : { status: "unbound" as const, reasons: [...new Set(bindingReasons)] },
    request: {
      leagueKey: request.leagueKey, gameKey: request.gameKey, seasonId: request.seasonId,
      scoringProfile: { id: request.scoringProfile?.id, version: request.scoringProfile?.version, origin: request.scoringProfile?.origin },
      horizon: request.horizon, decisionCutoff: request.decisionCutoff, fhfhPlayerId: request.fhfhPlayerId,
    },
    projectedPoints,
    adp: bound ? datedAdp(request, inputs) : withheld<DatedAdp>(bindingReasons),
    actualPoints: withheld<number>(["season_actuals_untrusted_upstream"]),
    actualRank: withheld<number>(["season_rank_requires_qualified_actuals_and_universe"]),
    vor: withheld<number>(["replacement_universe_incomplete"]),
    combined: withheld<number>(["validated_normalization_and_weights_unavailable"]),
    plausibility: withheld<never>(["validated_guard_thresholds_unavailable"]),
    limitations: [
      "Forecast admission is not authenticated here; the view must come from the existing admitted consumer path.",
      "League key, Yahoo game key and scoring-profile version are caller-asserted, not checked against a registry.",
      "ADP is Yahoo-wide public draft data, not league-specific; capturedAt is FHFH capture time, not Yahoo publication time.",
      "Identity rows are checked for Yahoo provider, request game/season context and verified status; capture origin and two-way completeness are caller-asserted.",
      "ADP capture table, writer and sha256 are asserted metadata, not authenticated provenance.",
    ],
  };
}
