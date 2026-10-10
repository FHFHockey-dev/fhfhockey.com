import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleNativeCoverageProof, assembleNativeHitHistory, nativeAssemblyClockSeconds,
  readNativeToiReport, readNativeScratchRecord, type NativeCoverageAssemblyPlan } from "./nativeCoverageAssembly";
import { NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, nativeCoverageTextHash, checkNativeCoverageProof,
  type NativeCoverageRawObservation, type NativeCoverageSourceLocation } from "./nativePlayerCoverage";
import * as kernel from "./nativePlayerCoverageKernel";

// All bytes, names, receipts and independent plans are invented mechanics fixtures.
const identity = { playerId: 101, nhlPlayerId: 10001, teamId: 1 };
const now = "2026-10-10T12:00:00.000Z", cutoff = "2026-10-10T16:15:00.000Z";
function raw(bodyUtf8: string, proofId = "synthetic-box"): NativeCoverageRawObservation {
  return { proofId, bodyUtf8, bodyHash: nativeCoverageTextHash(bodyUtf8), sourceSemanticVersion: "synthetic-v1",
    sourceSemanticHash: nativeCoverageTextHash("synthetic-semantics"), origin: "https://example.invalid/source", revision: "synthetic-revision",
    httpStatus: 200, requestedAt: "2026-10-10T10:00:00Z", firstReceivedAt: "2026-10-10T10:01:00Z",
    verifiedAt: "2026-10-10T10:02:00Z", publishedAt: null, access: "available", rights: "verified_for_intended_use",
    finalGames: [], completionFacts: [] };
}
function fixture() {
  const box = { id: 2026020001, season: 20262027, gameType: 2, gameState: "FINAL", homeTeam: { id: 1 },
    awayTeam: { id: 2 }, playerByGameStats: { homeTeam: { defense: [{ playerId: 10001, hits: 0, toi: "19:09" }] } } };
  const source = raw(JSON.stringify(box));
  source.finalGames = [{ historicalGameId: box.id, seasonId: box.season, teamId: 1,
    gameIdPointer: "/id", seasonIdPointer: "/season", teamIdPointer: "/homeTeam/id", finalStatePointer: "/gameState", finalStateValue: "FINAL" }];
  const { bodyUtf8: _bytes, ...expected } = source;
  const plan: NativeCoverageAssemblyPlan = { proofId: "derived-hit", targetGameId: 2026020070, teamId: 1, cutoffAt: cutoff,
    transformation: { version: "synthetic-transform", codeHash: nativeCoverageTextHash("synthetic-code"),
      configHash: nativeCoverageTextHash("synthetic-config"), semanticHash: nativeCoverageTextHash("synthetic-transform-semantics") },
    expectedContributors: [structuredClone(expected)], expectedRowIds: ["derived-hit-game1"], censusComplete: true };
  const game = { rowId: "derived-hit-game1", historicalGameId: box.id, historicalTeamId: 1, sourceProofId: source.proofId,
    playerPointer: "/playerByGameStats/homeTeam/defense/0", statisticalCredit: true,
    history: { completedAt: null, completion: { kind: "supported_bounds" as const, completedAt: null,
      completedNoEarlierThan: null, lowerEvidence: null, completedNoLaterThan: source.firstReceivedAt,
      upperEvidence: { kind: "final_body_receipt" as const, proofId: source.proofId, bodyHash: source.bodyHash },
      finalEvidence: { proofId: source.proofId, bodyHash: source.bodyHash, historicalGameId: box.id, seasonId: box.season, teamId: 1 } } } };
  return { box, source, plan, game };
}
function span(body: string, fragment: string): Extract<NativeCoverageSourceLocation, { kind: "utf8_byte_span" }> {
  const start = body.indexOf(fragment); if (start < 0) throw new Error("missing fixture fragment");
  return { kind: "utf8_byte_span", startByte: Buffer.byteLength(body.slice(0, start), "utf8"),
    endByteExclusive: Buffer.byteLength(body.slice(0, start + fragment.length), "utf8"), spanHash: nativeCoverageTextHash(fragment) };
}
function toiFixture() {
  const report = "<h1>Time On Ice Report Away Team</h1>", team = "<h2>SYNTHETIC CLUB</h2>",
    heading = '<td class="playerHeading">1 FAKE, GOALIE</td>';
  const values = [["1", "1", "0:00 / 20:00", "20:00 / 0:00", "20:00", "GP"],
    ["2", "2", "0:00 / 20:00", "20:00 / 0:00", "20:00", "GP"],
    ["3", "3", "0:00 / 20:00", "17:26 / 2:34", "17:26", "P"],
    ["4", "3", "18:22 / 1:38", "20:00 / 0:00", "01:38", ""],
    ["5", "OT", "0:00 / 5:00", "3:21 / 1:39", "03:21", "G"]];
  const fragments = values.map(cells => `<tr>${cells.map(value => `<td>${value}</td>`).join("")}</tr>`);
  const section = `<table><tr>${heading}</tr>${fragments.join("")}<tr><td>TOT</td><td>5</td></tr></table>`;
  const body = `<html>é🦉${report}${team}${section}</html>`, source = raw(body, "synthetic-html");
  const plan = { section: span(body, section), playerHeading: { location: span(body, heading), expectedText: "1 FAKE, GOALIE" },
    reportHeading: { location: span(body, report), expectedText: "Time On Ice Report Away Team" },
    teamHeading: { location: span(body, team), expectedText: "SYNTHETIC CLUB" }, shiftRows: fragments.map(value => span(body, value)) };
  return { source, plan, fragments, section };
}
function scratchFixture(layout: "sequential" | "columns" = "sequential", change = "valid") {
  const report = "<h1>Official Playing Roster</h1>", name = "FAKE PLAYER",
    row = `<tr><td>27</td><td>D</td><td>${name}</td></tr>`;
  let team: string, heading: string, body: string;
  if (layout === "sequential") {
    team = "<h2>SYNTHETIC CLUB</h2>"; heading = "<h3>Scratches</h3>";
    const contents = change === "active" ? `<h3>Players</h3><table>${row}</table>${heading}<table></table>`
      : change === "other_team" ? `${heading}<table></table><h2>OTHER CLUB</h2><h3>Players</h3><table>${row}</table>`
      : change === "later_section" ? `${heading}<table></table><h3>Players</h3><table>${row}</table>`
      : `${heading}<table>${row}</table>`;
    body = `<html>é🦉${report}${team}${contents}</html>`;
  } else {
    team = '<td class="teamHeading + border">SYNTHETIC CLUB</td>';
    heading = '<td colspan="2" class="header">Scratches</td>';
    const active = change === "active" ? row : "", own = change === "other_team" || change === "active" ? "" : row,
      other = change === "other_team" ? row : "";
    body = `<html>é🦉${report}<table><tr><td><table><tr>${team}<td class="teamHeading">OTHER CLUB</td></tr></table></td></tr>`
      + `<tr><td><table><tr><td><table>${active}</table></td><td><table></table></td></tr>`
      + `<tr>${heading}</tr><tr id="Scratches"><td><table>${own}</table></td><td><table>${other}</table></td></tr>`
      + "</table></td></tr></table></html>";
  }
  return { source: raw(body, "synthetic-roster"), plan: { reportHeading: { location: span(body, report), expectedText: "Official Playing Roster" },
    teamHeading: { location: span(body, team), expectedText: "SYNTHETIC CLUB" },
    scratchesHeading: { location: span(body, heading), expectedText: "Scratches" }, row: span(body, row),
    sweaterNumber: 27, position: "D", fullName: name } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("source-only offline assembly", () => {
  it("assembles literal BOX zero HIT/TOI and keeps true derivative times separate from HTTP receipt", () => {
    const f = fixture(), before = JSON.stringify(f), calculate = vi.spyOn(kernel, "calculateNativePlayerCoverageKernel");
    const result = assembleNativeHitHistory({ ...f.plan, identity, games: [f.game] }, [f.source]);
    expect(result).toMatchObject({ status: "proposed_for_independent_review", findings: [], qualificationEligible: false,
      independentOutputContractRequired: true, sourceSemanticsApproval: "not_established", modelInputs: "withheld" });
    expect(result.proof).toMatchObject({ publishedAt: null, firstReceivedAt: null, createdAt: now, verifiedAt: now });
    expect(JSON.parse(result.proof!.bodyUtf8)).toMatchObject({ kind: "hit_history", rows: [{ hits: 0, seconds: 1149, completedAt: null }] });
    const issues: string[] = [];
    checkNativeCoverageProof(result.proof!, undefined, cutoff, (_kind, code) => issues.push(code));
    expect(issues).toEqual(["proof_contract_binding"]); expect(calculate).not.toHaveBeenCalled(); expect(JSON.stringify(f)).toBe(before);
  });
  it("preserves missing HIT, malformed TOI and unknown credit without zero filling", () => {
    const f = fixture(); delete (f.box.playerByGameStats.homeTeam.defense[0] as { hits?: number }).hits;
    f.box.playerByGameStats.homeTeam.defense[0].toi = "19:99"; f.game.statisticalCredit = null as unknown as boolean;
    f.source.bodyUtf8 = JSON.stringify(f.box); f.source.bodyHash = nativeCoverageTextHash(f.source.bodyUtf8);
    const { bodyUtf8: _bytes, ...expected } = f.source; f.plan.expectedContributors = [expected];
    Object.assign(f.game.history.completion.upperEvidence, { bodyHash: f.source.bodyHash });
    Object.assign(f.game.history.completion.finalEvidence, { bodyHash: f.source.bodyHash });
    const result = assembleNativeHitHistory({ ...f.plan, identity, games: [f.game] }, [f.source]);
    expect(result.status).toBe("blocked"); expect(JSON.parse(result.proof!.bodyUtf8)).toMatchObject({ rows: [{ hits: null, seconds: null, statisticalCredit: null }],
      unclassifiedHits: null, unclassifiedSeconds: null });
    expect(result.findings.some(value => value.code === "unknown_hit_observation")).toBe(true);
  });
  it.each(["wrong_player", "wrong_game", "wrong_team", "nonfinal", "different_source_hash"])("blocks %s source identity", change => {
    const f = fixture();
    if (change === "wrong_player") f.game.playerPointer = "/missing";
    if (change === "wrong_game") f.game.historicalGameId++;
    if (change === "wrong_team") f.game.historicalTeamId++;
    if (change === "nonfinal") { f.box.gameState = "FUT"; f.source.bodyUtf8 = JSON.stringify(f.box); f.source.bodyHash = nativeCoverageTextHash(f.source.bodyUtf8); }
    if (change === "different_source_hash") f.source.bodyHash = "a".repeat(64);
    expect(assembleNativeHitHistory({ ...f.plan, identity, games: [f.game] }, [f.source])).toMatchObject({ status: "blocked", proof: null });
  });
  it.each(["expectation", "census", "rows", "rights", "late", "source_verification_after_derivative"])("keeps %s blocking independent of serialization", change => {
    const f = fixture();
    if (change === "expectation") f.plan.expectedContributors[0].revision = "another";
    if (change === "census") f.plan.censusComplete = null;
    if (change === "rows") f.plan.expectedRowIds = ["unrelated"];
    if (change === "rights") { f.source.rights = "unknown"; f.plan.expectedContributors[0].rights = "unknown"; }
    if (change === "late") vi.setSystemTime("2026-10-10T16:15:00.001Z");
    if (change === "source_verification_after_derivative") { f.source.verifiedAt = "2026-10-10T13:00:00Z"; f.plan.expectedContributors[0].verifiedAt = f.source.verifiedAt; }
    expect(assembleNativeHitHistory({ ...f.plan, identity, games: [f.game] }, [f.source]).status).toBe("blocked");
  });
  it("keeps source-only goalie observations separate from modeled drivers and C2 selection", () => {
    const f = fixture(); const body: kernel.NativeCoverageKernelSourceBody = { kind: "goalie_scenarios", teamId: 1,
      domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, rows: [{ rowId: f.game.rowId, historicalGameId: f.game.historicalGameId,
        ...f.game.history, starterRoleId: null, unclassifiedSeconds: 0, unclassifiedOpportunities: null,
        periods: [1, 2, 3].map(periodNumber => ({ periodNumber, periodType: "REG", seconds: 1200,
          teamShotsAgainst: null, teamNonShotGoalsAgainst: null, intervals: [{ intervalId: `observed-${periodNumber}`,
            startSecond: 0, endSecond: 1200, presence: "goalie", roleId: null, observedCounts: null,
            modeledShotsAgainst: null, modeledNonShotGoalsAgainst: null, emptyNetGoalsAgainst: null }] })) }] };
    const links = [{ proofId: f.source.proofId, bodyHash: f.source.bodyHash,
      location: { kind: "json_pointer" as const, pointer: "/id" }, derivedPointer: "/rows/0/historicalGameId" }];
    const result = assembleNativeCoverageProof(f.plan, [f.source], body, links);
    expect(result).toMatchObject({ status: "blocked", qualificationEligible: false, modelInputs: "withheld" });
    expect(result.proof).not.toHaveProperty("selection");
    body.rows[0].periods[0].intervals[0].modeledShotsAgainst = 3;
    expect(assembleNativeCoverageProof(f.plan, [f.source], body, links)).toMatchObject({ proof: null,
      findings: [{ code: "model_driver_in_source_assembly" }] });
  });
  it("blocks repeated v3 links in assembly and independent checking while accepting distinct links", () => {
    const f = fixture(), original = assembleNativeHitHistory({ ...f.plan, identity, games: [f.game] }, [f.source]);
    const proof = original.proof!, links = [...proof.links, structuredClone(proof.links[0])];
    const repeated = assembleNativeCoverageProof(f.plan, [f.source], JSON.parse(proof.bodyUtf8), links);
    expect(repeated.status).toBe("blocked"); expect(repeated.findings.some(value => value.code === "duplicate_derived_link")).toBe(true);
    const { bodyUtf8: _derivedBytes, ...metadata } = repeated.proof!;
    const contract = { ...metadata, contributors: metadata.contributors.map(({ bodyUtf8: _rawBytes, ...item }) => item) };
    const findings: string[] = [];
    checkNativeCoverageProof(repeated.proof!, contract, cutoff, (_kind, code) => findings.push(code));
    expect(findings).toEqual(["duplicate_derived_link"]);
    const distinct = [...proof.links, { ...proof.links[0], derivedPointer: "/identity/nhlPlayerId" }];
    expect(assembleNativeCoverageProof(f.plan, [f.source], JSON.parse(proof.bodyUtf8), distinct).status).toBe("proposed_for_independent_review");
  });
});
describe("strict reported HTML evidence", () => {
  it("reads five shifts including textual OT with original multibyte/astral byte spans", () => {
    const f = toiFixture(), rows = readNativeToiReport(f.source, f.plan);
    expect(rows).toHaveLength(5); expect(rows[4]).toMatchObject({ periodNumber: 4, periodType: "OT", startSecond: 0, endSecond: 201 });
    expect(rows.reduce((sum, row) => sum + row.endSecond - row.startSecond, 0)).toBe(3745);
    expect(3801 - rows.reduce((sum, row) => sum + row.endSecond - row.startSecond, 0)).toBe(56);
    expect(rows[2].eventMarkersAsReported).toBe("P"); expect(rows[2]).not.toHaveProperty("goaliePulled");
    expect(rows[0].derivedRowId).toMatch(/^derived-toi:/); expect(rows[0].source.location.startByte).toBeGreaterThan(f.source.bodyUtf8.indexOf(f.fragments[0]));
  });
  it.each(["omitted_row", "wrong_hash", "wrong_heading", "wrong_team", "out_of_section", "reordered"])("rejects %s", change => {
    const f = toiFixture();
    if (change === "omitted_row") f.plan.shiftRows.pop();
    if (change === "wrong_hash") f.plan.shiftRows[0].spanHash = "a".repeat(64);
    if (change === "wrong_heading") f.plan.playerHeading.expectedText = "99 OTHER, PLAYER";
    if (change === "wrong_team") f.plan.teamHeading.expectedText = "OTHER CLUB";
    if (change === "out_of_section") f.plan.section.endByteExclusive = f.plan.shiftRows[0].endByteExclusive;
    if (change === "reordered") f.plan.shiftRows.reverse();
    expect(() => readNativeToiReport(f.source, f.plan)).toThrow();
  });
  it("rejects another player section even when the intended name appears as ordinary text inside it", () => {
    const f = toiFixture(), intended = '<td class="playerHeading">1 FAKE, GOALIE</td>', mention = "<div>1 FAKE, GOALIE</div>",
      wrong = `<table><tr><td class="playerHeading">2 OTHER, GOALIE</td></tr><tr><td>${mention}</td></tr>${f.fragments.join("")}</table>`;
    const body = f.source.bodyUtf8.replace(f.section, `<table><tr>${intended}</tr></table>${wrong}`);
    const source = raw(body, f.source.proofId), plan = { ...f.plan, section: span(body, wrong),
      playerHeading: { location: span(body, mention), expectedText: "1 FAKE, GOALIE" }, shiftRows: f.fragments.map(row => span(body, row)) };
    expect(() => readNativeToiReport(source, plan)).toThrow("ambiguous_toi_player_section");
  });
  it("rejects a text-only heading span and shifts owned by another actual table", () => {
    const f = toiFixture();
    expect(() => readNativeToiReport(f.source, { ...f.plan,
      playerHeading: { location: span(f.source.bodyUtf8, "1 FAKE, GOALIE"), expectedText: "1 FAKE, GOALIE" } })).toThrow("html_field_element_binding");
    const heading = '<td class="playerHeading">1 FAKE, GOALIE</td>',
      section = `<div><table><tr>${heading}</tr></table><table>${f.fragments.join("")}</table></div>`,
      body = f.source.bodyUtf8.replace(f.section, section);
    expect(() => readNativeToiReport(raw(body), { ...f.plan, section: span(body, section),
      playerHeading: { location: span(body, heading), expectedText: "1 FAKE, GOALIE" }, shiftRows: f.fragments.map(row => span(body, row)) })).toThrow("toi_player_row_binding");
  });
  it("preserves scratch evidence without HIT0, GP inference or NHL ID fabrication", () => {
    const report = "<h1>Official Playing Roster</h1>", team = "<h2>SYNTHETIC CLUB</h2>", heading = "<h3>Scratches</h3>",
      row = "<tr><td>27</td><td>D</td><td>FAKE PLAYER</td></tr>", body = `<html>${report}${team}${heading}<table>${row}</table></html>`;
    const source = raw(body, "synthetic-roster"), plan = { reportHeading: { location: span(body, report), expectedText: "Official Playing Roster" },
      teamHeading: { location: span(body, team), expectedText: "SYNTHETIC CLUB" }, scratchesHeading: { location: span(body, heading), expectedText: "Scratches" },
      row: span(body, row), sweaterNumber: 27, position: "D", fullName: "FAKE PLAYER" };
    expect(readNativeScratchRecord(source, plan)).toMatchObject({ recordedScratch: true, HIT: null, statisticalCredit: null });
    expect(readNativeScratchRecord(source, plan)).not.toHaveProperty("nhlPlayerId");
    expect(() => readNativeScratchRecord(source, { ...plan, fullName: "OTHER" })).toThrow("scratch_identity");
  });
  it.each(["sequential", "columns"] as const)("binds the positive %s scratch section with original astral byte offsets", layout => {
    const f = scratchFixture(layout); expect(readNativeScratchRecord(f.source, f.plan)).toMatchObject({ recordedScratch: true, HIT: null, statisticalCredit: null });
  });
  it.each([["sequential", "active"], ["sequential", "other_team"], ["sequential", "later_section"],
    ["columns", "active"], ["columns", "other_team"]] as const)("rejects %s/%s row outside the bound team scratch section", (layout, change) => {
    const f = scratchFixture(layout, change); expect(() => readNativeScratchRecord(f.source, f.plan)).toThrow("scratch_team_section_binding");
  });
  it.each([["0:00", 0], ["03:21", 201], ["120:59", 7259], ["999:59", 59999],
    ["1:60", null], ["1:5", null], [" 1:05", null], ["1:05.1", null], ["-1:05", null], [100, null], [null, null]])(
    "matches strict literal clock grammar %j", (clock, seconds) => expect(nativeAssemblyClockSeconds(clock)).toBe(seconds));
});
