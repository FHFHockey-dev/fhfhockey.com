/** Server-only, offline. Original acquisitions pass the unchanged v1 current-use gate
 * at their own pinned clocks. An independently reviewed census and correction check
 * bind those same observations at a later, explicit cutoff. No policy is installed. */
import { createHash } from "node:crypto";
import { isDeepStrictEqual, types } from "node:util";
import { CURRENT_INPUT_SEASON, PRODUCTION_INPUTS, qualifyCurrentResearchInputs, type CurrentInputRequest, type WgoInput } from "./currentInput";
import { PRODUCTION_REFERENCE_VERSION } from "./productionReference";
import { CLOSED_PROCESS_EVIDENCE_POLICY, createCurrentProcessEvidenceGate, processEvidenceRowSHA256, type ProcessEvidencePolicy } from "./currentProcessEvidence.server";

const SEASON = CURRENT_INPUT_SEASON;
const GROUPS = ["individual", "onIce"] as const;
const DAY = 86_400_000_000; // microseconds
const MIB = 1024 * 1024;
export const REVIEWED_FIVE_GAME_VERSION = "fhfh.blsh.reviewed-five-game-window.v1";
export type ReviewedFiveGameWindowInput = {
  /** Supplied by the server from its selected player and event cutoff. */
  target: { playerId: number; eventThroughDate: string };
  manifestBytes: Uint8Array;
  artifacts: ReadonlyMap<string, Uint8Array>;
};
export type ReviewedFiveGameWindowPolicy = {
  process: ProcessEvidencePolicy;
  /** Separate from NST cell review. Covers the official FHFH operands and WGO model primitives. */
  /** Independent authority for current source revisions. A window review cannot register itself. */
  inventories: readonly { playerId: number; eventThroughDate: string; authorityId: string; inventorySHA256: string }[];
  originalQualifications: readonly { playerId: number; gameId: number; receiptSHA256: string; evaluatedAtUTC: string }[];
  productionReviews: readonly { playerId: number; gameId: number; reviewSHA256: string }[];
  /** Active vintages only. Replacement/revocation removes prior authority even inside 24 hours. */
  windows: readonly { playerId: number; eventThroughDate: string; manifestSHA256: string; censusSHA256: string; revisionSHA256: string }[];
};
export const CLOSED_FIVE_GAME_POLICY: ReviewedFiveGameWindowPolicy = Object.freeze({ process: CLOSED_PROCESS_EVIDENCE_POLICY, inventories: Object.freeze([]), originalQualifications: Object.freeze([]), productionReviews: Object.freeze([]), windows: Object.freeze([]) });

type Member = { gameId: number; sourceId: number; requestSHA256: string; bundleSHA256: string; officialBoxSHA256: string; productionReviewSHA256: string; qualificationReceiptSHA256: string };
type Manifest = { version: string; playerId: number; seasonId: number; eventThroughDate: string; asOfUTC: string; builtAtUTC: string;
  scorerVersion: string; mapperVersion: string; censusSHA256: string; revisionSHA256: string; referencePacketSHA256: string; members: Member[] };
type Census = { version: string; playerId: number; seasonId: number; throughUTC: string; observedAtUTC: string;
  gameLogURL: string; gameLogSHA256: string; landingURL: string; landingSHA256: string };
type Appearance = { gameId: number; gameDate: string; teamAbbrev: string; toi: string; goals?: number; assists?: number; points?: number; shots?: number; powerPlayPoints?: number; powerPlayGoals?: number };
type Revision = { version: string; playerId: number; seasonId: number; throughUTC: string; checkedAtUTC: string; status: string;
  referencePacketSHA256: string; censusSHA256: string; inventorySHA256: string; members: unknown[] };
type Witness = { group: string; wgoSourceId: number; officialFrameSHA256: string; nativeBodySHA256: string; nativeReceiptSHA256: string };
type Current = ReturnType<typeof qualifyCurrentResearchInputs>["records"];
class Hold extends Error {}
function need(condition: unknown, code: string): asserts condition { if (!condition) throw new Hold(code); }
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const validHash = (value: unknown) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
function time(v: string) {
  const match = typeof v === "string" && /^(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(v);
  need(match && date(match[1]) && match[6] !== "-00:00" && !/^[+-]14:(?!00)/.test(match[6]), "invalid_window_timestamp");
  const micros = Date.parse(v) * 1000 + Number((match[5] ?? "").padEnd(6, "0").slice(3));
  need(Number.isSafeInteger(micros), "invalid_window_timestamp");
  return micros;
}
function decode<T>(bytes: Uint8Array): T {
  const text = new TextDecoder("utf8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const value = JSON.parse(text);
  const stack: (Set<string> | null)[] = [];
  for (const [token] of text.matchAll(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|[{}\[\]]/g)) {
    if (token === "{" || token === "[") stack.push(token === "{" ? new Set() : null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token.endsWith(":")) {
      const key = JSON.parse(token.slice(0, -1)), keys = stack[stack.length - 1];
      need(keys && !keys.has(key), "ambiguous_json_member"); keys.add(key);
    }
  }
  return value as T;
}
export { time as reviewedEvidenceTime, decode as decodeReviewedEvidenceJSON };

type Get = (sha: string, maxBytes: number) => Uint8Array;
function officialAppearances(m: Manifest, census: Census, get: Get) {
  const endpoint = `https://api-web.nhle.com/v1/player/${m.playerId}`;
  need(census.version === "fhfh.blsh.official-appearance-census.v1" && census.playerId === m.playerId && census.seasonId === SEASON
    && census.throughUTC === m.asOfUTC && census.gameLogURL === endpoint + `/game-log/${SEASON}/2` && census.landingURL === endpoint + "/landing",
    "official_census_scope");
  const log = decode<{ seasonId: number; gameTypeId: number; gameLog: Appearance[] }>(get(census.gameLogSHA256, 2 * MIB));
  const landing = decode<{ playerId: number; seasonTotals: { season: number; leagueAbbrev: string; gameTypeId: number; gamesPlayed: number }[] }>(get(census.landingSHA256, 2 * MIB));
  const totals = landing.seasonTotals.filter(r => r.season === SEASON && r.leagueAbbrev === "NHL" && r.gameTypeId === 2);
  need(landing.playerId === m.playerId && totals.length === 1 && log.seasonId === SEASON && log.gameTypeId === 2 && Array.isArray(log.gameLog)
    && log.gameLog.length >= 5 && log.gameLog.length <= 100 && totals[0].gamesPlayed === log.gameLog.length, "official_census_incomplete");
  const ids = new Set<number>(), dates = new Set<string>();
  for (const a of log.gameLog) {
    need(Number.isSafeInteger(a.gameId) && /^202602\d{4}$/.test(String(a.gameId)) && !ids.has(a.gameId)
      && date(a.gameDate) && a.gameDate >= "2026-07-01" && a.gameDate <= m.eventThroughDate && !dates.has(a.gameDate)
      && /^[A-Z]{2,3}$/.test(a.teamAbbrev) && /^\d{1,3}:[0-5]\d$/.test(a.toi) && toiSeconds(a.toi) > 0, "official_appearance_or_cutoff_changed");
    ids.add(a.gameId); dates.add(a.gameDate);
  }
  return log.gameLog.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
}
const toiSeconds = (v: string) => Number(v.split(":")[0]) * 60 + Number(v.split(":")[1]);
function checkRawFeeds(request: CurrentInputRequest, originalEvaluation: number, get: Get, ids: Record<"wgo" | "calendar" | "individual" | "onIce", number>) {
  for (const key of ["wgo", "calendar", ...GROUPS] as const) {
    const feed = request[key];
    need(feed, "missing_raw_feed");
    const raw = decode<{ source: string; capturedAtUTC: string; snapshotUTC: string; records: { id: number }[] }>(get(feed.capture.sha256, 16 * MIB));
    need(raw.source === feed.capture.source && time(raw.capturedAtUTC) === time(feed.capture.retrievedAtUTC)
      && time(raw.snapshotUTC) <= time(raw.capturedAtUTC) && originalEvaluation - time(raw.snapshotUTC) <= DAY && Array.isArray(raw.records) && raw.records.length === feed.rows.length,
      "raw_feed_capture_binding");
    const rows = raw.records.filter(r => r.id === ids[key]), projected = feed.rows.find(r => r.id === ids[key]);
    need(rows.length === 1 && projected, "raw_feed_selected_identity");
    let expected: object = projected;
    if (key === "wgo" && "counts" in projected) {
      const { counts, ...context } = projected;
      need(Object.keys(counts).every(k => !Object.hasOwn(context, k)), "raw_wgo_ambiguous_field");
      expected = { ...context, ...counts };
    }
    need(isDeepStrictEqual(rows[0], expected), "raw_feed_selected_projection_changed");
  }
}
function originalBox(get: Get, member: Member, appearance: Appearance, playerId: number) {
  type Player = { playerId: number; toi: string; goals: number; assists: number; sog: number; hits: number; blockedShots: number; powerPlayGoals: number };
  const box = decode<{ id: number; season: number; gameType: number; gameDate: string; gameState: string; gameScheduleState: string;
    homeTeam: { abbrev: string }; awayTeam: { abbrev: string };
    playerByGameStats: Record<"homeTeam" | "awayTeam", Record<"forwards" | "defense" | "goalies", Player[]>> }>(get(member.officialBoxSHA256, 2 * MIB));
  need(box.id === member.gameId && box.season === SEASON && box.gameType === 2 && box.gameDate === appearance.gameDate
    && ["OFF", "FINAL"].includes(box.gameState) && box.gameScheduleState === "OK" && box.homeTeam.abbrev !== box.awayTeam.abbrev, "official_final_box_mismatch");
  const players = (["homeTeam", "awayTeam"] as const).flatMap(side => (["forwards", "defense", "goalies"] as const).flatMap(group =>
    box.playerByGameStats[side][group].filter(row => row.playerId === playerId).map(row => ({ ...row, team: box[side].abbrev, group }))));
  need(players.length === 1 && players[0].group !== "goalies" && players[0].team === appearance.teamAbbrev && players[0].toi === appearance.toi, "official_box_appearance_mismatch");
  return players[0];
}

const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
type ProductionReview = {
  version: string; scope: string; playerId: number; gameId: number; date: string; sourceId: number; team: string;
  reviewedAtUTC: string; requestSHA256: string; wgoRowSHA256: string; officialBoxSHA256: string;
  wgoRevision: string; definitionSHA256: string; fields: Record<string, { state: string; method: string; official: number }>;
  summary?: { bodySHA256: string; url: string; observedAtUTC: string };
};
function checkProduction(get: Get, member: Member, row: WgoInput, box: ReturnType<typeof originalBox>,
  appearance: Appearance, policy: ReviewedFiveGameWindowPolicy, requestAt: string, originalEvaluation: number, frame: { completedByUTC: string; observedAtUTC: string }) {
  const pins = policy.productionReviews.filter(r => r.playerId === row.player_id && r.gameId === member.gameId);
  need(pins.length === 1 && pins[0].reviewSHA256 === member.productionReviewSHA256, "no_independent_production_review");
  const review = decode<ProductionReview>(get(member.productionReviewSHA256, 64 * 1024));
  need(review.version === "fhfh.blsh.row-production-review.v1" && review.scope === "official_fhfh_operands_and_exact_wgo_game_score_primitives"
    && review.sourceId === row.id && review.playerId === row.player_id && review.gameId === row.game_id && review.date === row.date
    && review.team === row.team_abbrev && review.requestSHA256 === member.requestSHA256 && review.officialBoxSHA256 === member.officialBoxSHA256
    && review.wgoRowSHA256 === processEvidenceRowSHA256(row) && time(review.reviewedAtUTC) >= time(requestAt)
    && time(review.reviewedAtUTC) >= time(frame.observedAtUTC) && time(review.reviewedAtUTC) <= originalEvaluation, "production_review_identity_or_clock");
  const official = { goals: box.goals, assists: box.assists, shots: box.sog, hits: box.hits, blocked_shots: box.blockedShots };
  for (const [field, value] of Object.entries(official)) {
    const witness = review.fields[field];
    need(count(value) && witness?.state === "matched" && witness.method === "official_box_field" && witness.official === value
      && value === row.counts[field as keyof typeof official], "official_production_operand_mismatch");
  }
  const { total_primary_assists: primary, total_secondary_assists: secondary, points } = row.counts;
  need(count(primary) && count(secondary) && primary + secondary === box.assists
    && (points == null || count(points) && points === box.goals + box.assists), "production_assist_or_points_partition");
  const ppp = review.fields.pp_points;
  need(ppp?.state === "matched" && count(ppp.official) && ppp.official === row.counts.pp_points && count(box.powerPlayGoals)
    && box.powerPlayGoals <= box.goals && box.powerPlayGoals <= ppp.official && ppp.official <= box.goals + box.assists, "official_ppp_unqualified");
  const currentOfficial = { goals: box.goals, assists: box.assists, points: box.goals + box.assists, shots: box.sog,
    powerPlayPoints: ppp.official, powerPlayGoals: box.powerPlayGoals };
  for (const key of Object.keys(currentOfficial) as (keyof typeof currentOfficial)[]) {
    need(!Object.hasOwn(appearance, key) || appearance[key] === currentOfficial[key], "current_official_log_production_changed");
  }
  if (ppp.method === "official_box_zero_assist_check") {
    need(box.assists === 0 && ppp.official === box.powerPlayGoals, "official_ppp_zero_assist_mismatch");
  } else {
    const proof = review.summary;
    need(proof && ["retained_direct_PPP_report", "official_later_exact_player_summary_PPP"].includes(ppp.method), "official_ppp_method_unqualified");
    const url = new URL(proof.url), q = url.searchParams;
    const scope = `gameId=${row.game_id} and gameTypeId=2`;
    const exactPlayer = q.get("cayenneExp") === scope + ` and playerId=${row.player_id}`;
    const limit = exactPlayer ? 2 : 100;
    const expected = { isAggregate: "false", isGame: "true", start: "0", limit: String(limit), sort: '[{"property":"playerId","direction":"ASC"}]',
      factCayenneExp: "gamesPlayed>=1", cayenneExp: exactPlayer ? scope + ` and playerId=${row.player_id}` : scope };
    need(url.origin === "https://api.nhle.com" && !url.username && !url.password && !url.hash && url.pathname === "/stats/rest/en/skater/summary"
      && [...q.keys()].length === Object.keys(expected).length && Object.entries(expected).every(([k, v]) => q.getAll(k).length === 1 && q.get(k) === v)
      && time(proof.observedAtUTC) >= time(frame.completedByUTC) && time(proof.observedAtUTC) <= time(review.reviewedAtUTC) && originalEvaluation - time(proof.observedAtUTC) <= DAY, "official_summary_scope_or_clock");
    const body = decode<{ total: number; data: Record<string, unknown>[] }>(get(proof.bodySHA256, 2 * MIB));
    need(Array.isArray(body.data) && body.total === body.data.length && body.total > 0 && body.total < limit && (!exactPlayer || body.total === 1)
      && new Set(body.data.map(r => r.playerId)).size === body.total && body.data.every(r => Number.isSafeInteger(r.playerId) && r.gameId === row.game_id
        && r.gameDate === row.date && r.gamesPlayed === 1), "official_summary_incomplete");
    const r = body.data.find(r => r.playerId === row.player_id);
    need(r && r.teamAbbrev === row.team_abbrev && r.timeOnIcePerGame === row.toi_per_game && r.goals === box.goals && r.assists === box.assists && r.shots === box.sog
      && r.points === box.goals + box.assists && r.ppPoints === ppp.official && r.ppGoals === box.powerPlayGoals
      && count(r.evPoints) && count(r.shPoints) && count(r.evGoals) && count(r.shGoals) && r.evGoals <= r.evPoints && r.shGoals <= r.shPoints
      && r.evPoints + ppp.official + r.shPoints === r.points && r.evGoals + box.powerPlayGoals + r.shGoals === box.goals, "official_summary_operand_mismatch");
  }
  // WGO Game Score is derived. Its independent review covers provider definitions and
  // the exact original WGO projections, and never calls it an official NHL statistic.
  const def = decode<{ version: string; source: string; revision: string; fields: string[]; track: string; scorerVersion: string }>(get(review.definitionSHA256, 64 * 1024));
  need(review.wgoRevision === "wgo_db_raw" && def.version === "fhfh.blsh.reviewed-production-definition.v1" && def.source === "public.wgo_skater_stats"
    && def.revision === review.wgoRevision && def.scorerVersion === PRODUCTION_REFERENCE_VERSION && def.track === "wigoGameScore" && isDeepStrictEqual(def.fields, PRODUCTION_INPUTS.wigoGameScore)
    && def.fields.every(k => count(row.counts[k as keyof WgoInput["counts"]])), "wgo_game_score_revision_or_definition_unknown");
}

const domains = ["wgo", "official", "individual", "onIce", "activeReviews", "reference"] as const;
type Domain = typeof domains[number];
type Inventory = { version: string; authorityId: string; playerId: number; seasonId: number; eventThroughDate: string;
  coverage: Record<Domain, { state: string; throughUTC: string; observedAtUTC: string }>;
  games: { gameId: number; wgo: WgoInput; official: { boxSHA256: string; seconds: number; team: string };
    native: { group: string; sourceId: number; rowSHA256: string; nativeBodySHA256: string }[];
    reviews: { productionReviewSHA256: string; processReviewSHA256: string; qualificationReceiptSHA256: string } }[];
  referencePacketSHA256: string };
function currentInventory(m: Manifest, revision: Revision, policy: ReviewedFiveGameWindowPolicy, get: Get) {
  const pins = policy.inventories.filter(p => p.playerId === m.playerId && p.eventThroughDate === m.eventThroughDate);
  need(pins.length === 1 && typeof pins[0].authorityId === "string" && Boolean(pins[0].authorityId.trim())
    && pins[0].inventorySHA256 === revision.inventorySHA256, "current_revision_inventory_not_independently_accepted");
  const inv = decode<Inventory>(get(pins[0].inventorySHA256, MIB));
  need(inv.version === "fhfh.blsh.authoritative-revision-inventory.v1" && inv.authorityId === pins[0].authorityId
    && inv.playerId === m.playerId && inv.eventThroughDate === m.eventThroughDate && inv.seasonId === SEASON
    && Array.isArray(inv.games) && inv.games.length === 5 && new Set(inv.games.map(g => g.gameId)).size === 5, "current_revision_inventory_scope");
  const cutoff = time(m.asOfUTC), checked = time(revision.checkedAtUTC);
  for (const domain of domains) {
    const source = inv.coverage?.[domain];
    need(source?.state === "complete_for_selected_player_and_games" && time(source.throughUTC) >= cutoff
      && time(source.throughUTC) <= time(source.observedAtUTC) && time(source.observedAtUTC) <= checked, "current_revision_source_coverage_unknown");
  }
  need(inv.referencePacketSHA256 === m.referencePacketSHA256, "current_reference_revision_changed");
  return inv.games;
}

/** Returns a diagnostic hold for malformed/missing/unaccepted evidence. The server's
 * read clock is separate from the packet's explicit evidence coverage and build time. */
export function verifyReviewedFiveGameWindow(input: ReviewedFiveGameWindowInput, evaluatedAtUTC: string,
  policy: ReviewedFiveGameWindowPolicy = CLOSED_FIVE_GAME_POLICY) {
  try {
    const active = policy.windows.filter(w => w.playerId === input.target.playerId);
    need(active.length === 1 && active[0].eventThroughDate === input.target.eventThroughDate, "no_unique_active_window_for_target");
    need(input.manifestBytes.byteLength > 0 && input.manifestBytes.byteLength <= 64 * 1024 && hash(input.manifestBytes) === active[0].manifestSHA256,
      "window_snapshot_changed_or_superseded");
    const m = decode<Manifest>(input.manifestBytes);
    need(m.version === REVIEWED_FIVE_GAME_VERSION && m.playerId === input.target.playerId && Number.isSafeInteger(m.playerId) && m.playerId > 0
      && m.seasonId === SEASON && date(m.eventThroughDate) && m.eventThroughDate === input.target.eventThroughDate
      && typeof m.scorerVersion === "string" && Boolean(m.scorerVersion.trim()) && typeof m.mapperVersion === "string" && Boolean(m.mapperVersion.trim())
      && m.censusSHA256 === active[0].censusSHA256 && m.revisionSHA256 === active[0].revisionSHA256 && Array.isArray(m.members) && m.members.length === 5,
      "window_manifest_scope");
    const get: Get = (sha, max) => {
      const bytes = input.artifacts.get(sha);
      need(validHash(sha) && bytes && types.isUint8Array(bytes) && bytes.length > 0 && bytes.length <= max && hash(bytes) === sha, "window_artifact_missing_or_changed");
      return bytes;
    };
    const census = decode<Census>(get(m.censusSHA256, 64 * 1024)), revision = decode<Revision>(get(m.revisionSHA256, 128 * 1024));
    const cutoff = time(m.asOfUTC), built = time(m.builtAtUTC), evaluated = time(evaluatedAtUTC);
    const observed = time(census.observedAtUTC), checked = time(revision.checkedAtUTC);
    need(time(m.eventThroughDate + "T00:00:00Z") <= cutoff && cutoff <= observed && observed <= checked && checked <= built && built <= evaluated
      && evaluated - cutoff <= DAY, "snapshot_or_recheck_stale_or_future");
    need(revision.version === "fhfh.blsh.reviewed-window-revisions.v1" && revision.status === "all_selected_sources_and_reference_rechecked"
      && revision.throughUTC === m.asOfUTC && revision.playerId === m.playerId && revision.seasonId === SEASON
      && revision.referencePacketSHA256 === m.referencePacketSHA256 && revision.censusSHA256 === m.censusSHA256
      && Array.isArray(revision.members) && revision.members.length === 5, "revision_or_reference_changed");
    get(m.referencePacketSHA256, 64 * MIB);
    const appearances = officialAppearances(m, census, get);
    const priorAppearances = appearances.slice(0, -5).map(({ gameId, gameDate, teamAbbrev, toi }) => ({ gameId, gameDate, teamAbbrev, toi })), selected = appearances.slice(-5);
    const readDay = new Date(Math.floor(evaluated / 1000)).toISOString().slice(0, 10);
    need(Date.parse(readDay) - Date.parse(selected[4].gameDate) <= 7 * 86400000, "latest_official_appearance_stale");
    const gate = createCurrentProcessEvidenceGate(policy.process), current: Current = [], members = [];
    const sourceIds = new Set<number>(), processIds = { individual: new Set<number>(), onIce: new Set<number>() };
    for (const [index, a] of selected.entries()) {
      const member = m.members[index];
      need(member.gameId === a.gameId && Number.isSafeInteger(member.sourceId) && member.sourceId > 0 && !sourceIds.has(member.sourceId), "latest_five_membership_changed");
      sourceIds.add(member.sourceId);
      const box = originalBox(get, member, a, m.playerId);
      const requestBytes = get(member.requestSHA256, 32 * MIB), bundleBytes = get(member.bundleSHA256, 8 * MIB);
      const req = decode<CurrentInputRequest>(requestBytes);
      need(req.freshnessPolicy.id === "blsh-capture-reader-v1-event7days-capture24hours" && req.freshnessPolicy.maxEventAgeDays <= 7 && req.freshnessPolicy.maxCaptureAgeHours <= 24 && time(req.asOfUTC) <= cutoff, "original_capture_clock_or_policy");
      const registrations = policy.originalQualifications.filter(p => p.playerId === m.playerId && p.gameId === member.gameId);
      need(registrations.length === 1 && registrations[0].receiptSHA256 === member.qualificationReceiptSHA256, "original_qualification_not_independently_recorded");
      const receipt = decode<{ version: string; evidenceClass: string; outcome: string; rule: string; gateVersion: string; playerId: number; gameId: number;
        sourceId: number; requestSHA256: string; bundleSHA256: string; productionReviewSHA256: string; processReviewSHA256: string; evaluatedAtUTC: string }>(
        get(member.qualificationReceiptSHA256, 64 * 1024));
      need(receipt.version === "fhfh.blsh.original-row-qualification.v1" && receipt.evidenceClass === "contemporaneous_gate_execution"
        && receipt.outcome === "qualified_both_native_groups_and_production" && receipt.rule === req.freshnessPolicy.id
        && receipt.gateVersion === "fhfh.blsh.current-process-provenance-gate.v1" && receipt.playerId === m.playerId && receipt.gameId === member.gameId
        && receipt.sourceId === member.sourceId && receipt.requestSHA256 === member.requestSHA256 && receipt.bundleSHA256 === member.bundleSHA256
        && receipt.productionReviewSHA256 === member.productionReviewSHA256 && receipt.evaluatedAtUTC === registrations[0].evaluatedAtUTC,
        "original_qualification_scope_or_identity");
      const originalEvaluation = time(receipt.evaluatedAtUTC);
      need(time(req.asOfUTC) <= originalEvaluation && originalEvaluation <= cutoff && originalEvaluation - time(req.asOfUTC) <= DAY, "original_qualification_clock");
      const acquired = gate(requestBytes, receipt.evaluatedAtUTC, bundleBytes, input.artifacts);
      const row = acquired.records.find(r => r.record.id === member.sourceId);
      need(row?.record.player_id === m.playerId && row.record.game_id === a.gameId && row.record.date === a.gameDate && row.record.team_abbrev === a.teamAbbrev
        && row.record.toi_per_game === toiSeconds(a.toi) && row.identityAndExposure.qualified && row.productionInputsComplete
        && row.individual.qualified && row.onIce.qualified, "original_game_evidence_unqualified");
      checkRawFeeds(req, originalEvaluation, get, { wgo: member.sourceId, calendar: member.gameId, individual: row.individual.observed[0].id, onIce: row.onIce.observed[0].id });
      need(receipt.processReviewSHA256 === row.individual.provenance.acceptedReviewSHA256 && receipt.processReviewSHA256 === row.onIce.provenance.acceptedReviewSHA256,
        "original_qualification_review_changed");
      const witnesses = decode<{ witnesses: Witness[] }>(bundleBytes).witnesses.filter(w => w.wgoSourceId === member.sourceId);
      need(witnesses.length === 2 && witnesses[0].officialFrameSHA256 === witnesses[1].officialFrameSHA256, "official_frame_disagrees_between_groups");
      const frameSHA256 = witnesses[0].officialFrameSHA256;
      const frame = decode<{ completedByUTC: string; observedAtUTC: string; provenance: { boxscoreSHA256: string } }>(get(frameSHA256, 64 * 1024));
      need(frame.provenance?.boxscoreSHA256 === member.officialBoxSHA256, "original_frame_box_binding");
      checkProduction(get, member, row.record, box, a, policy, req.asOfUTC, originalEvaluation, frame);
      const process = GROUPS.map(group => {
        const w = witnesses.find(entry => entry.group === group)!, proc = row[group].observed[0];
        need(!processIds[group].has(proc.id), "process_source_id_reused");
        processIds[group].add(proc.id);
        return { group, sourceId: proc.id, rowSHA256: processEvidenceRowSHA256(proc), nativeBodySHA256: w.nativeBodySHA256,
          nativeReceiptSHA256: w.nativeReceiptSHA256, reviewSHA256: row[group].provenance.acceptedReviewSHA256 };
      });
      const binding = { gameId: member.gameId, sourceId: member.sourceId, date: a.gameDate, team: a.teamAbbrev, acquisitionAtUTC: req.asOfUTC, originalEvaluationUTC: receipt.evaluatedAtUTC, qualificationReceiptSHA256: member.qualificationReceiptSHA256,
        requestSHA256: member.requestSHA256, bundleSHA256: member.bundleSHA256, officialBoxSHA256: member.officialBoxSHA256,
        officialFrameSHA256: frameSHA256, productionReviewSHA256: member.productionReviewSHA256, wgoRowSHA256: processEvidenceRowSHA256(row.record), process };
      need(isDeepStrictEqual(revision.members[index], binding), "selected_source_revision_or_review_changed");
      const original = qualifyCurrentResearchInputs(req, null).records.find(r => r.raw.record.id === member.sourceId)!;
      current.push({ ...original, research: row });
      members.push(binding);
    }
    const inventory = currentInventory(m, revision, policy, get);
    for (const [i, binding] of members.entries()) {
      const fresh = inventory.find(g => g.gameId === binding.gameId), row = current[i].research.record;
      need(fresh && fresh.wgo?.id === row.id && processEvidenceRowSHA256(fresh.wgo) === binding.wgoRowSHA256,
        "current_wgo_revision_changed");
      need(fresh.official?.boxSHA256 === binding.officialBoxSHA256 && fresh.official.seconds === row.toi_per_game && fresh.official.team === row.team_abbrev,
        "current_official_revision_changed");
      const native = binding.process.map(({ group, sourceId, rowSHA256, nativeBodySHA256 }) => ({ group, sourceId, rowSHA256, nativeBodySHA256 }));
      need(isDeepStrictEqual(fresh.native, native), "current_native_revision_changed");
      need(fresh.reviews?.productionReviewSHA256 === binding.productionReviewSHA256 && fresh.reviews.qualificationReceiptSHA256 === binding.qualificationReceiptSHA256
        && binding.process.every(p => p.reviewSHA256 === fresh.reviews.processReviewSHA256), "current_review_superseded_or_unknown");
    }
    return { qualified: true as const, version: REVIEWED_FIVE_GAME_VERSION, playerId: m.playerId, seasonId: SEASON, eventThroughDate: m.eventThroughDate,
      asOfUTC: m.asOfUTC, builtAtUTC: m.builtAtUTC, evaluatedAtUTC, manifestSHA256: active[0].manifestSHA256, referencePacketSHA256: m.referencePacketSHA256,
      scorerVersion: m.scorerVersion, mapperVersion: m.mapperVersion, inventorySHA256: revision.inventorySHA256, censusSHA256: m.censusSHA256, revisionSHA256: m.revisionSHA256, priorAppearances, current, members, reasons: [] as string[] };
  } catch (error) {
    return { qualified: false as const, version: REVIEWED_FIVE_GAME_VERSION, reasons: [error instanceof Hold ? error.message : "invalid_or_incomplete_retained_evidence"],
      current: [] as Current, members: [], score: null };
  }
}
