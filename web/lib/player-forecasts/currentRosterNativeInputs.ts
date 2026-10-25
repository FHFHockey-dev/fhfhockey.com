import { createHash } from "node:crypto";
import { timestampMicros } from "../projections/evidenceTime";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { finalBoxscoreForGame, rawPlayerForOutput } from "./settlement";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import { CURRENT_APPEARANCE_POLICY_VERSION, currentAppearanceDefinitionHash, type BaselineAppearanceInput } from "./baselineRates";
import { NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, NATIVE_GOALIE_VOLUME_POLICY_VERSION,
  nativeGoalieVolumeDefinitionHash, type GoalieAppearanceInput } from "./goalieBaselineRates";
import { deriveNativeGoalieOutcomes } from "./nativeGoalieOutcomes";
import { deriveNativePowerPlayPoints, type NativePowerPlayPointsInput } from "./nativePowerPlayPoints";
import type { NativeSkaterBaselineObservation } from "./baselineGeneration";
import type { NativeGoalieObservation } from "../../scripts/preview-native-baseline";
import { classifyCurrentRosterInjuryEvidence, type CurrentRosterInjuryEvidence } from "./currentRosterInjuryEvidence";
import type { CurrentSeasonSogResponse } from "./currentSeasonSogBaseline";

export type CurrentRosterNativeScope = {
  seasonId: number; cutoffAt: string;
  injuryEvidence?: CurrentRosterInjuryEvidence[];
  roster: Array<{ playerId: number; nhlPlayerId: number; teamId: number; rosterRevision: string; yahooPlayerKey?: string; playerClass: "skater" | "goalie" }>;
  /** Explicit approved historical games. Current-club discovery is not complete player history. */
  games: Array<{ id: number; seasonId: number; date: string; type: 2; startTime: string; homeTeamId: number; awayTeamId: number;
    endpoints: Array<"boxscore" | "landing"> }>;
};
export type CurrentRosterNativeInputs = CurrentRosterNativeScope & {
  receipts: CurrentSeasonSogResponse[]; failures?: Array<{ url: string; reason: string }>;
};
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const urlFor = (gameId: number, endpoint: string) => `https://api-web.nhle.com/v1/gamecenter/${gameId}/${endpoint}`;
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Offline only: original public HTTP receipts become denied native candidate inputs, never forecasts. */
export function assembleCurrentRosterNativeInputs(input: CurrentRosterNativeInputs, now = new Date()) {
  const cutoff = timestampMicros(input.cutoffAt), clock = Number.isFinite(now.getTime()) ? BigInt(now.getTime()) * BigInt(1000) : null;
  if (cutoff === null || clock === null || cutoff > clock || !Number.isSafeInteger(input.seasonId)
    || !/^\d{8}$/.test(String(input.seasonId)) || Math.floor(input.seasonId / 10000) + 1 !== input.seasonId % 10000
    || !Array.isArray(input.roster) || !input.roster.length || input.roster.length > 50
    || new Set(input.roster.map(row => row.playerId)).size !== input.roster.length
    || new Set(input.roster.map(row => row.nhlPlayerId)).size !== input.roster.length
    || input.roster.some(row => ![row.playerId, row.nhlPlayerId, row.teamId].every(id) || !row.rosterRevision?.trim()
      || !["skater", "goalie"].includes(row.playerClass))
    || !Array.isArray(input.games) || input.games.length > 60 || new Set(input.games.map(game => game.id)).size !== input.games.length
    || !Array.isArray(input.receipts) || input.receipts.length + (input.failures?.length ?? 0) > 120) throw new Error("Invalid bounded current-roster native scope.");
  if (input.injuryEvidence !== undefined && (!Array.isArray(input.injuryEvidence) || input.injuryEvidence.length > 100
    || input.injuryEvidence.some(row => !row || typeof row !== "object" || !row.payload
      || Buffer.byteLength(JSON.stringify(row)) > 16384))) throw new Error("Invalid bounded optional injury evidence.");
  const approved = new Map<string, { game: CurrentRosterNativeScope["games"][number]; endpoint: "boxscore" | "landing" }>();
  for (const game of input.games) {
    const start = timestampMicros(game.startTime);
    if (![game.id, game.homeTeamId, game.awayTeamId].every(id) || game.homeTeamId === game.awayTeamId
      || game.seasonId !== input.seasonId || game.type !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(game.date)
      || !Number.isFinite(Date.parse(game.date)) || new Date(game.date).toISOString().slice(0, 10) !== game.date
      || start === null || start >= cutoff || !Array.isArray(game.endpoints) || !game.endpoints.includes("boxscore")
      || new Set(game.endpoints).size !== game.endpoints.length || game.endpoints.some(endpoint => !["boxscore", "landing"].includes(endpoint))) {
      throw new Error("Historical game is outside the approved identity/clock scope.");
    }
    for (const endpoint of game.endpoints) approved.set(urlFor(game.id, endpoint), { game, endpoint });
  }
  if (approved.size > 120) throw new Error("Approved source request bound exceeded.");
  const failures = new Map<string, string>();
  for (const failure of input.failures ?? []) {
    if (!approved.has(failure.url) || failures.has(failure.url) || typeof failure.reason !== "string" || !failure.reason.trim()) throw new Error("Invalid or unapproved failed source receipt.");
    failures.set(failure.url, failure.reason);
  }
  const rows = new Map<string, Record<string, any>>();
  let totalBytes = 0;
  for (const receipt of input.receipts) {
    const bound = approved.get(receipt.url), captured = timestampMicros(receipt.capturedAt);
    if (!bound || rows.has(receipt.url) || failures.has(receipt.url) || typeof receipt.rawBody !== "string"
      || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024
      || !/^[a-f0-9]{64}$/.test(receipt.bodySha256) || sha(receipt.rawBody) !== receipt.bodySha256
      || captured === null || captured > cutoff || captured < timestampMicros(bound.game.startTime)!) throw new Error("Invalid original HTTP receipt/hash/URL/clock.");
    totalBytes += Buffer.byteLength(receipt.rawBody);
    if (totalBytes > 32 * 1024 * 1024) throw new Error("Original source byte budget exceeded.");
    const body = JSON.parse(receipt.rawBody), game = bound.game;
    if (!body || typeof body !== "object" || Array.isArray(body) || body.id !== game.id || body.season !== game.seasonId
      || body.gameDate !== game.date || body.gameType !== 2 || timestampMicros(body.startTimeUTC) !== timestampMicros(game.startTime)
      || body.homeTeam?.id !== game.homeTeamId || body.awayTeam?.id !== game.awayTeamId) throw new Error("HTTP source game identity conflicts with approved scope.");
    rows.set(receipt.url, { id: `http:${receipt.bodySha256}`, endpoint: bound.endpoint, game_id: game.id, season_id: game.seasonId,
      payload_hash: receipt.bodySha256, fetched_at: receipt.capturedAt, payload: body, httpReceipt: structuredClone(receipt) });
  }
  const skaters: NativeSkaterBaselineObservation[] = [], goalieWins: NativeGoalieObservation[] = [], goalieVolume: NativeGoalieObservation[] = [];
  const coverage = input.roster.map(player => {
    const appearances: BaselineAppearanceInput[] = [], goalieAppearances: GoalieAppearanceInput[] = [];
    const landings: NativePowerPlayPointsInput["landing"][] = [];
    const games: Array<{ gameId: number; historicalTeamId: number | null; status: string; reasons: string[] }> = [];
    for (const game of input.games) {
      const boxUrl = urlFor(game.id, "boxscore"), raw = rows.get(boxUrl), reasons: string[] = [];
      if (!raw) { games.push({ gameId: game.id, historicalTeamId: null, status: "unavailable", reasons: [failures.get(boxUrl) ?? "missing_boxscore_receipt"] }); continue; }
      const final = finalBoxscoreForGame(raw, game);
      if (!final) throw new Error("Historical boxscore is malformed or not final.");
      const home = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.homeTeamId }, final);
      const away = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.awayTeamId }, final);
      if (!home || !away) throw new Error("Boxscore player identities are malformed or duplicated across teams.");
      const own = home.skater || home.goalie ? home : away.skater || away.goalie ? away : null;
      if (!own) { games.push({ gameId: game.id, historicalTeamId: null, status: "excluded", reasons: ["absent_from_selected_game"] }); continue; }
      if (!(player.playerClass === "skater" ? own.skater : own.goalie)) throw new Error("Canonical player class conflicts with original boxscore.");
      const teamId = own.side === "homeTeam" ? game.homeTeamId : game.awayTeamId;
      const appearance = baselineAppearanceFromBoxscore({ rawRow: raw, game, nhlPlayerId: player.nhlPlayerId,
        teamId, cutoffAt: input.cutoffAt, population: player.playerClass });
      if (!appearance) { games.push({ gameId: game.id, historicalTeamId: teamId, status: "excluded", reasons: ["observed_zero_minutes"] }); continue; }
      if (player.playerClass === "skater") {
        const skater = appearance as BaselineAppearanceInput;
        appearances.push(skater);
        for (const target of ["GOALS", "ASSISTS", "POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES"]) {
          if (skater.targets[target] == null) reasons.push(`missing_target:${target}`);
        }
        const landing = rows.get(urlFor(game.id, "landing"));
        if (landing) {
          const receipt = { rawRow: landing, contentHash: hash(landing.payload) };
          try { deriveNativePowerPlayPoints({ appearance: skater, landing: receipt, nhlPlayerId: player.nhlPlayerId, cutoffAt: input.cutoffAt }); landings.push(receipt); }
          catch { reasons.push("unsupported_landing_ppp"); }
        } else reasons.push(failures.get(urlFor(game.id, "landing")) ?? "missing_landing_ppp");
      } else {
        const goalie = appearance as GoalieAppearanceInput;
        goalieAppearances.push(goalie);
        reasons.push("missing_target:SHUTOUTS_GOALIE");
        try {
          if (deriveNativeGoalieOutcomes({ appearance: goalie, nhlPlayerId: player.nhlPlayerId, cutoffAt: input.cutoffAt }).winCredit === null) reasons.push("missing_target:WINS_GOALIE");
        } catch { reasons.push("unsupported_goalie_outcome_context"); }
      }
      games.push({ gameId: game.id, historicalTeamId: teamId, status: "verified_positive_minutes", reasons });
    }
    const selected = player.playerClass === "skater" ? appearances : goalieAppearances;
    const common = { basis: "captured_current" as const, capturedAt: input.cutoffAt, playerId: player.playerId,
      nhlPlayerId: player.nhlPlayerId, teamId: player.teamId, rosterRevision: player.rosterRevision, projections: [],
      limitations: ["History is limited to explicitly approved games; current-club discovery cannot certify complete player or traded-player history."] };
    const envelope = { provider: "fhfh", entity_kind: "player", entity_key: `${input.seasonId}:${player.playerId}`, available_at: input.cutoffAt };
    if (appearances.length) {
      const payload: NativeSkaterBaselineObservation["payload"] = { ...common, policyVersion: CURRENT_APPEARANCE_POLICY_VERSION,
        definitionHash: currentAppearanceDefinitionHash(input.seasonId), appearances,
        ...(landings.length === appearances.length ? { derivedPowerPlayPoints: { version: "native-power-play-points-inputs-v1" as const, landings } } : {}) };
      skaters.push({ ...envelope, dataset_key: "baseline-inputs-v1", payload_hash: hash(payload), payload });
    }
    if (goalieAppearances.length) for (const [policyVersion, definitionHash, output] of [
      [NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, goalieWins],
      [NATIVE_GOALIE_VOLUME_POLICY_VERSION, nativeGoalieVolumeDefinitionHash, goalieVolume],
    ] as const) {
      const payload = { ...common, policyVersion, definitionHash: definitionHash(input.seasonId), appearances: goalieAppearances };
      output.push({ ...envelope, dataset_key: "goalie-baseline-inputs-v1", payload_hash: hash(payload), payload });
    }
    const injuryEvidence = (input.injuryEvidence ?? []).filter(row => row.playerId === player.playerId)
      .map(row => classifyCurrentRosterInjuryEvidence(row, player, input.seasonId, input.cutoffAt));
    const injurySupported = injuryEvidence.length > 0 && injuryEvidence.every(row => row.status === "injury_supported");
    return { playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, playerClass: player.playerClass,
      verifiedAppearances: selected.length, observationEmitted: selected.length > 0,
      historyStatus: selected.length ? "verified_current_appearances" : "no_verified_appearances_in_selected_games",
      missingHistoryContext: selected.length ? "not_applicable" : injurySupported ? "injury_supported" : "unknown",
      seasonAppearanceAbsence: "unverified", priorAbilityInference: "none", injuryEvidence, games };
  });
  return { version: "current-roster-native-inputs-v1", cutoffAt: input.cutoffAt, assembledAt: now.toISOString(),
    skaters, goalieWins, goalieVolume, coverage, injuryEvidence: structuredClone(input.injuryEvidence ?? []), injuryClassification: "diagnostic_only", originalReceipts: structuredClone(input.receipts),
    sourceReceiptCoverage: [...approved.keys()].every(url => rows.has(url)) ? "complete_for_approved_urls" : "partial_for_approved_urls",
    missingSources: [...approved.keys()].filter(url => !rows.has(url)).map(url => ({ url, reason: failures.get(url) ?? "not_supplied" })),
    selectedHistoryCoverage: "unverified", sourceRequests: 0, databaseWrites: 0, forecastIssued: false, publicUsesApproved: false };
}
