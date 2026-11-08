import { describe, expect, it } from "vitest";
import { CURRENT_INPUT_SEASON, PRODUCTION_INPUTS, RESEARCH_GOAL_FIELDS, qualifyCurrentInputs, qualifyCurrentResearchInputs, type Capture, type CurrentInputRequest, type WgoInput, type ResearchGoalBundle, type ResearchGoalPatch } from "./currentInput";

function fixture(): CurrentInputRequest {
  const capture = (source: Capture["source"]): Capture => ({ source, sha256: "a".repeat(64), retrievedAtUTC: "2026-10-27T12:00:00Z", sourceAvailableThroughUTC: null, revisionId: null });
  const counts: WgoInput["counts"] = {};
  for (const field of Object.values(PRODUCTION_INPUTS).flat()) counts[field] = 0;
  return {
    seasonId: CURRENT_INPUT_SEASON, eventThroughDate: "2026-10-26", asOfUTC: "2026-10-27T18:00:00Z",
    freshnessPolicy: { id: "synthetic-tests-only", maxEventAgeDays: 7, maxCaptureAgeHours: 24 },
    calendar: { capture: capture("public.games"), rows: [{ id: 2026020001, seasonId: CURRENT_INPUT_SEASON, date: "2026-10-25", type: 2 }] },
    wgo: { capture: capture("public.wgo_skater_stats"), rows: [{ id: 1, player_id: 8470001, game_id: 2026020001, season_id: CURRENT_INPUT_SEASON, date: "2026-10-25", games_played: 1, toi_per_game: 900, es_toi_per_game: 880, pp_toi_per_game: 20, counts }] },
    individual: { capture: capture("public.nst_gamelog_as_counts"), strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds", rows: [{ id: 2, player_id: 8470001, season: CURRENT_INPUT_SEASON, date_scraped: "2026-10-25", gp: 1, toi: 900, ixg: 0, goals: 0, shots: 0 }] },
    onIce: { capture: capture("public.nst_gamelog_as_counts_oi"), strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds", rows: [{ id: 3, player_id: 8470001, season: CURRENT_INPUT_SEASON, date_scraped: "2026-10-25", gp: 1, toi: 900, xgf: 0, xga: 0 }] },
  };
}
const record = (r: CurrentInputRequest) => qualifyCurrentInputs(r).records[0];

function overlayFixture() {
  const request = fixture();
  const row = request.wgo!.rows[0];
  row.player_name = "Synthetic skater"; row.team_abbrev = "TST";
  for (const field of RESEARCH_GOAL_FIELDS) row.counts[field] = null;
  const patch: ResearchGoalPatch = {
    sourceId: row.id, playerId: row.player_id, gameId: row.game_id!, seasonId: row.season_id,
    date: row.date, playerName: row.player_name, teamAbbrev: row.team_abbrev,
    frozenCounts: Object.fromEntries(PRODUCTION_INPUTS.wigoGameScore.map(f => [f, row.counts[f]])) as ResearchGoalPatch["frozenCounts"],
    values: Object.fromEntries(RESEARCH_GOAL_FIELDS.map(f => [f, 0])) as ResearchGoalPatch["values"],
    sourceProjectionSHA256: "b".repeat(64),
    proof: { method: "complete_final_official_census_consistent_with_official_inputs", finality: "final", attribution: "qualified", availableAtUTC: "2026-10-27T13:02:00Z", receipts: [
      { url: `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=false&isGame=true&cayenneExp=gameId%3D${row.game_id}+and+gameTypeId%3D2`, sha256: "c".repeat(64), retrievedAtUTC: "2026-10-27T13:00:00Z" },
      { url: `https://api-web.nhle.com/v1/gamecenter/${row.game_id}/boxscore`, sha256: "d".repeat(64), retrievedAtUTC: "2026-10-27T13:01:00Z" },
      { url: "https://www.nhl.com/scores/htmlreports/20262027/PL020001.HTM", sha256: "e".repeat(64), retrievedAtUTC: "2026-10-27T13:02:00Z" },
    ] },
  };
  const bundle: ResearchGoalBundle = { version: "fhfh.blsh.verified-goal-overlay.v1", manifestSHA256: "f".repeat(64), artifactSHA256: "a".repeat(64), patches: [patch] };
  return { request, bundle, patch };
}

describe("explicit current research goal-overlay admission", () => {
  it("qualifies a separate research copy while preserving raw nulls and provenance", () => {
    const { request, bundle } = overlayFixture(); const before = JSON.stringify(request);
    const out = qualifyCurrentResearchInputs(request, bundle), p = out.records[0];
    expect(p.raw.productionInputsComplete).toBe(false); expect(p.research.productionInputsComplete).toBe(true);
    expect(p.raw.record.counts.es_goals_for).toBeNull(); expect(p.research.record.counts.es_goals_for).toBe(0);
    expect(p.overlay.state).toBe("applied_to_research_copy"); expect(JSON.stringify(request)).toBe(before);
    expect(p.research.record.counts.shots).toBe(0); expect(p.research.individual.qualified).toBe(true);
    expect(out.overlayProvenance?.verificationBoundary).toBe("caller_must_verify_file_bytes");
    expect(out.sourceCaptures.wgo).toEqual(request.wgo!.capture);
    expect(out.canonicalRepairs).toBe(0); expect(out.score).toBeNull(); expect(out.trusted).toBe(false);
    expect(out.blockers).toContain("operational_reference_not_released");
  });
  it("keeps unsupplied evidence unavailable and reports orphan overlay IDs", () => {
    const { request, bundle, patch } = overlayFixture();
    expect(qualifyCurrentResearchInputs(request, null).records[0].research.productionInputsComplete).toBe(false);
    bundle.patches = [{ ...patch, sourceId: 99 }];
    const out = qualifyCurrentResearchInputs(request, bundle);
    expect(out.unmatchedOverlaySourceIds).toEqual([99]); expect(out.records[0].overlay.state).toBe("not_supplied");
    expect(out.records[0].research.record.counts.es_goals_for).toBeNull();
  });
  it("does not backdate research evidence to the event cutoff or an earlier capture", () => {
    const { request, bundle } = overlayFixture(); request.asOfUTC = "2026-10-27T12:30:00Z";
    const p = qualifyCurrentResearchInputs(request, bundle).records[0];
    expect(p.overlay.reasons).toContain("evidence_after_as_of"); expect(p.overlay.state).toBe("withheld");
    expect(p.research.record.counts.es_goals_for).toBeNull();
  });
  it("holds healthy-field, name and team drift even when source goals already equal proposed values", () => {
    for (const mutate of [
      (row: WgoInput) => { row.counts.shots = 1; },
      (row: WgoInput) => { row.player_name = "Different skater"; },
      (row: WgoInput) => { row.team_abbrev = "OTHER"; },
    ]) {
      const { request, bundle } = overlayFixture();
      for (const field of RESEARCH_GOAL_FIELDS) request.wgo!.rows[0].counts[field] = 0;
      mutate(request.wgo!.rows[0]);
      expect(qualifyCurrentResearchInputs(request, bundle).records[0].overlay.state).toBe("withheld");
    }
  });
  it("recognizes already satisfied values without attributing canonical repairs or changing raw data", () => {
    const { request, bundle } = overlayFixture();
    for (const field of RESEARCH_GOAL_FIELDS) request.wgo!.rows[0].counts[field] = 0;
    const out = qualifyCurrentResearchInputs(request, bundle);
    expect(out.records[0].overlay.state).toBe("already_satisfied");
    expect(out.coverage.appliedResearchRows).toBe(0); expect(out.coverage.alreadySatisfied).toBe(1);
  });
  it("holds partial or conflicting source goal values without overwriting them", () => {
    for (const value of [0, 1]) {
      const { request, bundle } = overlayFixture(); request.wgo!.rows[0].counts.es_goals_for = value;
      const p = qualifyCurrentResearchInputs(request, bundle).records[0];
      expect(p.overlay.reasons).toContain("overlay_projection_drift_including_healthy_fields");
      expect(p.research.record.counts.es_goals_for).toBe(value); expect(p.research.record.counts.pp_goals_for).toBeNull();
    }
  });
  it("withholds nonfinal, ambiguous, incomplete or mismatched official proof", () => {
    const mutations = [
      (p: ResearchGoalPatch) => { p.proof.finality = "not_final" as "final"; },
      (p: ResearchGoalPatch) => { p.proof.attribution = "ambiguous" as "qualified"; },
      (p: ResearchGoalPatch) => { p.proof.receipts = p.proof.receipts.slice(0, 2); },
      (p: ResearchGoalPatch) => { p.proof.receipts[0].url = p.proof.receipts[0].url.replace("gameId%3D2026020001", "gameId%3D2026020002"); },
      (p: ResearchGoalPatch) => { p.proof.availableAtUTC = "2026-10-27T13:03:00Z"; },
      (p: ResearchGoalPatch) => { p.sourceProjectionSHA256 = "invalid"; },
    ];
    for (const mutate of mutations) {
      const { request, bundle, patch } = overlayFixture(); mutate(patch);
      const p = qualifyCurrentResearchInputs(request, bundle).records[0];
      expect(p.overlay.state).toBe("withheld"); expect(p.research.productionInputsComplete).toBe(false);
    }
  });
  it("rejects an extra field, fractional goal or missing frozen primitive rather than coercing it", () => {
    for (const mutate of [
      (p: ResearchGoalPatch) => { (p.values as Record<string, number>).shots = 99; },
      (p: ResearchGoalPatch) => { p.values.es_goals_for = 0.5; },
      (p: ResearchGoalPatch) => { p.frozenCounts.shots = null; },
    ]) {
      const { request, bundle, patch } = overlayFixture(); mutate(patch);
      expect(qualifyCurrentResearchInputs(request, bundle).records[0].overlay.state).toBe("withheld");
    }
  });
  it("rejects duplicated patches and reserved-season data before overlay composition", () => {
    const a = overlayFixture(); a.bundle.patches.push({ ...a.patch });
    expect(() => qualifyCurrentResearchInputs(a.request, a.bundle)).toThrow(/duplicate overlay/);
    const b = overlayFixture(); b.patch.seasonId = 20252026;
    expect(() => qualifyCurrentResearchInputs(b.request, b.bundle)).toThrow(/Unexpected overlay season/);
  });
  it("retains participation/exposure holds and admits positive-TOI zero-shot players", () => {
    const a = overlayFixture(); a.request.wgo!.rows[0].games_played = 0;
    expect(qualifyCurrentResearchInputs(a.request, a.bundle).records[0].overlay.state).toBe("withheld");
    const b = overlayFixture(); b.request.wgo!.rows[0].toi_per_game = 1;
    const p = qualifyCurrentResearchInputs(b.request, b.bundle).records[0];
    expect(p.overlay.state).toBe("applied_to_research_copy"); expect(p.research.productionInputsComplete).toBe(true);
    expect(p.research.onIce.qualified).toBe(false); // process mismatch remains separate
  });
  it("includes required overlay receipt age in research freshness", () => {
    const { request, bundle, patch } = overlayFixture();
    patch.proof.receipts.forEach(r => { r.retrievedAtUTC = r.retrievedAtUTC.replace("2026-10-27", "2026-10-26"); });
    patch.proof.availableAtUTC = "2026-10-26T13:02:00Z";
    const p = qualifyCurrentResearchInputs(request, bundle).records[0];
    expect(p.raw.freshness.state).toBe("fresh"); expect(p.freshness.state).toBe("stale");
    expect(p.freshness.researchCaptureAgeHours).toBe(29);
  });
  it("marks an old event cutoff stale even if files were recaptured recently", () => {
    const { request, bundle } = overlayFixture(); request.asOfUTC = "2026-11-04T18:00:00Z";
    for (const feed of [request.calendar, request.wgo, request.individual, request.onIce]) feed!.capture.retrievedAtUTC = "2026-11-04T12:00:00Z";
    const p = qualifyCurrentResearchInputs(request, bundle).records[0];
    expect(p.raw.freshness.state).toBe("fresh"); expect(p.freshness.cutoffAgeDays).toBe(9); expect(p.freshness.state).toBe("stale");
  });
  it("is deterministic across row/patch order and repeated identical refreshes", () => {
    const { request, bundle, patch } = overlayFixture();
    request.wgo!.rows.push({ ...request.wgo!.rows[0], id: 4, player_id: 8470002, counts: { ...request.wgo!.rows[0].counts } });
    bundle.patches.push({ ...patch, sourceId: 4, playerId: 8470002 });
    const first = qualifyCurrentResearchInputs(request, bundle);
    request.wgo!.rows.reverse(); bundle.patches.reverse();
    expect(qualifyCurrentResearchInputs(request, bundle)).toEqual(first);
    expect(qualifyCurrentResearchInputs(request, bundle)).toEqual(first);
  });
});

describe("offline BLSH current-input qualification", () => {
  it("retains observed zero production and chance inputs without a shot-volume veto", () => {
    const result = qualifyCurrentInputs(fixture()), p = result.records[0];
    expect(p.productionInputsComplete).toBe(true); expect(p.individual.qualified).toBe(true); expect(p.onIce.qualified).toBe(true);
    expect(p.record.counts.shots).toBe(0); expect(p.individual.observed[0].ixg).toBe(0);
    expect(p.freshness).toEqual({ state: "fresh", eventAgeDays: 1, captureAgeHours: 6 });
    expect(result.score).toBeNull(); expect(result.streak).toBeNull(); expect(result.trusted).toBe(false);
    expect(result.blockers).toContain("operational_reference_not_released"); expect(result.blockers).toContain("game_finality_not_established");
  });
  it("retains legitimate goals above shots and source discrepancies without overriding either source", () => {
    const r = fixture(); r.wgo!.rows[0].counts.goals = 1;
    const p = record(r);
    expect(p.productionInputsComplete).toBe(true); expect(p.individual.qualified).toBe(true);
    expect(p.record.counts.goals).toBe(1); expect(p.individual.observed[0].goals).toBe(0);
    expect(p.individual.countingDiscrepancies).toEqual([{ sourceId: 2, goals: true, shots: false }]);
    r.individual!.rows[0].goals = null;
    expect(record(r).individual.countingDiscrepancies[0].goals).toBeNull();
  });
  it("requires every named GS primitive and never substitutes a two-track composite", () => {
    for (const field of PRODUCTION_INPUTS.wigoGameScore) {
      const r = fixture(); r.wgo!.rows[0].counts[field] = null;
      const p = record(r);
      expect(p.tracks.wigoGameScore.qualified, field).toBe(false); expect(p.productionInputsComplete, field).toBe(false);
      expect(p.record.counts[field]).toBeNull();
    }
    const r = fixture(); r.wgo!.rows[0].counts.penalties_drawn = null;
    expect(record(r).tracks.fantasyPoints.qualified).toBe(true); expect(record(r).tracks.rawPoints.qualified).toBe(true);
  });
  it("rejects invalid primitive values and inconsistent official points without clamping", () => {
    const r = fixture(); r.wgo!.rows[0].counts.shots = -1; r.wgo!.rows[0].counts.points = 2;
    const p = record(r);
    expect(p.tracks.fantasyPoints.reasons).toContain("missing_or_invalid_shots");
    expect(p.tracks.rawPoints.reasons).toContain("inconsistent_points_primitive"); expect(p.record.counts.shots).toBe(-1);
    r.wgo!.rows[0].counts.shots = Number.NaN; expect(record(r).tracks.fantasyPoints.qualified).toBe(false);
  });
  it("separates GP0, unknown GP and positive-TOI observed zero", () => {
    const r = fixture(); r.wgo!.rows[0].games_played = 0;
    expect(record(r).identityAndExposure.reasons).toContain("confirmed_nonappearance"); expect(record(r).productionInputsComplete).toBe(false);
    r.wgo!.rows[0].games_played = null;
    expect(record(r).identityAndExposure.reasons).toContain("unknown_participation");
    r.wgo!.rows[0].games_played = 1; r.wgo!.rows[0].toi_per_game = 0;
    expect(record(r).identityAndExposure.reasons).toContain("missing_or_nonpositive_total_TOI");
    r.wgo!.rows[0].toi_per_game = 1;
    expect(record(r).productionInputsComplete).toBe(true); // no arbitrary positive-minute floor
  });
  it("preserves unavailable EV/PP context without substituting zeros or vetoing total exposure", () => {
    const r = fixture(); r.wgo!.rows[0].es_toi_per_game = null; r.wgo!.rows[0].pp_toi_per_game = null;
    const p = record(r); expect(p.productionInputsComplete).toBe(true);
    expect(p.record.es_toi_per_game).toBeNull(); expect(p.record.pp_toi_per_game).toBeNull();
  });
  it("requires an exact regular-season game ID/calendar/date match", () => {
    for (const mutate of [
      (r: CurrentInputRequest) => { r.wgo!.rows[0].game_id = null; },
      (r: CurrentInputRequest) => { r.calendar!.rows[0].type = 1; },
      (r: CurrentInputRequest) => { r.calendar!.rows[0].date = "2026-10-24"; },
      (r: CurrentInputRequest) => { r.calendar!.rows[0].id = 2026030001; r.wgo!.rows[0].game_id = 2026030001; },
    ]) { const r = fixture(); mutate(r); expect(record(r).productionInputsComplete).toBe(false); }
  });
  it("retains post-cutoff and invalid season-date records as unqualified", () => {
    const r = fixture(); r.wgo!.rows[0].date = "2026-10-27";
    expect(record(r).identityAndExposure.reasons).toContain("invalid_or_post_cutoff_game_date");
    r.wgo!.rows[0].date = "2026-02-30"; expect(record(r).identityAndExposure.qualified).toBe(false);
    r.wgo!.rows[0].date = "2026-01-01"; r.calendar!.rows[0].date = "2026-01-01";
    expect(record(r).identityAndExposure.reasons).toContain("invalid_or_post_cutoff_game_date");
  });
  it("rejects reserved/reference-season input before qualification", () => {
    const r = fixture(); r.wgo!.rows[0].season_id = 20252026;
    expect(() => qualifyCurrentInputs(r)).toThrow(/Unexpected season/);
  });
  it("does not choose an arbitrary WGO row or NST row from ambiguous player-date keys", () => {
    const r = fixture(); r.wgo!.rows.push({ ...r.wgo!.rows[0], id: 4 });
    expect(qualifyCurrentInputs(r).records.every(p => !p.productionInputsComplete)).toBe(true);
    const n = fixture(); n.individual!.rows.push({ ...n.individual!.rows[0], id: 5, ixg: 1 });
    const p = record(n); expect(p.individual.reasons).toContain("ambiguous_player_date_match"); expect(p.individual.observed).toHaveLength(2);
    expect(p.onIce.qualified).toBe(true);
  });
  it("rejects duplicated source IDs rather than treating their names as revision order", () => {
    const r = fixture(); r.onIce!.rows.push({ ...r.onIce!.rows[0], xgf: 1 });
    expect(() => qualifyCurrentInputs(r)).toThrow(/duplicate source record ID/);
  });
  it("does not infer game dates, all-strength scope or seconds from a table name", () => {
    const r = fixture(); r.individual!.dateMeaning = "unknown"; r.onIce!.strengthScope = "unknown"; r.onIce!.toiUnit = "unknown";
    const p = record(r); expect(p.individual.reasons).toContain("unqualified_date_meaning");
    expect(p.onIce.reasons).toContain("unqualified_strength_scope"); expect(p.onIce.reasons).toContain("unqualified_exposure_unit");
  });
  it("withholds rates on exposure mismatch without changing the retained counts", () => {
    const r = fixture(); r.onIce!.rows[0].toi = 899; r.onIce!.rows[0].xgf = 1.5;
    const p = record(r); expect(p.onIce.reasons).toContain("process_WGO_exposure_mismatch");
    expect(p.onIce.observed[0].xgf).toBe(1.5); expect(p.productionInputsComplete).toBe(true);
  });
  it("keeps missing individual xG distinct from zero and independent of on-ice qualification", () => {
    const r = fixture(); r.individual!.rows[0].ixg = null;
    const p = record(r); expect(p.individual.qualified).toBe(false); expect(p.individual.observed[0].ixg).toBeNull(); expect(p.onIce.qualified).toBe(true);
  });
  it("preserves orphan process observations and does not claim a complete player population", () => {
    const r = fixture(); r.individual!.rows[0].player_id = 8479999;
    const out = qualifyCurrentInputs(r); expect(out.records[0].individual.reasons).toContain("no_matching_process_record");
    expect(out.unmatched.individual).toHaveLength(1); expect(out.populationScope).toBe("captured_WGO_records_only");
  });
  it("represents absent feeds and no current records explicitly", () => {
    const r = fixture(); r.individual = null; r.onIce = null;
    const out = qualifyCurrentInputs(r); expect(out.records[0].freshness.state).toBe("unknown");
    expect(out.sourceAvailability.individual).toEqual(["source_unavailable"]);
    r.wgo = null; const none = qualifyCurrentInputs(r); expect(none.records).toHaveLength(0); expect(none.unmatched.individual).toHaveLength(0);
    expect(none.coverage.productionComplete).toBe(0); expect(none.score).toBeNull();
  });
  it("uses retrieval as proof of captured presence without inventing original availability", () => {
    const r = fixture(); const out = qualifyCurrentInputs(r);
    expect(out.sourceCaptures.wgo!.sourceAvailableThroughUTC).toBeNull(); expect(out.sourceCaptures.wgo!.revisionId).toBeNull();
    expect(out.asOfKind).toBe("presence_proven_by_capture_not_original_publication");
    r.wgo!.capture.retrievedAtUTC = "2026-10-27T19:00:00Z";
    expect(record(r).identityAndExposure.reasons).toContain("capture_after_as_of"); expect(record(r).freshness.state).toBe("unknown");
  });
  it("requires timezone-qualified timestamps and rejects impossible source watermarks", () => {
    const r = fixture(); r.asOfUTC = "2026-10-27T18:00:00";
    expect(() => qualifyCurrentInputs(r)).toThrow(/as-of scope/);
    const n = fixture(); n.wgo!.capture.sourceAvailableThroughUTC = "2026-10-27T13:00:00Z";
    expect(() => qualifyCurrentInputs(n)).toThrow(/capture provenance/);
  });
  it("reports event and capture staleness using a supplied policy, including exact boundaries", () => {
    const r = fixture(); r.freshnessPolicy.maxEventAgeDays = 1; r.freshnessPolicy.maxCaptureAgeHours = 6;
    expect(record(r).freshness.state).toBe("fresh");
    r.freshnessPolicy.maxEventAgeDays = 0; expect(record(r).freshness.state).toBe("stale");
    r.freshnessPolicy.maxEventAgeDays = 1; r.freshnessPolicy.maxCaptureAgeHours = 5.9;
    expect(record(r).freshness.state).toBe("stale"); expect(record(r).productionInputsComplete).toBe(true);
  });
  it("does not adopt a default refresh policy", () => {
    const r = fixture(); r.freshnessPolicy.maxCaptureAgeHours = Infinity;
    expect(() => qualifyCurrentInputs(r)).toThrow(/freshness policy/);
  });
  it("is idempotent, stable under row order and leaves originals unchanged", () => {
    const r = fixture(); r.wgo!.rows.push({ ...r.wgo!.rows[0], id: 8, player_id: 8470002, counts: { ...r.wgo!.rows[0].counts } });
    const before = structuredClone(r), a = qualifyCurrentInputs(r), b = qualifyCurrentInputs(r);
    expect(a).toEqual(b); expect(r).toEqual(before);
    r.wgo!.rows.reverse(); expect(qualifyCurrentInputs(r)).toEqual(a);
    r.individual!.rows.push({ ...r.individual!.rows[0], id: 9 });
    const ambiguous = qualifyCurrentInputs(r); r.individual!.rows.reverse();
    expect(qualifyCurrentInputs(r)).toEqual(ambiguous);
  });
  it("retains changed capture/revision provenance on refresh without rewriting the old result", () => {
    const r = fixture(), a = qualifyCurrentInputs(r);
    r.wgo!.capture.revisionId = "correction-1"; r.wgo!.capture.sha256 = "b".repeat(64); r.wgo!.rows[0].counts.goals = 1;
    const b = qualifyCurrentInputs(r);
    expect(a.sourceCaptures.wgo!.revisionId).toBeNull(); expect(a.records[0].record.counts.goals).toBe(0);
    expect(b.sourceCaptures.wgo!.revisionId).toBe("correction-1"); expect(b.records[0].record.counts.goals).toBe(1);
  });
});
