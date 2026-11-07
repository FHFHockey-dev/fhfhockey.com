/** Pure qualification of captured inputs. No loader, scorer, fit, detector or clock. */
export const CURRENT_INPUT_VERSION = "fhfh.blsh.current-input-qualification.v1";
export const CURRENT_INPUT_SEASON = 20262027;
export const PRODUCTION_INPUTS = {
  fantasyPoints: ["goals", "assists", "pp_points", "shots", "hits", "blocked_shots"],
  rawPoints: ["goals", "assists"],
  wigoGameScore: [
    "goals", "total_primary_assists", "total_secondary_assists", "shots", "blocked_shots",
    "penalties_drawn", "penalties", "total_fow", "total_fol", "sat_for", "sat_against",
    "es_goals_for", "pp_goals_for", "sh_goals_for", "es_goals_against", "pp_goals_against", "sh_goals_against",
  ],
} as const;
type CountField = (typeof PRODUCTION_INPUTS)[keyof typeof PRODUCTION_INPUTS][number] | "points";
type SourceName = "public.games" | "public.wgo_skater_stats" | "public.nst_gamelog_as_counts" | "public.nst_gamelog_as_counts_oi";
export type Capture = {
  source: SourceName; sha256: string; retrievedAtUTC: string;
  sourceAvailableThroughUTC: string | null; revisionId: string | null;
};
type Feed<T> = { capture: Capture; rows: T[] };
export type CalendarInput = { id: number; seasonId: number; date: string; type: number | null };
export type WgoInput = {
  id: number; player_id: number; game_id: number | null; season_id: number; date: string;
  player_name?: string | null; team_abbrev?: string | null; position_code?: string | null;
  games_played: number | null; toi_per_game: number | null;
  es_toi_per_game: number | null; pp_toi_per_game: number | null;
  counts: Partial<Record<CountField, number | null>>;
};
type ProcessIdentity = { id: number; player_id: number; season: number; date_scraped: string; gp: number | null; toi: number | null };
export type IndividualInput = ProcessIdentity & { ixg: number | null; goals: number | null; shots: number | null };
export type OnIceInput = ProcessIdentity & { xgf: number | null; xga: number | null };
type ProcessFeed<T> = Feed<T> & {
  strengthScope: "all_strength" | "unknown";
  dateMeaning: "game_date" | "unknown";
  toiUnit: "seconds" | "unknown";
};
export type CurrentInputRequest = {
  seasonId: typeof CURRENT_INPUT_SEASON; eventThroughDate: string; asOfUTC: string;
  freshnessPolicy: { id: string; maxEventAgeDays: number; maxCaptureAgeHours: number };
  calendar: Feed<CalendarInput> | null; wgo: Feed<WgoInput> | null;
  individual: ProcessFeed<IndividualInput> | null; onIce: ProcessFeed<OnIceInput> | null;
};
type Check = { qualified: boolean; reasons: string[] };
const check = (reasons: string[]): Check => ({ qualified: reasons.length === 0, reasons: [...new Set(reasons)].sort() });
const positiveId = (v: number | null): v is number => Number.isSafeInteger(v) && v! > 0;
const nonnegative = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const day = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const timestamp = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && day(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
const key = (r: { player_id: number; date?: string; date_scraped?: string }) => `${r.player_id}|${r.date ?? r.date_scraped}`;
function group<T>(rows: T[], identify: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) { const k = identify(row); map.set(k, [...(map.get(k) ?? []), row]); }
  return map;
}

export const CURRENT_RESEARCH_INPUT_VERSION = "fhfh.blsh.current-research-inputs.v1";
export const RESEARCH_GOAL_FIELDS = [
  "es_goals_for", "pp_goals_for", "sh_goals_for",
  "es_goals_against", "pp_goals_against", "sh_goals_against",
] as const;
type GoalField = (typeof RESEARCH_GOAL_FIELDS)[number];
type GameScoreField = (typeof PRODUCTION_INPUTS.wigoGameScore)[number];
export type ResearchGoalPatch = {
  sourceId: number; playerId: number; gameId: number; seasonId: number; date: string;
  playerName: string; teamAbbrev: string;
  frozenCounts: Record<GameScoreField, number | null>;
  values: Record<GoalField, number>;
  sourceProjectionSHA256: string;
  proof: {
    method: "explicit_current_official_report_counts" | "complete_final_official_census_consistent_with_official_inputs";
    finality: "final"; attribution: "qualified"; availableAtUTC: string;
    receipts: { url: string; sha256: string; retrievedAtUTC: string }[];
  };
};
/** The file boundary must verify artifact bytes against these declared hashes.
 * This pure function qualifies supplied values; it does not authenticate files.
 */
export type ResearchGoalBundle = {
  version: "fhfh.blsh.verified-goal-overlay.v1";
  manifestSHA256: string; artifactSHA256: string;
  patches: ResearchGoalPatch[];
};
type OverlayDecision = {
  sourceId: number; state: "not_supplied" | "applied_to_research_copy" | "already_satisfied" | "withheld";
  reasons: string[]; evidenceAvailableAtUTC: string | null; oldestEvidenceAgeHours: number | null;
  sourceProjectionSHA256: string | null;
};
const sha256 = (v: string) => /^[a-f0-9]{64}$/.test(v);
const wholeCount = (v: unknown): v is number => nonnegative(v) && Number.isSafeInteger(v);

function proofReasons(patch: ResearchGoalPatch, request: CurrentInputRequest): string[] {
  const reasons: string[] = [];
  if (!sha256(patch.sourceProjectionSHA256)) reasons.push("invalid_projection_provenance");
  if (!day(patch.date) || patch.date > request.eventThroughDate) reasons.push("overlay_outside_event_cutoff");
  if (patch.proof.finality !== "final" || patch.proof.attribution !== "qualified") reasons.push("official_attribution_unqualified");
  const method = patch.proof.method;
  if (method !== "explicit_current_official_report_counts" && method !== "complete_final_official_census_consistent_with_official_inputs") reasons.push("unqualified_evidence_method");
  const expectedBox = `https://api-web.nhle.com/v1/gamecenter/${patch.gameId}/boxscore`;
  const expectedPbp = `https://www.nhl.com/scores/htmlreports/20262027/PL${String(patch.gameId % 1000000).padStart(6, "0")}.HTM`;
  const sources = new Set<string>();
  const receipts = patch.proof.receipts;
  if (receipts.length < 2 || receipts.length > 3) reasons.push("incomplete_official_receipts");
  for (const receipt of receipts) {
    if (!sha256(receipt.sha256) || !timestamp(receipt.retrievedAtUTC)) reasons.push("invalid_receipt_provenance");
    if (Date.parse(receipt.retrievedAtUTC) > Date.parse(request.asOfUTC)) reasons.push("evidence_after_as_of");
    let kind: string | null = null;
    try {
      const url = new URL(receipt.url);
      if (receipt.url === expectedBox) kind = "box";
      else if (receipt.url === expectedPbp) kind = "pbp";
      else if (url.origin === "https://api.nhle.com" && url.pathname === "/stats/rest/en/skater/goalsForAgainst" &&
        url.searchParams.get("isAggregate") === "false" && url.searchParams.get("isGame") === "true" &&
        url.searchParams.get("cayenneExp")?.replace(/\s+/g, " ").trim() === `gameId=${patch.gameId} and gameTypeId=2`) kind = "report";
    } catch { /* An invalid URL remains unqualified. */ }
    if (!kind || sources.has(kind)) reasons.push("unqualified_or_duplicate_official_receipt");
    if (kind) sources.add(kind);
  }
  if (!sources.has("report") || !sources.has("box") || method === "complete_final_official_census_consistent_with_official_inputs" && !sources.has("pbp")) reasons.push("incomplete_official_receipts");
  if (!timestamp(patch.proof.availableAtUTC) || Date.parse(patch.proof.availableAtUTC) !== Math.max(...receipts.map(r => Date.parse(r.retrievedAtUTC)))) reasons.push("evidence_availability_mismatch");
  if (Date.parse(patch.proof.availableAtUTC) > Date.parse(request.asOfUTC)) reasons.push("evidence_after_as_of");
  const keys = Object.keys(patch.values).sort();
  if (keys.length !== RESEARCH_GOAL_FIELDS.length || !RESEARCH_GOAL_FIELDS.every(f => keys.includes(f) && wholeCount(patch.values[f]))) reasons.push("invalid_goal_values_or_field_scope");
  if (!PRODUCTION_INPUTS.wigoGameScore.every(f => RESEARCH_GOAL_FIELDS.includes(f as GoalField) ? patch.frozenCounts[f] === null : wholeCount(patch.frozenCounts[f]))) reasons.push("invalid_frozen_goal_projection");
  return [...new Set(reasons)].sort();
}

/** Explicit research composition. Never mutates raw records or repairs a table.
 * Missing/late/ambiguous/drifted evidence does not supply a numeric value.
 * Qualification remains distinct from reference release, scoring and adoption.
 */
export function qualifyCurrentResearchInputs(request: CurrentInputRequest, bundle: ResearchGoalBundle | null) {
  const raw = qualifyCurrentInputs(request);
  if (bundle && (bundle.version !== "fhfh.blsh.verified-goal-overlay.v1" || !sha256(bundle.manifestSHA256) || !sha256(bundle.artifactSHA256) || bundle.patches.length > 2000)) throw new Error("Invalid bounded research overlay bundle");
  const patches = new Map<number, ResearchGoalPatch>();
  for (const patch of bundle?.patches ?? []) {
    if (patch.seasonId !== CURRENT_INPUT_SEASON) throw new Error("Unexpected overlay season; reserved/reference data is not admitted");
    if (!positiveId(patch.sourceId) || !positiveId(patch.playerId) || !positiveId(patch.gameId) || patches.has(patch.sourceId)) throw new Error("Invalid/duplicate overlay identity");
    patches.set(patch.sourceId, patch);
  }
  const decisions = new Map<number, OverlayDecision>();
  const effectiveRows = raw.records.map(original => {
    const row = original.record, patch = patches.get(row.id);
    const decision: OverlayDecision = { sourceId: row.id, state: "not_supplied", reasons: [], evidenceAvailableAtUTC: null, oldestEvidenceAgeHours: null, sourceProjectionSHA256: null };
    const copy = { ...row, counts: { ...row.counts } };
    if (patch) {
      decision.state = "withheld";
      decision.reasons = proofReasons(patch, request);
      decision.evidenceAvailableAtUTC = patch.proof.availableAtUTC;
      decision.sourceProjectionSHA256 = patch.sourceProjectionSHA256;
      if (patch.proof.receipts.every(r => timestamp(r.retrievedAtUTC)) && patch.proof.receipts.length) decision.oldestEvidenceAgeHours = (Date.parse(request.asOfUTC) - Math.min(...patch.proof.receipts.map(r => Date.parse(r.retrievedAtUTC)))) / 3600000;
      if (patch.playerId !== row.player_id || patch.gameId !== row.game_id || patch.date !== row.date || patch.playerName !== row.player_name || patch.teamAbbrev !== row.team_abbrev) decision.reasons.push("overlay_source_identity_or_context_drift");
      if (!original.identityAndExposure.qualified) decision.reasons.push("raw_identity_or_exposure_unqualified");
      const beforeMatches = PRODUCTION_INPUTS.wigoGameScore.every(f => row.counts[f] === patch.frozenCounts[f]);
      const afterMatches = PRODUCTION_INPUTS.wigoGameScore.every(f => row.counts[f] === (RESEARCH_GOAL_FIELDS.includes(f as GoalField) ? patch.values[f as GoalField] : patch.frozenCounts[f]));
      if (!beforeMatches && !afterMatches) decision.reasons.push("overlay_projection_drift_including_healthy_fields");
      decision.reasons = [...new Set(decision.reasons)].sort();
      if (!decision.reasons.length) {
        decision.state = afterMatches ? "already_satisfied" : "applied_to_research_copy";
        if (!afterMatches) for (const field of RESEARCH_GOAL_FIELDS) copy.counts[field] = patch.values[field];
      }
    }
    decisions.set(row.id, decision);
    return copy;
  });
  const effective = qualifyCurrentInputs({ ...request, wgo: request.wgo ? { capture: request.wgo.capture, rows: effectiveRows } : null });
  const cutoffAgeDays = (Date.parse(new Date(request.asOfUTC).toISOString().slice(0, 10)) - Date.parse(request.eventThroughDate)) / 86400000;
  const records = raw.records.map((original, i) => {
    const overlay = decisions.get(original.record.id)!;
    const current = effective.records[i];
    const usesOverlay = overlay.state === "applied_to_research_copy";
    const age = current.freshness.captureAgeHours;
    const researchCaptureAgeHours = usesOverlay && age !== null && overlay.oldestEvidenceAgeHours !== null ? Math.max(age, overlay.oldestEvidenceAgeHours) : age;
    const state = current.freshness.state === "unknown" ? "unknown" : current.freshness.state === "stale" || cutoffAgeDays > request.freshnessPolicy.maxEventAgeDays || usesOverlay && researchCaptureAgeHours !== null && researchCaptureAgeHours > request.freshnessPolicy.maxCaptureAgeHours ? "stale" : "fresh";
    return { raw: original, research: current, overlay, freshness: { state, cutoffAgeDays, researchCaptureAgeHours } };
  });
  const usedIds = new Set(raw.records.map(r => r.record.id));
  return {
    version: CURRENT_RESEARCH_INPUT_VERSION, seasonId: request.seasonId, eventThroughDate: request.eventThroughDate, asOfUTC: request.asOfUTC,
    composition: "raw_captures_plus_explicit_research_overlay", sourceCaptures: raw.sourceCaptures,
    overlayProvenance: bundle ? { manifestSHA256: bundle.manifestSHA256, artifactSHA256: bundle.artifactSHA256, verificationBoundary: "caller_must_verify_file_bytes" } : null,
    records, unmatchedOverlaySourceIds: [...patches.keys()].filter(id => !usedIds.has(id)).sort((a, b) => a - b),
    unmatchedProcess: raw.unmatched,
    coverage: { records: records.length, rawProductionComplete: raw.coverage.productionComplete, researchProductionComplete: effective.coverage.productionComplete, appliedResearchRows: records.filter(r => r.overlay.state === "applied_to_research_copy").length, alreadySatisfied: records.filter(r => r.overlay.state === "already_satisfied").length, withheldOverlayRows: records.filter(r => r.overlay.state === "withheld").length, fresh: records.filter(r => r.freshness.state === "fresh").length },
    blockers: raw.blockers, score: null, streak: null, trusted: false, productionAdopted: false, canonicalRepairs: 0,
  };
}
function captureReasons(feed: { capture: Capture } | null, request: CurrentInputRequest) {
  if (!feed) return ["source_unavailable"];
  // Retrieval proves presence by capture time; it does not establish original publication.
  return Date.parse(feed.capture.retrievedAtUTC) > Date.parse(request.asOfUTC) ? ["capture_after_as_of"] : [];
}
function validateRequest(r: CurrentInputRequest) {
  if (r.seasonId !== CURRENT_INPUT_SEASON || !day(r.eventThroughDate) || r.eventThroughDate < "2026-07-01" || r.eventThroughDate >= "2027-07-01" || !timestamp(r.asOfUTC) || r.eventThroughDate > new Date(r.asOfUTC).toISOString().slice(0, 10)) throw new Error("Invalid current-season/as-of scope");
  const p = r.freshnessPolicy;
  if (!p.id.trim() || !Number.isInteger(p.maxEventAgeDays) || p.maxEventAgeDays < 0 || !Number.isFinite(p.maxCaptureAgeHours) || p.maxCaptureAgeHours < 0) throw new Error("Explicit finite freshness policy required");
  for (const [name, feed] of Object.entries({ calendar: r.calendar, wgo: r.wgo, individual: r.individual, onIce: r.onIce })) {
    if (!feed) continue;
    const expected = { calendar: "public.games", wgo: "public.wgo_skater_stats", individual: "public.nst_gamelog_as_counts", onIce: "public.nst_gamelog_as_counts_oi" }[name];
    const c = feed.capture;
    if (c.source !== expected || !/^[a-f0-9]{64}$/.test(c.sha256) || !timestamp(c.retrievedAtUTC) || c.sourceAvailableThroughUTC !== null && (!timestamp(c.sourceAvailableThroughUTC) || Date.parse(c.sourceAvailableThroughUTC) > Date.parse(c.retrievedAtUTC))) throw new Error("Invalid source/capture provenance");
    if (feed.rows.length > 100000) throw new Error("Current input row bound exceeded");
    const ids = new Set<number>();
    for (const row of feed.rows) {
      const season = "seasonId" in row ? row.seasonId : "season_id" in row ? row.season_id : row.season;
      if (season !== CURRENT_INPUT_SEASON) throw new Error("Unexpected season; do not consume reserved/reference data");
      if (!positiveId(row.id) || ids.has(row.id)) throw new Error("Invalid/duplicate source record ID");
      ids.add(row.id);
    }
  }
}
function processCheck<T extends ProcessIdentity>(feed: ProcessFeed<T> | null, rows: T[], wgo: WgoInput, base: string[], required: (keyof T)[], request: CurrentInputRequest) {
  const reasons = [...base, ...captureReasons(feed, request)];
  if (rows.length !== 1) reasons.push(rows.length ? "ambiguous_player_date_match" : "no_matching_process_record");
  if (feed?.strengthScope !== "all_strength") reasons.push("unqualified_strength_scope");
  if (feed?.dateMeaning !== "game_date") reasons.push("unqualified_date_meaning");
  if (feed?.toiUnit !== "seconds") reasons.push("unqualified_exposure_unit");
  const row = rows.length === 1 ? rows[0] : null;
  if (row) {
    if (row.gp !== 1) reasons.push("process_participation_unqualified");
    if (!nonnegative(row.toi) || row.toi === 0) reasons.push("process_exposure_unavailable");
    else if (row.toi !== wgo.toi_per_game) reasons.push("process_WGO_exposure_mismatch");
    for (const field of required) if (!nonnegative(row[field])) reasons.push(`missing_or_invalid_${String(field)}`);
  }
  return { ...check(reasons), sourceIds: rows.map(r => r.id).sort((a, b) => a - b) };
}

/** Does not authorize a feed or make a score: qualified means these captured inputs pass the stated checks. */
export function qualifyCurrentInputs(request: CurrentInputRequest) {
  validateRequest(request);
  const { calendar, wgo, individual, onIce } = request;
  const games = group(calendar?.rows ?? [], r => String(r.id));
  const wgoRows = wgo?.rows ?? [];
  const identities = group(wgoRows, key);
  const individualRows = group(individual?.rows ?? [], key);
  const onIceRows = group(onIce?.rows ?? [], key);
  const usedIndividual = new Set<number>(), usedOnIce = new Set<number>();
  const records = [...wgoRows].sort((a, b) => a.player_id - b.player_id || a.date.localeCompare(b.date) || a.id - b.id).map(row => {
    const reasons = [...captureReasons(wgo, request), ...captureReasons(calendar, request)];
    if (!positiveId(row.player_id) || !positiveId(row.game_id)) reasons.push("unqualified_player_game_identity");
    if (!day(row.date) || row.date < "2026-07-01" || row.date >= "2027-07-01" || row.date > request.eventThroughDate) reasons.push("invalid_or_post_cutoff_game_date");
    if (identities.get(key(row))!.length !== 1) reasons.push("ambiguous_WGO_player_date");
    const calendarRows = games.get(String(row.game_id)) ?? [];
    const game = calendarRows.length === 1 ? calendarRows[0] : null;
    if (!game || game.type !== 2 || game.date !== row.date || Math.floor(game.id / 1000000) !== 2026 || Math.floor(game.id / 10000) % 100 !== 2) reasons.push("no_exact_regular_season_calendar_match");
    if (row.games_played !== 1) reasons.push(row.games_played === 0 ? "confirmed_nonappearance" : "unknown_participation");
    if (!nonnegative(row.toi_per_game) || row.toi_per_game === 0) reasons.push("missing_or_nonpositive_total_TOI");
    const base = check(reasons);
    const tracks = Object.fromEntries(Object.entries(PRODUCTION_INPUTS).map(([track, fields]) => {
      const trackReasons = [...base.reasons];
      for (const field of fields) if (!nonnegative(row.counts[field])) trackReasons.push(`missing_or_invalid_${field}`);
      if (track === "rawPoints" && row.counts.points != null && (!nonnegative(row.counts.points) || row.counts.goals! + row.counts.assists! !== row.counts.points)) trackReasons.push("inconsistent_points_primitive");
      return [track, check(trackReasons)];
    })) as Record<keyof typeof PRODUCTION_INPUTS, Check>;
    const ixg = [...(individualRows.get(key(row)) ?? [])].sort((a, b) => a.id - b.id), oi = [...(onIceRows.get(key(row)) ?? [])].sort((a, b) => a.id - b.id);
    ixg.forEach(r => usedIndividual.add(r.id)); oi.forEach(r => usedOnIce.add(r.id));
    const individualCheck = processCheck(individual, ixg, row, base.reasons, ["ixg"], request);
    const onIceCheck = processCheck(onIce, oi, row, base.reasons, ["xgf", "xga"], request);
    const eventAgeDays = day(row.date) ? (Date.parse(request.eventThroughDate) - Date.parse(row.date)) / 86400000 : null;
    const captures = [calendar, wgo, individual, onIce];
    const captureAgeHours = captures.every(Boolean) ? Math.max(...captures.map(f => (Date.parse(request.asOfUTC) - Date.parse(f!.capture.retrievedAtUTC)) / 3600000)) : null;
    const freshness = eventAgeDays === null || eventAgeDays < 0 || captureAgeHours === null || captures.some(f => captureReasons(f, request).length) ? "unknown" : eventAgeDays > request.freshnessPolicy.maxEventAgeDays || captureAgeHours > request.freshnessPolicy.maxCaptureAgeHours ? "stale" : "fresh";
    return {
      record: { ...row, counts: { ...row.counts } }, identityAndExposure: base, tracks,
      productionInputsComplete: Object.values(tracks).every(t => t.qualified),
      individual: { ...individualCheck, observed: ixg.map(r => ({ ...r })),
        countingDiscrepancies: ixg.map(r => ({ sourceId: r.id, goals: r.goals == null || row.counts.goals == null ? null : r.goals !== row.counts.goals, shots: r.shots == null || row.counts.shots == null ? null : r.shots !== row.counts.shots })) },
      onIce: { ...onIceCheck, observed: oi.map(r => ({ ...r })) },
      freshness: { state: freshness, eventAgeDays, captureAgeHours },
    };
  });
  const orphan = <T extends ProcessIdentity>(feed: Feed<T> | null, used: Set<number>) => (feed?.rows ?? []).filter(r => !used.has(r.id)).map(r => ({ ...r })).sort((a, b) => a.id - b.id);
  return {
    version: CURRENT_INPUT_VERSION, seasonId: request.seasonId, eventThroughDate: request.eventThroughDate, asOfUTC: request.asOfUTC,
    freshnessPolicy: { ...request.freshnessPolicy },
    populationScope: "captured_WGO_records_only", asOfKind: "presence_proven_by_capture_not_original_publication",
    sourceCaptures: { calendar: calendar ? { ...calendar.capture } : null, wgo: wgo ? { ...wgo.capture } : null, individual: individual ? { ...individual.capture } : null, onIce: onIce ? { ...onIce.capture } : null },
    sourceAvailability: { calendar: captureReasons(calendar, request), wgo: captureReasons(wgo, request), individual: captureReasons(individual, request), onIce: captureReasons(onIce, request) },
    records, unmatched: { individual: orphan(individual, usedIndividual), onIce: orphan(onIce, usedOnIce) },
    coverage: { records: records.length, productionComplete: records.filter(r => r.productionInputsComplete).length, individualQualified: records.filter(r => r.individual.qualified).length, onIceQualified: records.filter(r => r.onIce.qualified).length, fresh: records.filter(r => r.freshness.state === "fresh").length },
    score: null, streak: null, trusted: false, productionAdopted: false,
    blockers: ["operational_reference_not_released", "game_finality_not_established", "current_feed_not_live_qualified", "detector_policy_not_adopted"],
  };
}
