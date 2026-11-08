import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCurrentProcessEvidenceGate, processEvidenceRowSHA256, type ProcessEvidencePolicy } from "./currentProcessEvidence.server";
import { PRODUCTION_INPUTS, type CurrentInputRequest } from "./currentInput";

const utf8 = (value: string) => new TextEncoder().encode(value);
const bytes = (value: unknown) => utf8(JSON.stringify(value));
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
type Group = "individual" | "onIce";
const groups: Group[] = ["individual", "onIce"];
const AT = "2026-11-01T20:00:00Z";
function seed() {
  const capture = (source: "public.games" | "public.wgo_skater_stats" | "public.nst_gamelog_as_counts" | "public.nst_gamelog_as_counts_oi") => ({
    source, sha256: "a".repeat(64), retrievedAtUTC: "2026-11-01T19:00:00Z", sourceAvailableThroughUTC: null, revisionId: null,
  });
  const request: CurrentInputRequest = {
    seasonId: 20262027, eventThroughDate: "2026-10-31", asOfUTC: "2026-11-01T20:00:00Z",
    freshnessPolicy: { id: "synthetic-test-only", maxEventAgeDays: 7, maxCaptureAgeHours: 24 },
    calendar: { capture: capture("public.games"), rows: [{ id: 2026020001, seasonId: 20262027, date: "2026-10-31", type: 2 }] },
    wgo: { capture: capture("public.wgo_skater_stats"), rows: [{ id: 1, player_id: 8470001, game_id: 2026020001, season_id: 20262027,
      date: "2026-10-31", player_name: "Synthetic Player", team_abbrev: "TST", position_code: "F", games_played: 1,
      toi_per_game: 900, es_toi_per_game: 800, pp_toi_per_game: 100,
      counts: { ...Object.fromEntries(Object.values(PRODUCTION_INPUTS).flat().map(k => [k, 0])), points: 0 } }] },
    individual: { capture: capture("public.nst_gamelog_as_counts"), strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown",
      rows: [{ id: 2, player_id: 8470001, season: 20262027, date_scraped: "2026-10-31", gp: 1, toi: 900, ixg: 0, goals: 0, shots: 0 }] },
    onIce: { capture: capture("public.nst_gamelog_as_counts_oi"), strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown",
      rows: [{ id: 3, player_id: 8470001, season: 20262027, date_scraped: "2026-10-31", gp: 1, toi: 900, xgf: 0, xga: 0 }] },
  };
  const producer = bytes({ synthetic: "producer" }), redactor = bytes({ synthetic: "redactor" });
  const bodies = { individual: utf8("SYNTHETIC native individual fixture; not provider evidence"), onIce: utf8("SYNTHETIC native on-ice fixture; not provider evidence") };
  const receipt = (group: Group) => ({
    url: "https://data.naturalstattrick.com/playerteams.php?" + new URLSearchParams({ fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all", stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0", gpfilt: "gpdate", fd: "2026-10-31", td: "2026-10-31", lines: "single", draftteam: "ALL" }),
    status: "success", httpStatus: 200, TLSVerified: true, representation: "parser_input_after_redaction",
    parserInputSHA256: sha(bodies[group]), parserInputBytes: bodies[group].byteLength,
    producerSHA256: sha(producer), redactorSHA256: sha(redactor), retrievedAtUTC: "2026-11-01T19:10:00Z",
    toiParsingContract: "minutes_decimal_or_mmss_to_seconds_half_up",
  });
  return { request, bodies, producer, redactor, receipts: { individual: receipt("individual"), onIce: receipt("onIce") },
    frame: { seasonId: 20262027, playerId: 8470001, gameId: 2026020001, date: "2026-10-31", team: "TST", final: true,
      gamesPlayed: 1, totalToiSeconds: 900, completedByUTC: "2026-10-31T23:00:00Z", observedAtUTC: "2026-11-01T19:15:00Z" },
    overrides: { individual: {}, onIce: {} } as Record<Group, Record<string, unknown>> };
}
function fixture(change?: (s: ReturnType<typeof seed>) => void) {
  const s = seed(); change?.(s);
  const artifacts = new Map<string, Uint8Array>();
  const add = (b: Uint8Array) => { const key = sha(b); artifacts.set(key, b); return key; };
  const producer = add(s.producer), redactor = add(s.redactor), frame = add(bytes(s.frame));
  const definition = add(bytes({ synthetic: true, acceptedUse: "exact fixture cells/scope/model", publicationUTC: null }));
  const review = add(bytes({ synthetic: true, reviewScope: "exact_rows_native_cells_scope_and_model" }));
  const requestBytes = bytes(s.request);
  const witnesses = groups.filter(g => s.request[g] !== null).map(group => ({
    group, wgoSourceId: 1, processSourceId: s.request[group]!.rows[0].id,
    playerId: 8470001, gameId: 2026020001, date: "2026-10-31", team: "TST",
    wgoRowSHA256: processEvidenceRowSHA256(s.request.wgo!.rows[0]), processRowSHA256: processEvidenceRowSHA256(s.request[group]!.rows[0]),
    nativeBodySHA256: add(s.bodies[group]), nativeReceiptSHA256: add(bytes(s.receipts[group])),
    producerSHA256: producer, redactorSHA256: redactor, definitionSHA256: definition, officialFrameSHA256: frame,
    nativeValuesMatched: true, qualifiedScope: { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds" }, ...s.overrides[group],
  }));
  const bundle = { version: "fhfh.blsh.reviewed-process-evidence.v1", sourceRequestSHA256: sha(requestBytes), witnesses };
  const bundleBytes = bytes(bundle);
  const policy: ProcessEvidencePolicy = { acceptances: [{ bundleSHA256: sha(bundleBytes), requestSHA256: sha(requestBytes), reviewSHA256: review,
    reviewScope: "exact_rows_native_cells_scope_and_model", requiredArtifactSHA256: [...artifacts.keys()] }] };
  return { s, requestBytes, bundle, bundleBytes, artifacts, policy };
}
const evaluate = (f: ReturnType<typeof fixture>) => createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, AT, f.bundleBytes, f.artifacts);
function repack(f: ReturnType<typeof fixture>) {
  f.bundleBytes = bytes(f.bundle);
  f.policy = { acceptances: [{ ...f.policy.acceptances[0], bundleSHA256: sha(f.bundleBytes) }] };
}

describe("current process evidence server boundary (synthetic policy only)", () => {
  it("preserves the canonical UTF-8 digest for Unicode and zero values", () => {
    expect(processEvidenceRowSHA256({ z: "é🏒", a: ["", 0, "e\u0301"] })).toBe("3f491699ce10aaf90c5c3745000619edaecd9a39e0784a1c21fc983606726fd4");
  });
  it("authenticates only the bytes within nonzero-offset views", () => {
    const f = fixture();
    const view = (value: Uint8Array) => {
      const padded = new Uint8Array(value.length + 2).fill(255);
      padded.set(value, 1);
      return padded.subarray(1, padded.length - 1);
    };
    const out = createCurrentProcessEvidenceGate(f.policy)(view(f.requestBytes), AT, view(f.bundleBytes),
      new Map([...f.artifacts].map(([key, value]) => [key, view(value)])));
    expect(out).toEqual(evaluate(f));
  });
  it("rejects malformed UTF-8 instead of decoding replacement characters", () => {
    const malformed = Uint8Array.from([123, 34, 120, 34, 58, 34, 128, 34, 125]);
    expect(() => createCurrentProcessEvidenceGate()(malformed, AT)).toThrow("invalid_artifact_json");
  });
  it("defaults closed even when callers label both feeds all-strength/date/seconds", () => {
    const f = fixture(s => { for (const g of groups) Object.assign(s.request[g]!, { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds" }); });
    const out = createCurrentProcessEvidenceGate()(f.requestBytes, AT, f.bundleBytes, f.artifacts);
    expect(out.records[0].rawProcessQualification.individual.qualified).toBe(true);
    expect(out.coverage.individualQualified).toBe(0);
    expect(out.coverage.sourceObservationIndividualQualified).toBe(0);
    expect(out.records[0].individual.reasons).toContain("native_evidence_not_independently_accepted");
    expect(out.score).toBeNull(); expect(out.productionAdopted).toBe(false);
  });
  it("preserves literal zeros and raw bytes with exact synthetic acceptance", () => {
    const f = fixture(), before = Uint8Array.from(f.requestBytes); const a = evaluate(f), b = evaluate(f);
    expect(a).toEqual(b); expect(Array.from(f.requestBytes)).toEqual(Array.from(before));
    expect(a.coverage.individualQualified).toBe(1); expect(a.coverage.onIceQualified).toBe(1);
    expect(a.records[0].record.counts.shots).toBe(0); expect(a.records[0].individual.observed[0]).toMatchObject({ ixg: 0 });
    expect(a.records[0].individual.provenance.availableAtUTC).toBe("2026-11-01T19:15:00.000Z");
    expect(a.records[0].individual.provenance.originalPublicationUTC).toBeNull();
    expect(a.trusted).toBe(false); expect(a.score).toBeNull();
  });
  it("does not turn absence of a bundle or a partial row witness into zero/qualification", () => {
    const f = fixture();
    expect(createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, AT).records[0].individual.reasons).toContain("native_evidence_not_supplied");
    f.bundle.witnesses = f.bundle.witnesses.filter(w => w.group === "individual"); repack(f);
    const out = evaluate(f); expect(out.coverage.individualQualified).toBe(1); expect(out.coverage.onIceQualified).toBe(0);
    expect(out.records[0].onIce.provenance.reasons).toContain("no_exact_row_witness");
  });
  it("keeps a supported group independent from a missing other feed", () => {
    const f = fixture(s => { s.request.onIce = null; }); const out = evaluate(f);
    expect(out.coverage.individualQualified).toBe(1); expect(out.coverage.onIceQualified).toBe(0);
    expect(out.unmatched.onIce).toEqual([]);
  });
  it("rejects changed accepted request bytes and unaccepted bundle bytes", () => {
    const f = fixture(); const gate = createCurrentProcessEvidenceGate(f.policy);
    const changed = bytes({ ...f.s.request, asOfUTC: "2026-11-01T20:01:00Z" });
    expect(gate(changed, "2026-11-01T20:01:00Z", f.bundleBytes, f.artifacts).records[0].individual.reasons).toContain("accepted_capture_bytes_changed");
    expect(gate(f.requestBytes, AT, Uint8Array.from([...f.bundleBytes, ...utf8(" ")]), f.artifacts).coverage.individualQualified).toBe(0);
  });
  it("rejects absent or corrupted bound artifacts", () => {
    const f = fixture(), key = f.bundle.witnesses[0].nativeBodySHA256;
    f.artifacts.set(key, utf8("tampered")); expect(evaluate(f).records[0].individual.reasons).toContain("accepted_artifact_hash_mismatch");
    f.artifacts.delete(key); expect(evaluate(f).records[0].individual.reasons).toContain("accepted_artifact_missing_or_oversized");
  });
  it("rejects empty and duplicate witnesses rather than granting whole-capture scope", () => {
    const f = fixture(); f.bundle.witnesses = []; repack(f);
    expect(evaluate(f).records[0].individual.reasons).toContain("empty_or_excessive_witnesses");
    const g = fixture(); g.bundle.witnesses.push(g.bundle.witnesses[0]); repack(g);
    expect(evaluate(g).records[0].individual.reasons).toContain("duplicate_row_witness");
  });
  it("rejects altered native date, strength, count scope, TLS and claimed cells", () => {
    for (const change of [
      (s: ReturnType<typeof seed>) => { s.receipts.individual.url = s.receipts.individual.url.replace("sit=all", "sit=5v5"); },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.url = s.receipts.individual.url.replace("rate=n", "rate=y"); },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.url = s.receipts.individual.url.replaceAll("2026-10-31", "2026-10-30"); },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.TLSVerified = false; },
      (s: ReturnType<typeof seed>) => { s.overrides.individual.nativeValuesMatched = false; },
      (s: ReturnType<typeof seed>) => { s.overrides.individual.qualifiedScope = { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "unknown" }; },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.toiParsingContract = "unknown"; },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.url += "&constructor=unexpected"; },
    ]) expect(evaluate(fixture(change)).coverage.individualQualified).toBe(0);
  });
  it("checks whole-row hashes including healthy counts and names", () => {
    for (const field of ["wgoRowSHA256", "processRowSHA256"]) {
      const out = evaluate(fixture(s => { s.overrides.individual[field] = "b".repeat(64); }));
      expect(out.records[0].individual.reasons).toContain("row_or_identity_drift");
    }
    const f = fixture(s => { s.overrides.individual.wgoRowSHA256 = processEvidenceRowSHA256(seed().request.wgo!.rows[0]); s.request.wgo!.rows[0].player_name = "Changed"; });
    expect(evaluate(f).coverage.individualQualified).toBe(0);
  });
  it("retains Crotty-like stored disagreement and Deslauriers-like official mismatch", () => {
    const crotty = fixture(s => { s.request.wgo!.rows[0].toi_per_game = 700; for (const g of groups) s.request[g]!.rows[0].toi = 702; s.frame.totalToiSeconds = 700; });
    expect(evaluate(crotty).records[0].individual.reasons).toContain("official_identity_or_exposure_hold");
    const deslauriers = fixture(s => { s.request.wgo!.rows[0].toi_per_game = 445; for (const g of groups) s.request[g]!.rows[0].toi = 445; s.frame.totalToiSeconds = 444; });
    expect(evaluate(deslauriers).coverage.individualQualified).toBe(0);
  });
  it("rejects future, stale and pre-completion evidence without resetting freshness", () => {
    for (const value of ["2026-11-02T19:10:00Z", "2026-10-30T19:10:00Z", "2026-11-01T19:10:00"]) {
      expect(evaluate(fixture(s => { s.receipts.individual.retrievedAtUTC = value; })).coverage.individualQualified).toBe(0);
    }
    expect(evaluate(fixture(s => { s.request.wgo!.capture.retrievedAtUTC = "2026-10-30T19:00:00Z"; })).coverage.individualQualified).toBe(0);
  });
  it("retains missing metrics, GP=0 and official count discrepancies separately", () => {
    expect(evaluate(fixture(s => { s.request.individual!.rows[0].ixg = null; })).records[0].individual.reasons).toContain("missing_or_invalid_ixg");
    expect(evaluate(fixture(s => { s.request.individual!.rows[0].gp = 0; })).records[0].individual.reasons).toContain("process_participation_unqualified");
    const out = evaluate(fixture(s => { s.request.individual!.rows[0].goals = 2; }));
    expect(out.records[0].individual.countingDiscrepancies?.[0].goals).toBe(true);
    expect(out.records[0].record.counts.goals).toBe(0); expect(out.score).toBeNull();
  });
  it("requires the exact review scope and clones trusted configuration", () => {
    const f = fixture(); const gate = createCurrentProcessEvidenceGate(f.policy);
    (f.policy.acceptances as unknown[]).length = 0;
    expect(gate(f.requestBytes, AT, f.bundleBytes, f.artifacts).coverage.individualQualified).toBe(1);
    const g = fixture(); const bad = { acceptances: [{ ...g.policy.acceptances[0], reviewScope: "structural_counts_only" }] };
    expect(() => createCurrentProcessEvidenceGate(bad as unknown as ProcessEvidencePolicy)).toThrow("invalid_server_acceptance_policy");
  });
  it("re-evaluates freshness at server time without changing approved capture bytes", () => {
    const f = fixture(); const gate = createCurrentProcessEvidenceGate(f.policy);
    const later = gate(f.requestBytes, "2026-11-03T20:00:00Z", f.bundleBytes, f.artifacts);
    expect(later.coverage.individualQualified).toBe(0);
    expect(later.records[0].individual.reasons).toContain("current_use_evidence_stale_or_unknown");
    expect(later.sourceRequestAsOfUTC).toBe(AT); expect(later.asOfUTC).toBe("2026-11-03T20:00:00Z");
    expect(() => gate(f.requestBytes, "2026-11-01T19:00:00Z", f.bundleBytes, f.artifacts)).toThrow("evaluation_precedes_source_request");
  });
  it("reports a stable invalid-artifact reason without echoing malformed input", () => {
    const f = fixture(), malformed = utf8('{"privateText":"DO_NOT_ECHO_FIXTURE",');
    const key = sha(malformed); f.artifacts.set(key, malformed);
    f.bundle.witnesses[0].nativeReceiptSHA256 = key;
    f.policy = { acceptances: [{ ...f.policy.acceptances[0], requiredArtifactSHA256: [...f.policy.acceptances[0].requiredArtifactSHA256, key] }] };
    repack(f); const out = evaluate(f);
    expect(out.records[0].individual.reasons).toContain("invalid_artifact_json");
    expect(JSON.stringify(out)).not.toContain("DO_NOT_ECHO_FIXTURE");
  });
});

type BoundaryCase = "native_after" | "frame_after" | "before_completion" | "request_after" | "capture_after" | "capture_age";
const boundaries: BoundaryCase[] = ["native_after", "frame_after", "before_completion", "request_after", "capture_after", "capture_age"];
function boundaryFixture(name: BoundaryCase, fraction: string) {
  return fixture(s => {
    const after = `2026-11-01T20:00:00.${fraction}Z`;
    if (name === "native_after") s.receipts.individual.retrievedAtUTC = after;
    if (name === "frame_after") s.frame.observedAtUTC = after;
    if (name === "before_completion") s.frame.completedByUTC = `2026-11-01T19:10:00.${fraction}Z`;
    if (name === "request_after") s.request.asOfUTC = after;
    if (name === "capture_after") s.request.individual!.capture.retrievedAtUTC = after;
    if (name === "capture_age") s.request.freshnessPolicy.maxCaptureAgeHours = 1;
  });
}
function expectBoundaryWithheld(name: BoundaryCase, fraction: string) {
  const f = boundaryFixture(name, fraction);
  const at = name === "capture_age" ? `2026-11-01T20:00:00.${fraction}Z` : AT;
  const run = () => createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, at, f.bundleBytes, f.artifacts);
  if (name === "request_after") expect(run).toThrow("evaluation_precedes_source_request");
  else {
    const out = run(); expect(out.coverage.individualQualified).toBe(0);
    expect(out.records[0].individual.provenance.state).toBe("withheld");
    expect(out.records[0].individual.sourceObservation.qualified).toBe(false);
    if (["frame_after", "before_completion", "capture_age"].includes(name)) expect(out.coverage.onIceQualified).toBe(0);
  }
}

describe("exact timing boundary regressions", () => {
  it.each(boundaries)("microsecond boundary %s withholds/rejects", name => expectBoundaryWithheld(name, "000001"));
  it.each(boundaries)("millisecond control %s withholds/rejects", name => expectBoundaryWithheld(name, "001"));
  it("timing: accepts equality and serializes the exact six-digit observation", () => {
    const f = fixture(s => { s.receipts.individual.retrievedAtUTC = "2026-11-01T20:00:00.123456Z"; });
    const out = createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, "2026-11-01T20:00:00.123456Z", f.bundleBytes, f.artifacts);
    expect(out.coverage.individualQualified).toBe(1);
    expect(out.records[0].individual.provenance.availableAtUTC).toBe("2026-11-01T20:00:00.123456Z");
    expect(out.records[0].individual.provenance.oldestEvidenceAtUTC).toBe("2026-11-01T19:15:00.000Z");
  });
  it("timing: normalizes explicit offsets without changing equality or availability", () => {
    const f = fixture(s => {
      s.request.asOfUTC = "2026-11-01T21:00:00.000001+01:00";
      s.receipts.individual.retrievedAtUTC = "2026-11-02T01:30:00.000001+05:30";
      s.frame.observedAtUTC = "2026-11-01T14:15:00-05:00";
      s.frame.completedByUTC = "2026-11-01T13:00:00+14:00";
    });
    const out = createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, "2026-11-01T15:00:00.000001-05:00", f.bundleBytes, f.artifacts);
    expect(out.coverage.individualQualified).toBe(1);
    expect(out.records[0].individual.provenance.availableAtUTC).toBe("2026-11-01T20:00:00.000001Z");
    expect(out.sourceRequestAsOfUTC).toBe("2026-11-01T21:00:00.000001+01:00");
  });
  it("timing: compares the repeated DST hour by offset, not the local wall clock", () => {
    const f = fixture(s => {
      s.request.asOfUTC = "2026-11-01T01:59:59.999999-04:00";
    });
    expect(() => createCurrentProcessEvidenceGate()(f.requestBytes, "2026-11-01T01:00:00-05:00")).not.toThrow();
    expect(() => createCurrentProcessEvidenceGate()(f.requestBytes, "2026-11-01T01:59:59.999998-04:00")).toThrow("evaluation_precedes_source_request");
  });
  it.each([
    "2026-11-01T19:10:00.0000001Z", "2026-11-01T19:10:00-00:00", "2026-11-01T19:10:00+14:01",
    "2026-11-01T19:10:00+24:00", "2026-11-01T19:10:00+02:60", "2026-11-01T19:10:00+02",
    "2026-11-01T19:10:00", "2026-11-01T19:10:00Zjunk", "2026-11-01T24:00:00Z",
    "2026-11-01T19:10:60Z", "2026-02-29T19:10:00Z", "2026-11-31T19:10:00Z",
  ])("timing: rejects unsupported or invalid timestamp %s", value => {
    const out = evaluate(fixture(s => { s.receipts.individual.retrievedAtUTC = value; }));
    expect(out.coverage.individualQualified).toBe(0);
    expect(out.records[0].individual.provenance.reasons).toContain("invalid_evidence_time");
  });
  it.each([0.0000000001, 24.000000000000004, Number.MIN_VALUE, 1e21])("timing: rejects unrepresentable microsecond budget %s", value => {
    const out = evaluate(fixture(s => { s.request.freshnessPolicy.maxCaptureAgeHours = value; }));
    expect(out.coverage.individualQualified).toBe(0);
    expect(out.records[0].individual.provenance.reasons).toContain("invalid_freshness_precision");
  });
  it.each([
    ["2026-11-01T19:59:59.999100Z", 1],
    ["2026-11-01T19:59:59.999099Z", 0],
  ] as const)("timing: applies a scientific-notation 900µs budget exactly at %s", (nativeTime, qualified) => {
    const f = fixture(s => {
      s.request.freshnessPolicy.maxCaptureAgeHours = 2.5e-7;
      for (const key of ["calendar", "wgo", "individual", "onIce"] as const) s.request[key]!.capture.retrievedAtUTC = AT;
      for (const group of groups) s.receipts[group].retrievedAtUTC = nativeTime;
      s.frame.observedAtUTC = AT;
    });
    const out = evaluate(f);
    expect(out.coverage.individualQualified).toBe(qualified);
    expect(out.coverage.onIceQualified).toBe(qualified);
    if (!qualified) expect(out.records[0].individual.provenance.reasons).toContain("current_use_evidence_stale_or_unknown");
  });
  it("timing: accepts an exactly representable fractional-hour policy", () => {
    const f = fixture(s => {
      s.request.freshnessPolicy.maxCaptureAgeHours = 0.25;
      for (const key of ["calendar", "wgo", "individual", "onIce"] as const) s.request[key]!.capture.retrievedAtUTC = "2026-11-01T19:50:00Z";
      for (const group of groups) s.receipts[group].retrievedAtUTC = "2026-11-01T19:50:00Z";
      s.frame.observedAtUTC = "2026-11-01T19:55:00Z";
    });
    expect(evaluate(f).coverage.individualQualified).toBe(1);
  });
});

// Every observation, row and acceptance below is fictional. Rebinding them is
// fixture construction, never a route for accepting real evidence.
function windowFixture(dates: string[], change?: (s: ReturnType<typeof seed>, i: number) => void) {
  const members = dates.map((date, i) => fixture(s => {
    const gameId = 2026020001 + i;
    Object.assign(s.request.calendar!.rows[0], { id: gameId, date });
    Object.assign(s.request.wgo!.rows[0], { id: i + 1, game_id: gameId, date });
    Object.assign(s.frame, { gameId, date, completedByUTC: `${date}T23:00:00Z` });
    for (const group of groups) {
      Object.assign(s.request[group]!.rows[0], { id: i + 1, date_scraped: date });
      s.receipts[group].url = s.receipts[group].url.replaceAll("2026-10-31", date);
      Object.assign(s.overrides[group], { wgoSourceId: i + 1, gameId, date });
    }
    change?.(s, i);
  }));
  const f = members[0], request = structuredClone(f.s.request);
  request.calendar!.rows = members.flatMap(m => m.s.request.calendar!.rows);
  request.wgo!.rows = members.flatMap(m => m.s.request.wgo!.rows);
  request.individual!.rows = members.flatMap(m => m.s.request.individual!.rows);
  request.onIce!.rows = members.flatMap(m => m.s.request.onIce!.rows);
  f.requestBytes = bytes(request);
  f.bundle.sourceRequestSHA256 = sha(f.requestBytes);
  f.bundle.witnesses = members.flatMap(m => m.bundle.witnesses);
  f.artifacts = new Map(members.flatMap(m => [...m.artifacts]));
  f.policy = { acceptances: [{ ...f.policy.acceptances[0], requestSHA256: sha(f.requestBytes), requiredArtifactSHA256: [...f.artifacts.keys()] }] };
  repack(f);
  return f;
}
const RECENT_WINDOW = ["2026-10-24", "2026-10-25", "2026-10-27", "2026-10-29", "2026-10-31"];

describe("source observation and captured window freshness separation", () => {
  it("qualifies recent observations of older members without widening v1 admission", () => {
    const f = windowFixture(RECENT_WINDOW), before = Array.from(f.requestBytes), out = evaluate(f);
    expect(out.coverage.individualQualified).toBe(4);
    expect(out.coverage.sourceObservationIndividualQualified).toBe(5);
    expect(out.coverage.sourceObservationOnIceQualified).toBe(5);
    expect(out.records[0].individual.qualified).toBe(false);
    expect(out.records[0].individual.provenance.state).toBe("withheld");
    expect(out.records[0].individual.sourceObservation).toMatchObject({ qualified: true, reasons: [],
      provenance: { state: "exact_reviewed_row_provenance", availableAtUTC: "2026-11-01T19:15:00.000Z", originalPublicationUTC: null } });
    expect(out.capturedWindows[0]).toMatchObject({ sourceIds: [1, 2, 3, 4, 5], dates: RECENT_WINDOW,
      membershipScope: "last_five_captured_WGO_records", completeLatestFiveEstablished: false, currentUseQualified: false,
      recency: { state: "recent", latestEventAgeDays: 1, evaluationDate: "2026-11-01" },
      sourceObservations: { individual: { allMembersQualified: true, qualifiedMembers: 5 } } });
    expect(out.capturedWindows[0].reasons).toEqual(["latest_five_completed_appearances_not_independently_established"]);
    expect(Array.from(f.requestBytes)).toEqual(before);
    expect(out.score).toBeNull(); expect(out.trusted).toBe(false); expect(out.productionAdopted).toBe(false);
  });
  it("does not refresh old events when all source observations are fresh", () => {
    const f = windowFixture(["2026-10-11", "2026-10-13", "2026-10-15", "2026-10-17", "2026-10-24"]);
    const out = evaluate(f);
    expect(out.coverage.sourceObservationIndividualQualified).toBe(5);
    expect(out.coverage.individualQualified).toBe(0);
    expect(out.capturedWindows[0].recency).toMatchObject({ state: "stale", latestEventAgeDays: 8 });
    expect(out.capturedWindows[0].currentUseQualified).toBe(false);
  });
  it("uses the server UTC day at the inclusive seven-day boundary, not the captured event cutoff", () => {
    const f = windowFixture(["2026-10-15", "2026-10-17", "2026-10-19", "2026-10-21", "2026-10-25"]);
    expect(evaluate(f).capturedWindows[0].recency).toMatchObject({ state: "recent", latestEventAgeDays: 7 });
    const later = createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, "2026-11-01T19:00:00-05:00", f.bundleBytes, f.artifacts);
    expect(later.eventThroughDate).toBe("2026-10-31");
    expect(later.coverage.sourceObservationIndividualQualified).toBe(5);
    expect(later.capturedWindows[0].recency).toMatchObject({ state: "stale", evaluationDate: "2026-11-02", latestEventAgeDays: 8 });
  });
  it("keeps recent events separate from stale source observations", () => {
    const f = windowFixture(RECENT_WINDOW);
    const out = createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, "2026-11-03T20:00:00Z", f.bundleBytes, f.artifacts);
    expect(out.capturedWindows[0].recency.state).toBe("recent");
    expect(out.coverage.sourceObservationIndividualQualified).toBe(0);
    expect(out.capturedWindows[0].sourceObservations.individual.allMembersQualified).toBe(false);
    expect(out.capturedWindows[0].currentUseQualified).toBe(false);
  });
  it("selects the latest captured slots before qualification and never backfills held members", () => {
    const f = windowFixture(["2026-10-23", ...RECENT_WINDOW], (s, i) => {
      if (i === 5) { s.request.individual!.rows[0].ixg = null; s.request.wgo!.rows[0].games_played = 0; }
    });
    const out = evaluate(f), window = out.capturedWindows[0];
    expect(window.sourceIds).toEqual([2, 3, 4, 5, 6]);
    expect(window.sourceObservations.individual.qualifiedMembers).toBe(4);
    expect(window.reasons).toContain("captured_member_identity_or_exposure_unqualified");
    expect(out.records[5].individual.sourceObservation.reasons).toContain("confirmed_nonappearance");
    expect(out.records[5].individual.sourceObservation.reasons).toContain("missing_or_invalid_ixg");
  });
  it("does not present a short captured window as complete", () => {
    const out = evaluate(windowFixture(RECENT_WINDOW.slice(-4)));
    expect(out.capturedWindows[0].sourceIds).toHaveLength(4);
    expect(out.capturedWindows[0].reasons).toContain("fewer_than_five_captured_records");
    expect(out.capturedWindows[0].completeLatestFiveEstablished).toBe(false);
  });
  it("retains exact acceptance, native semantics, exposure and held-out-season boundaries", () => {
    for (const change of [
      (s: ReturnType<typeof seed>) => { s.overrides.individual.nativeValuesMatched = false; },
      (s: ReturnType<typeof seed>) => { s.receipts.individual.TLSVerified = false; },
      (s: ReturnType<typeof seed>) => { s.frame.totalToiSeconds = 899; },
      (s: ReturnType<typeof seed>) => { s.overrides.individual.processRowSHA256 = "b".repeat(64); },
    ]) expect(evaluate(windowFixture(RECENT_WINDOW, change)).coverage.sourceObservationIndividualQualified).toBe(0);
    const f = windowFixture(RECENT_WINDOW);
    const closed = createCurrentProcessEvidenceGate()(f.requestBytes, AT, f.bundleBytes, f.artifacts);
    expect(closed.coverage.sourceObservationIndividualQualified).toBe(0);
    expect(closed.capturedWindows[0].currentUseQualified).toBe(false);
    const heldOut = windowFixture(RECENT_WINDOW, s => { s.request.wgo!.rows[0].season_id = 20252026; });
    expect(() => evaluate(heldOut)).toThrow("Unexpected season; do not consume reserved/reference data");
  });
});
