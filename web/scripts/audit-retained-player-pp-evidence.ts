import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isDeepStrictEqual, TextDecoder } from "node:util";

type Row = Record<string, unknown>;
export type PpAuditTarget = { playerId: number; teamId: number };
type Check = "matched" | "mismatched" | "missing" | "invalid";
type GoalAudit = {
  eventId: number | null;
  situationCode: string | null;
  strength: "pp" | "pk" | "ev" | "shootout" | "unknown";
  targetCredit: "goal" | "assist" | "none" | "unknown";
  attribution: "attributable_retained_event" | "excluded" | "unresolved";
  reasons: string[];
};
type SourceAudit = {
  sourceIndex: number;
  revisionId: string | null;
  gameId: number | null;
  rawBinding: { expectedHash: string | null; actualHash: string | null; hash: Check; parsedPayload: Check };
  eventIds: { status: "valid" | "invalid"; playCount: number | null; invalidIndexes: number[]; duplicateIds: number[] };
  finalStructure: { status: "present" | "partial"; gameState: string | null; terminalCount: number; reasons: string[] };
  targetTeamPresence: "present" | "absent" | "unknown";
  targetRosterPresence: "present" | "absent" | "contradictory" | "unknown";
  eventPopulation: "unknown";
  goalEvents: GoalAudit[];
  positiveRetainedPpCredits: { goals: number | null; assists: number | null; points: number | null };
  observedPpTotals: null;
  issues: string[];
};

const record = (value: unknown): Row | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const unique = (values: string[]) => [...new Set(values)];
const validDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function auditGoal(play: Row | null, homeId: unknown, awayId: unknown, roster: Row[] | null, target: PpAuditTarget): GoalAudit {
  const details = record(play?.details);
  const reasons: string[] = [];
  const eventId = positiveId(play?.eventId) ? play.eventId : null;
  const situationCode = typeof play?.situationCode === "string" ? play.situationCode.trim() : null;
  const result: GoalAudit = { eventId, situationCode, strength: "unknown", targetCredit: "unknown", attribution: "unresolved", reasons };
  const period = record(play?.periodDescriptor);
  if (period?.periodType === "SO") {
    result.strength = "shootout";
    result.attribution = "excluded";
    reasons.push("shootout_not_pp_credit");
    return result;
  }
  if (!positiveId(period?.number) || !["REG", "OT"].includes(String(period?.periodType))) reasons.push("invalid_goal_period");
  const owner = details?.eventOwnerTeamId;
  const ownerValid = positiveId(homeId) && positiveId(awayId) && homeId !== awayId && (owner === homeId || owner === awayId);
  if (!ownerValid) reasons.push("invalid_goal_team");

  // Local mirror of ingest/shifts.ts's four-digit policy; avoid its eager live client.
  if (!situationCode || !/^[01][0-6][0-6][01]$/.test(situationCode)) {
    reasons.push("invalid_situation_code");
  } else if (situationCode[0] !== "1" || situationCode[3] !== "1") {
    reasons.push("unguarded_net_strength_ambiguous");
  } else if (Number(situationCode[1]) < 3 || Number(situationCode[2]) < 3) {
    reasons.push("invalid_active_skater_count");
  } else if (ownerValid) {
    const mySkaters = Number(situationCode[owner === homeId ? 2 : 1]);
    const opponentSkaters = Number(situationCode[owner === homeId ? 1 : 2]);
    result.strength = mySkaters > opponentSkaters ? "pp" : mySkaters < opponentSkaters ? "pk" : "ev";
  }

  const scorer = details?.scoringPlayerId;
  const assist1 = details?.assist1PlayerId;
  const assist2 = details?.assist2PlayerId;
  const credits: number[] = [];
  if (!positiveId(scorer)) reasons.push("missing_or_invalid_scorer"); else credits.push(scorer);
  for (const assist of [assist1, assist2]) {
    if (assist == null) continue;
    if (!positiveId(assist)) reasons.push("invalid_assist_id"); else credits.push(assist);
  }
  if (assist2 != null && assist1 == null) reasons.push("second_assist_without_first");
  if (new Set(credits).size !== credits.length) reasons.push("contradictory_player_credit");
  if (!roster) reasons.push("missing_roster_for_credit_team");
  else for (const playerId of credits) {
    const entries = roster.filter(row => row.playerId === playerId);
    if (entries.length !== 1 || entries[0].teamId !== owner) reasons.push("unverified_or_contradictory_credit_team");
  }
  if (credits.includes(target.playerId)) {
    if (owner !== target.teamId) reasons.push("target_credit_team_mismatch");
    result.targetCredit = scorer === target.playerId ? "goal" : "assist";
  } else if (positiveId(scorer) && [assist1, assist2].every(id => id == null || positiveId(id))) {
    result.targetCredit = "none";
  }
  if (reasons.length === 0) {
    result.attribution = result.strength === "pp" ? "attributable_retained_event" : "excluded";
    if (result.strength !== "pp") reasons.push("non_pp_goal");
  }
  result.reasons = unique(reasons);
  return result;
}

function auditSource(value: unknown, sourceIndex: number, sources: unknown[], target: PpAuditTarget): SourceAudit {
  const source = record(value);
  const payload = record(source?.payload);
  const revisionId = text(source?.revisionId);
  const gameId = positiveId(payload?.id) ? payload.id : null;
  const issues: string[] = [];
  if (!revisionId) issues.push("missing_revision_id");
  else if (sources.filter(row => record(row)?.revisionId === revisionId).length !== 1) issues.push("duplicate_revision_id");
  if (gameId === null) issues.push("missing_or_invalid_game_id");
  else if (sources.filter(row => record(record(row)?.payload)?.id === gameId).length !== 1) issues.push("duplicate_game_id");

  const body = source?.bodyUtf8;
  const expectedHash = typeof source?.rawBytesHash === "string" ? source.rawBytesHash : null;
  const actualHash = typeof body === "string" ? hash(Buffer.from(body, "utf8")) : null;
  let hashStatus: Check = typeof body !== "string" ? "missing" : !sha256(expectedHash) ? "invalid" : actualHash === expectedHash ? "matched" : "mismatched";
  let parsedPayload: Check = "missing";
  if (typeof body === "string") {
    try {
      parsedPayload = payload ? isDeepStrictEqual(JSON.parse(body), payload) ? "matched" : "mismatched" : "missing";
      // Unpaired surrogates cannot bind the retained string to exact UTF-8 bytes.
      if (Buffer.from(body, "utf8").toString("utf8") !== body) hashStatus = "invalid";
    } catch { parsedPayload = "invalid"; }
  }
  if (hashStatus !== "matched") issues.push("raw_body_hash_" + hashStatus);
  if (parsedPayload !== "matched") issues.push("raw_body_payload_" + parsedPayload);

  const plays = Array.isArray(payload?.plays) ? payload.plays : null;
  const invalidIndexes: number[] = [], duplicateIds: number[] = [];
  const seen = new Set<number>();
  let terminalCount = 0;
  for (const [index, value] of (plays ?? []).entries()) {
    const play = record(value);
    if (!positiveId(play?.eventId)) invalidIndexes.push(index);
    else if (seen.has(play.eventId)) duplicateIds.push(play.eventId);
    else seen.add(play.eventId);
    if (play?.typeDescKey === "game-end") terminalCount++;
  }
  const eventIdsValid = plays !== null && invalidIndexes.length === 0 && duplicateIds.length === 0;
  if (!plays) issues.push("missing_plays");
  if (invalidIndexes.length) issues.push("missing_or_invalid_event_id");
  if (duplicateIds.length) issues.push("duplicate_event_id");
  const home = record(payload?.homeTeam), away = record(payload?.awayTeam);
  const homeId = home?.id, awayId = away?.id;
  const homeScore = home?.score, awayScore = away?.score;
  const teamsValid = positiveId(homeId) && positiveId(awayId) && homeId !== awayId;
  const structuralReasons: string[] = [];
  // Mirrors pbp.ts/pbpCompletenessServer.ts's final structure, not source-population proof.
  if (!["OFF", "FINAL"].includes(String(payload?.gameState))) structuralReasons.push("missing_final_game_state");
  if (terminalCount !== 1) structuralReasons.push("terminal_count_not_one");
  if (!plays || plays.length <= terminalCount) structuralReasons.push("missing_nonterminal_events");
  if (!eventIdsValid || gameId === null) structuralReasons.push("invalid_game_or_event_identity");
  if (!teamsValid) structuralReasons.push("invalid_game_teams");
  if (!validDate(payload?.gameDate) || !positiveId(payload?.gameType) || !/^[1-9]\d*$/.test(String(payload?.season ?? ""))) structuralReasons.push("invalid_game_metadata");
  if (!text(home?.abbrev) || !text(away?.abbrev) || !nonNegative(homeScore) || !nonNegative(awayScore)
    || (nonNegative(homeScore) && nonNegative(awayScore) && homeScore + awayScore <= 0)) structuralReasons.push("invalid_final_score_metadata");
  if (payload?.limitedScoring !== false) structuralReasons.push("limited_scoring_or_unknown_population_mode");
  issues.push(...structuralReasons);
  const targetTeamPresence = !teamsValid ? "unknown" : target.teamId === homeId || target.teamId === awayId ? "present" : "absent";
  const rosterValues = Array.isArray(payload?.rosterSpots) ? payload.rosterSpots : null;
  const roster = rosterValues?.every(row => record(row) !== null) ? rosterValues as Row[] : null;
  const targetRows = roster?.filter(row => row.playerId === target.playerId);
  const targetRosterPresence = !targetRows ? "unknown" : targetRows.length === 0 ? "absent"
    : targetRows.length === 1 && targetRows[0].teamId === target.teamId ? "present" : "contradictory";
  if (targetTeamPresence !== "present") issues.push(targetTeamPresence === "absent" ? "target_team_outside_scope" : "target_team_unknown");
  if (targetRosterPresence !== "present") issues.push("target_roster_" + targetRosterPresence);
  const trustedRetainedSource = hashStatus === "matched" && parsedPayload === "matched" && issues.length === 0;
  const goalEvents = (plays ?? []).map(record).filter(play => play?.typeDescKey === "goal")
    .map(play => {
      const goal = auditGoal(play, homeId, awayId, roster, target);
      if (!trustedRetainedSource && goal.attribution === "attributable_retained_event") {
        goal.attribution = "unresolved";
        goal.reasons.push("source_binding_structure_or_target_scope_unresolved");
      }
      return goal;
    });
  const targetPpEvents = goalEvents.filter(goal => goal.attribution === "attributable_retained_event" && goal.targetCredit !== "none");
  const goals = targetPpEvents.filter(goal => goal.targetCredit === "goal").length;
  const assists = targetPpEvents.filter(goal => goal.targetCredit === "assist").length;
  return {
    sourceIndex, revisionId, gameId,
    rawBinding: { expectedHash, actualHash, hash: hashStatus, parsedPayload },
    eventIds: { status: eventIdsValid ? "valid" : "invalid", playCount: plays?.length ?? null, invalidIndexes, duplicateIds: [...new Set(duplicateIds)].sort((a, b) => a - b) },
    finalStructure: { status: structuralReasons.length ? "partial" : "present", gameState: text(payload?.gameState), terminalCount, reasons: structuralReasons },
    targetTeamPresence, targetRosterPresence, eventPopulation: "unknown", goalEvents,
    positiveRetainedPpCredits: { goals: goals || null, assists: assists || null, points: goals + assists || null },
    observedPpTotals: null, issues: unique(issues),
  };
}

export function auditRetainedPlayerPpEvidence(bytes: Uint8Array, expectedHash: string, target: PpAuditTarget) {
  if (!positiveId(target.playerId) || !positiveId(target.teamId)) throw new Error("Target player and team IDs must be positive safe integers");
  const actualHash = hash(bytes);
  const issues: string[] = [];
  const binding = !sha256(expectedHash) ? "invalid_expected_hash" : expectedHash === actualHash ? "matched" : "mismatched";
  let input: Row | null = null;
  if (binding !== "matched") issues.push("input_byte_hash_" + binding);
  else {
    try { input = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); }
    catch { issues.push("invalid_input_json_or_utf8"); }
    if (!input) issues.push("missing_input_object");
  }
  const sources = input && Array.isArray(input.retainedHistorySources) ? input.retainedHistorySources : [];
  if (input && !Array.isArray(input.retainedHistorySources)) issues.push("missing_retained_history_sources");
  if (input && sources.length === 0) issues.push("empty_retained_history_sources");
  return {
    version: "retained-player-pp-event-audit-v1",
    purpose: "descriptive_retained_subset_only",
    inputBinding: { expectedHash, actualHash, status: binding },
    target: { playerId: target.playerId, teamId: target.teamId },
    qualificationEligible: false,
    unresolvedEvidence: {
      historicalPopulation: "unknown", eventPopulation: "unknown", exposure: "unknown",
      historicalSourceTiming: "unknown", rights: "unknown", participation: "unknown",
    },
    countsSemantics: "positive_retained_events_only_null_is_not_observed_zero",
    sources: sources.map((source, index) => auditSource(source, index, sources, target)),
    issues,
  };
}

export function runRetainedPlayerPpAudit(args: string[]) {
  const usage = "Use --input LOCAL_FILE --input-sha256 SHA256 --player-id NHL_ID --team-id TEAM_ID";
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--input", "--input-sha256", "--player-id", "--team-id"].includes(args[index]) || !args[index + 1] || options.has(args[index])) throw new Error(usage);
    options.set(args[index], args[index + 1]);
  }
  if (options.size !== 4 || !sha256(options.get("--input-sha256"))) throw new Error(usage);
  const id = (key: string) => {
    const value = options.get(key)!;
    if (!/^[1-9]\d*$/.test(value) || !positiveId(Number(value))) throw new Error(usage);
    return Number(value);
  };
  const target = { playerId: id("--player-id"), teamId: id("--team-id") };
  const inputPath = options.get("--input")!;
  const stat = statSync(inputPath);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error("Input must be a local regular file of at most 32 MiB");
  const bytes = readFileSync(inputPath);
  const result = auditRetainedPlayerPpEvidence(bytes, options.get("--input-sha256")!, target);
  if (hash(readFileSync(inputPath)) !== result.inputBinding.actualHash) throw new Error("Input changed during audit");
  return result;
}

if (require.main === module) {
  try {
    const result = runRetainedPlayerPpAudit(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (result.issues.length || result.sources.some(source => source.issues.length || source.goalEvents.some(goal => goal.attribution === "unresolved"))) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
