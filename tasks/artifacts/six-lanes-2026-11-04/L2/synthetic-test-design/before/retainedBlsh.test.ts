import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { DisplaySnapshot } from "../buyLowSellHigh/displayProfile";
import { RETAINED_BLSH_SHA256, RETAINED_BLSH_SIDECAR_SHA256, RETAINED_BLSH_PROVENANCE_REVIEW_SHA256, RETAINED_BLSH_BOX_PINS, retainedBlshEvidence, type RetainedBlshInput } from "./retainedBlsh";
const player = { id: 8476453, team: "TBL" };
const fixture = (): RetainedBlshInput => ({ snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract; actual bytes verified separately by owner reader", metadata: { schemaVersion: "fhfh.blsh.current-research-snapshot.v2", scoreVersion: "support-conditioned-production-gap-v1", seasonId: 20262027, provisional: true, exploratory: true, productionAdopted: false, trusted: false, confidenceProbability: null, issuedAtUTC: null, asOfUTC: "2026-10-29T18:41:12Z", eventThroughDate: "2026-10-28", limits: ["Synthetic test; stale development reference"] }, profile: { playerId: player.id, team: player.team, score: { version: "support-conditioned-production-gap-v1", gapSign: "buy_low_evidence", statusLabel: "Direction agrees", calibratedProbability: null }, evidence: { window: { games: 1, dates: ["2026-10-24"], sourceIds: [123], minutes: 20 }, reference: { personalGames: 50, ageDays: 900 }, tierNote: "Coverage is not confidence" }, tracks: ["FP", "G+A", "Game Score"].map(label => ({ label, observed: 2, supportConditioned: 3, gap: 1 })), coverage: { notes: [{ text: "Source revision unverified" }] }, context: { opportunity: [{ label: "TOI", current: 1200, units: "seconds/appearance" }] }, claims: { forecast: false, marketValue: false, trusted: false } } } as unknown as RetainedBlshInput);
describe("retained BLSH card evidence", () => {
  it("preserves a withheld direction even when the saved gap is positive or negative", () => {
    for (const gapSign of ["buy_low_evidence", "sell_high_evidence"] as const) {
      const f = fixture();
      Object.assign(f.profile.score, { gapSign, directionWithheldReason: "insufficient_personal_history_list_withheld", directionWithheldText: "Direction withheld: insufficient personal history" });
      const result = retainedBlshEvidence(player, 20262027, f);
      expect(result.direction).toBe("unknown");
      expect(result.lines).toContain("Direction withheld: insufficient personal history");
    }
  });
  const withProvenance = () => {
    const f = fixture();
    f.provenance = { version: "fhfh.blsh.player-card-research-provenance.v1", sidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, snapshotSHA256: RETAINED_BLSH_SHA256, independentReviewPending: true, generatedAtUTC: "2026-11-01T16:32:16.987Z", asOfUTC: f.metadata.asOfUTC, eventThroughDate: f.metadata.eventThroughDate, maxCaptureAgeHours: 24, playerId: player.id, team: player.team, season: 20262027, rows: [{ sourceId: 123, gameId: 2026020177, playerId: player.id, season: 20262027, date: "2026-10-24", team: "TBL", regularSeasonCalendarMatched: true, finalityEstablished: false }], limitations: ["No NST model revision receipt"] };
    return f;
  };
  const withBoxes = () => {
    const f = withProvenance();
    f.provenance!.review = { reference: "Original review fixture", sha256: RETAINED_BLSH_PROVENANCE_REVIEW_SHA256, sidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, scope: "dated-stale-research-only" };
    f.currentBoxes = { version: "fhfh.card-retained-box-comparison.v1", rowsSHA256: RETAINED_BLSH_BOX_PINS.rows, boxEvidenceSHA256: RETAINED_BLSH_BOX_PINS.boxes, receiptSHA256: RETAINED_BLSH_BOX_PINS.receipt, sourceSidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, snapshotSHA256: RETAINED_BLSH_SHA256, wgoCapturedAt: f.metadata.asOfUTC, review: { reference: "Box review fixture", sha256: RETAINED_BLSH_BOX_PINS.review, scope: "dated-source-comparison-only" }, rows: [{ sourceId: 123, playerId: player.id, gameId: 2026020177, date: "2026-10-24", wgoTeam: "TBL", sourceRowSHA256: "a".repeat(64), state: "identity_team_exposure_qualified", gameFinality: "final", appearance: "positive_official_TOI", team: "match", TOI: { wgo: 1200, official: 1200, state: "match" }, counts: { goals: { wgo: 0, official: 0, state: "match" }, assists: { wgo: 1, official: 1, state: "match" }, shots: { wgo: 2, official: 2, state: "match" }, hits: { wgo: 0, official: 0, state: "match" }, blocked_shots: { wgo: 0, official: 0, state: "match" } }, PPP: { wgo: 0, official: null, state: "unknown_PP_assists_not_supplied" }, reasons: [], officialTeam: "TBL", officialTeamId: 14, evidenceGameId: 2026020177, box: { url: "https://api-web.nhle.com/v1/gamecenter/2026020177/boxscore", bodySHA256: "b".repeat(64), receiptSHA256: "c".repeat(64), retrievedAtUTC: "2026-10-27T20:15:08Z", originalPublicationUTC: null } }] };
    return f;
  };
  it("preserves count discrepancies even when identity, team and exposure qualify", () => {
    const f = withBoxes(), row = f.currentBoxes!.rows[0];
    row.counts.goals = { wgo: 1, official: 0, state: "mismatch" };
    const r = retainedBlshEvidence(player, 20262027, f), boxes = r.retained!.currentBoxes!;
    expect(boxes).toMatchObject({ state: "reviewed-comparison-only", currentBinding: false });
    expect(boxes.summary).toContain("0 match / 1 differ / 0 unknown");
    expect(boxes.summary).toContain("G differ");
    expect(boxes.lines.join(" ")).toContain("G differs: WGO 1, box 0");
    expect(boxes.evidence!.rows[0].state).toBe("identity_team_exposure_qualified");
    expect(r.retained!.profile).toEqual(f.profile); expect(r.receipt).toBeNull();
    row.counts.goals.wgo = 8;
    expect(boxes.evidence!.rows[0].counts.goals!.wgo).toBe(1);
  });
  it("limits full matches to exposure and the five counts while preserving unknown PPP", () => {
    const r = retainedBlshEvidence(player, 20262027, withBoxes()), boxes = r.retained!.currentBoxes!;
    expect(boxes.summary).toContain("1 match / 0 differ / 0 unknown");
    expect(boxes.summary).toContain("TOI + 5 counts");
    expect(boxes.summary).toContain("PPP 1 unknown");
    expect(boxes.lines.join(" ")).toContain("Match covers TOI plus G/A/SOG/HIT/BLK only");
    expect(boxes.lines.join(" ")).toContain("no current or advanced-metric admission");
    expect(boxes.evidence!.rows[0].PPP!.official).toBeNull();
    expect(r.retained!.provenance!.sourceMap!.rows[0].finalityEstablished).toBe(false);
  });
  it("retains missing boxes as unknown and exposure mismatches as differences", () => {
    const f = withBoxes(), row = f.currentBoxes!.rows[0];
    row.state = "held"; row.TOI = { wgo: 1200, official: 1199, state: "mismatch" };
    expect(retainedBlshEvidence(player, 20262027, f).retained!.currentBoxes!.summary).toContain("TOI differ");
    Object.assign(row, { gameFinality: "unknown", appearance: "unknown", team: "unknown", TOI: null, counts: {}, PPP: null, evidenceGameId: null, box: null, reasons: ["no_pinned_cached_official_box"] });
    const boxes = retainedBlshEvidence(player, 20262027, f).retained!.currentBoxes!;
    expect(boxes.summary).toContain("0 match / 0 differ / 1 unknown");
    expect(boxes.lines.join(" ")).toContain("Missing boxes are not DNP or zero");
    expect(boxes.evidence!.rows[0].counts).toEqual({});
  });
  it("withholds invalid or promoted box attachments without replacing saved research", () => {
    for (const change of [
      (f: RetainedBlshInput) => { f.currentBoxes!.review.sha256 = "d".repeat(64); },
      (f: RetainedBlshInput) => { f.currentBoxes!.rowsSHA256 = "d".repeat(64); },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].playerId = 1; },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].officialTeam = "TOR"; },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].counts.goals!.wgo = 1; },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].PPP = { wgo: 0, official: 0, state: "match" }; },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].box!.retrievedAtUTC = "2026-11-01T00:00:00Z"; },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows.push(f.currentBoxes!.rows[0]); },
      (f: RetainedBlshInput) => { f.currentBoxes!.rows[0].gameFinality = "unknown"; },
    ]) {
      const f = withBoxes(); change(f); const r = retainedBlshEvidence(player, 20262027, f);
      expect(r.retained!.currentBoxes).toMatchObject({ state: "unavailable", evidence: null, currentBinding: false });
      expect(r.retained!.profile).toEqual(f.profile); expect(r.status).toBe("exploratory"); expect(r.receipt).toBeNull();
    }
  });
  it("attaches pending source lineage without admitting stale research as current input", () => {
    const f = withProvenance(), r = retainedBlshEvidence(player, 20262027, f);
    expect(r.retained?.provenance).toMatchObject({ state: "pending-review", captureStale: true, currentBinding: false });
    expect(r.retained?.provenance?.message).toContain("Finality evidence for 0/1 rows");
    expect(r.retained?.provenance?.message).toContain("Independent sidecar review pending");
    expect(r.lines[0]).toContain("recorded game rows");
    expect(r.receipt).toBeNull();
    f.provenance!.rows[0].gameId = 1;
    expect(r.retained?.provenance?.sourceMap?.rows[0].gameId).toBe(2026020177);
  });
  it("binds the independent review only to its exact stale-research scope", () => {
    const f = withProvenance();
    f.provenance!.review = { reference: "tasks/artifacts/rso-blsh-independent-review-2026-11-01/PROVENANCE-REVIEW.md", sha256: RETAINED_BLSH_PROVENANCE_REVIEW_SHA256, sidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, scope: "dated-stale-research-only" };
    const r = retainedBlshEvidence(player, 20262027, f);
    expect(r.retained?.provenance).toMatchObject({ state: "reviewed-retained-only", currentBinding: false, captureStale: true });
    expect(r.retained?.provenance?.sourceMap?.independentReviewPending).toBe(true);
    expect(r.retained?.provenance?.message).toContain("Independently reviewed for dated stale research only");
    expect(r.receipt).toBeNull();
    f.provenance!.review.sha256 = "a".repeat(64);
    expect(retainedBlshEvidence(player, 20262027, f).retained?.provenance?.state).toBe("unavailable");
    f.provenance!.review.sha256 = RETAINED_BLSH_PROVENANCE_REVIEW_SHA256;
    f.provenance!.review.scope = "current" as "dated-stale-research-only";
    expect(retainedBlshEvidence(player, 20262027, f).retained?.provenance?.state).toBe("unavailable");
  });
  it("withholds invalid lineage but preserves independently qualified retained values", () => {
    for (const change of [
      (f: RetainedBlshInput) => { f.provenance!.sidecarSHA256 = "a".repeat(64); },
      (f: RetainedBlshInput) => { f.provenance!.rows[0].sourceId = 999; },
      (f: RetainedBlshInput) => { f.provenance!.rows[0].date = "2026-10-23"; },
      (f: RetainedBlshInput) => { f.provenance!.playerId = 1; },
      (f: RetainedBlshInput) => { f.provenance!.asOfUTC = "2026-10-30T00:00:00Z"; },
      (f: RetainedBlshInput) => { f.provenance!.rows.push(f.provenance!.rows[0]); },
      (f: RetainedBlshInput) => { f.provenance!.independentReviewPending = false as true; },
    ]) {
      const f = withProvenance(); change(f);
      const r = retainedBlshEvidence(player, 20262027, f);
      expect(r.status).toBe("exploratory");
      expect(r.lines.join(" ")).toContain("recorded 2.00; support-conditioned 3.00");
      expect(r.retained?.provenance).toMatchObject({ state: "unavailable", currentBinding: false, sourceMap: null });
      expect(r.receipt).toBeNull();
    }
  });
  it("displays actual supplied values on a separately dated window and preserves full evidence", () => {
    const f = fixture(), r = retainedBlshEvidence(player, 20262027, f);
    expect(r.status).toBe("exploratory"); expect(r.lines.join(" ")).toContain("recorded 2.00; support-conditioned 3.00");
    expect(r.lines.join(" ")).toContain("NHL controls do not change this evidence window");
    expect(r.lines.join(" ")).toContain("stale development history");
    expect(r.receipt).toBeNull(); expect(r.retained?.profile).toEqual(f.profile);
    f.profile.tracks[0].observed = 100; expect(r.retained?.profile.tracks[0].observed).toBe(2);
  });
  it("rejects unreviewed bytes, changed identity and promoted research claims", () => {
    for (const change of [(f: RetainedBlshInput) => { f.snapshotSHA256 = "a".repeat(64); }, (f: RetainedBlshInput) => { f.profile.playerId = 1; }, (f: RetainedBlshInput) => { f.profile.team = "TOR"; }, (f: RetainedBlshInput) => { (f.metadata as any).productionAdopted = true; }, (f: RetainedBlshInput) => { (f.profile.claims as any).forecast = true; }]) {
      const f = fixture(); change(f); expect(retainedBlshEvidence(player, 20262027, f).status).toBe("unavailable");
    }
  });
  it("rejects incomplete saved windows and unavailable support instead of manufacturing neutrality", () => {
    const f = fixture(); f.profile.evidence.window.sourceIds = [];
    expect(retainedBlshEvidence(player, 20262027, f).status).toBe("unavailable");
    const other = fixture(); other.profile.tracks[1].gap = NaN;
    expect(retainedBlshEvidence(player, 20262027, other).status).toBe("unavailable");
  });
  it("keeps saved window age separate from missing production and preserves raw diagnostics", () => {
    const bytes = readFileSync(resolve(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json"));
    expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(RETAINED_BLSH_SHA256);
    const { profiles, ...metadata } = JSON.parse(bytes.toString()) as DisplaySnapshot;
    const input = (profile: DisplaySnapshot["profiles"][number]): RetainedBlshInput => ({ profile, metadata, snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Pinned research review; no current admission" });
    const render = (p: DisplaySnapshot["profiles"][number]) => {
      if (!p.team) throw new Error("Retained test profile lacks a qualified team");
      return retainedBlshEvidence({ id: p.playerId, team: p.team }, metadata.seasonId, input(p));
    };
    const benn = profiles.find(p => p.playerId === 8473994)!;
    expect(benn.evidence.window).toMatchObject({ lastGameDaysBeforeRecordedThrough: 1, fresh: false });
    expect(benn.evidence.window.freshnessText).toContain("stale window");
    expect(benn.tracks).toEqual([]); expect(render(benn).status).toBe("unavailable");
    const recentMissing = profiles.filter(p => p.evidence.window.lastGameDaysBeforeRecordedThrough !== null && p.evidence.window.lastGameDaysBeforeRecordedThrough <= 7 && p.score.value === null && !p.evidence.window.fresh);
    expect(recentMissing).toHaveLength(137);
    for (const p of recentMissing) {
      const before = JSON.stringify(p), result = render(p);
      expect(result.status).toBe("unavailable");
      expect(result.lines.join(" ")).not.toContain("stale window");
      expect(JSON.stringify(p)).toBe(before);
    }
    const wilson = profiles.find(p => p.playerId === 8475253)!, before = JSON.stringify(wilson), result = render(wilson);
    expect(wilson.evidence.window.lastGameDaysBeforeRecordedThrough).toBe(11);
    expect(result.status).toBe("exploratory"); expect(result.lines.join(" ")).not.toContain("stale window");
    expect(result.retained?.profile).toEqual(wilson); expect(result.retained?.profile.score.value).toBe(43.86735762626921);
    expect(result.retained?.profile.evidence.window.freshnessText).toBe(wilson.evidence.window.freshnessText);
    expect(JSON.stringify(wilson)).toBe(before);
  });
});
