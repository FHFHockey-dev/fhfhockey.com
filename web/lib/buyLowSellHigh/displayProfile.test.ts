// @vitest-environment node
/** Display mapper tests on real saved profiles (unmodified lines from the pinned dry-run-v4 A + overlay file),
 * plus an opt-in step that packages the provisional candidate snapshot.
 *
 * BLSH_DISPLAY_OUT  optional: a new candidate path inside display-snapshot-v2/; writes the candidate and a receipt beside it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Profile } from "./currentWindows";
import { buildDisplaySnapshot, NO_PERSONAL_HISTORY_LIST_WITHHELD, reasonText, toDisplayProfile, type ReferencePolicy } from "./displayProfile";
import { currentResearchLists, currentStateLabel } from "./researchSnapshot";

const ROOT = join(__dirname, "../../..");
const ARTIFACTS = join(ROOT, "tasks/artifacts/blsh-independent-review-2026-10-28");
const FIXTURE = join(ARTIFACTS, "display-snapshot-v2/fixtures/PROFILES-FIXTURE.jsonl");
const SOURCE = join(ARTIFACTS, "dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl");
const SUMMARY = join(ARTIFACTS, "dry-run-v4/SUMMARY.json");
const PINS = {
  fixture: "bed954ae624b1877c67fa80c5b5615c471b408655367a5e7805f9be37c32ba33",
  source: "f8734686d13b78baf28ee12f0133c940a03f8171ff0510ec4c7a9b6f2286378b",
  summary: "eb714e1f8613844123bb8b2d3732e4952b8cadea51651be483bb5d41e369947e",
};
const sha256 = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const readPinned = (path: string, pin: string) => {
  const bytes = readFileSync(path);
  if (sha256(bytes) !== pin) throw new Error(`Pin mismatch: ${path}`);
  return bytes.toString("utf8");
};
const lines = (text: string) => text.split("\n").filter(Boolean).map(l => JSON.parse(l) as Profile);
const fixtures = lines(readPinned(FIXTURE, PINS.fixture));
const byId = (id: number) => structuredClone(fixtures.find(p => p.playerId === id)!);
const CASES = { burns: 8470613, thin: 8475413, sh: 8471215, wilson: 8475253, unavailable: 8473419, conflicting: 8474563, zeroShot: 8475795, stale: 8475718, oldest: 8478173, short: 8473422 };
const RECORDED = "2026-10-26";
const POLICY: ReferencePolicy = {
  arm: "A_development_reference", inputs: "official_receipt_overlay", provisional: true, stale: true, selectedBy: "TJ", selectedAtUTC: "2026-10-29T13:15:25Z",
  label: "Reference: 2022-24 development history (stale; each player's reference age is shown). Current games: NHL WGO with the official-receipt research overlay for on-ice goals.",
};
const snapshot = (profiles: Profile[], o: Partial<Parameters<typeof buildDisplaySnapshot>[0]> = {}) => buildDisplaySnapshot({
  profiles, referencePolicy: POLICY, assemblerVersion: "blsh-current-windows-dry-run-v4", seasonId: 20262027,
  eventThroughDate: RECORDED, asOfUTC: "2026-10-28T03:51:05.140251+00:00", packagedAtUTC: "2026-10-29T14:00:00.000Z", sourcePins: { profiles: PINS.source }, ...o,
});
const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);

describe("displayProfile: handoff v2 mapping on real saved profiles", () => {
  const snap = snapshot(fixtures);
  const get = (id: number) => snap.profiles.find(p => p.playerId === id)!;

  it("keeps every profile and gives every recorded reason a text", () => {
    expect(snap.profiles.map(p => p.playerId).sort()).toEqual(fixtures.map(p => p.playerId).sort());
    const notes = snap.profiles.flatMap(p => p.coverage.notes);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every(n => n.text && !n.text.startsWith("Unavailable: " + n.reason))).toBe(true);
    // Comparison reasons too: every current, reference and delta reason resolves to a written text, never the raw code.
    const comparisons = snap.profiles.flatMap(p => [...p.context.opportunity, ...p.context.signals]);
    const pairs = comparisons.flatMap(c => [[c.reason, c.reasonText], [c.referenceReason, c.referenceReasonText], [c.deltaReason, c.deltaReasonText]] as const).filter(([r]) => r !== null);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.filter(([r, t]) => !t || t === `Unavailable: ${r}`)).toEqual([]);
    expect(reasonText("something_new")).toBe("Unavailable: something_new");
  });
  it("shows an unavailable score as an unavailable tier with its reason, never as provisional", () => {
    const p = get(CASES.unavailable);
    expect(p.score).toMatchObject({ value: null, status: "unavailable", list: null, rank: null });
    expect(p.score.reasonText).toMatch(/^Score unavailable/);
    expect(p.evidence).toMatchObject({ tier: null, tierLabel: "Unavailable: no score" });
    expect(p.tracks).toEqual([]);
    expect(get(CASES.burns).evidence.tierLabel).toBe("Provisional: estimated or extrapolated");
    expect(get(CASES.sh).evidence.tierLabel).toBe("Measured process, personal reference");
  });
  it("words an absent reference window as absence, not as a mismatch", () => {
    const p = get(CASES.wilson);
    expect(p.evidence.reference).toMatchObject({ personalGames: 0, ageDays: null, ageText: "No personal reference window" });
    expect(p.coverage.context.reference).toEqual({ verified: false, reason: "reference_window_not_supplied", text: "No personal reference window supplied; context comparison unavailable" });
    expect(strings(p).some(s => s.includes("could not be matched"))).toBe(false);
  });
  it("counts games only for slot notes; profile-level notes carry no game count", () => {
    const notes = snap.profiles.flatMap(p => p.coverage.notes.filter(n => n.source === "slot"));
    expect(notes.filter(n => ["current_window_slot", "reference_slot"].includes(n.component)).every(n => Number.isInteger(n.games) && n.games! > 0)).toBe(true);
    const profileLevel = notes.filter(n => !["current_window_slot", "reference_slot"].includes(n.component));
    expect(profileLevel.map(n => n.component)).toEqual(expect.arrayContaining(["personal_reference", "current_window"]));
    expect(profileLevel.every(n => n.games === null)).toBe(true);
  });
  it("shows each profile's own reference age and anchors freshness to the recorded-through date", () => {
    expect(get(CASES.oldest).evidence.reference.ageDays).toBe(1451);
    expect(get(CASES.oldest).evidence.reference.ageText).toMatch(/^Reference ends 1451 days before the window/);
    expect(get(CASES.burns).evidence.window.freshnessText).toBe(`Last game ${get(CASES.burns).evidence.window.lastGameDaysBeforeRecordedThrough} days before the recorded-through date (${RECORDED})`);
    const stale = get(CASES.stale).evidence.window;
    expect(stale.fresh).toBe(false);
    expect(stale.lastGameDaysBeforeRecordedThrough!).toBeGreaterThan(7);
    expect(stale.freshnessText).toMatch(/stale window; withheld from lists$/);
    expect(strings(snap.profiles).some(s => /as-of date|up to ~900/.test(s))).toBe(false);
  });
  it("labels normalization separately from the bounded index and reconciles both sums", () => {
    const p = get(CASES.burns);
    expect(p.score.normalizedGap).toBeCloseTo(1.3153743209023174, 12);
    expect(p.score.value).toBeCloseTo(56.81043920318279, 10);
    const sum = p.tracks.reduce((s, t) => s + t.normalizedGapContribution, 0);
    expect(sum).toBeCloseTo(p.score.normalizedGap!, 12);
    p.tracks.forEach(t => expect(t.componentSum).toBeCloseTo(t.gap, 12));
    expect(strings(snap).some(s => /share of the index/i.test(s))).toBe(false);
  });
  it("shows estimator weights as decimals and never as percentages or confidence", () => {
    for (const p of snap.profiles) {
      const { estimatorWeight: w, cohortEstimatorWeight: c } = p.evidence.reference;
      if (w !== null) { expect(w).toBeGreaterThanOrEqual(0); expect(w).toBeLessThanOrEqual(1); expect(c).toBeCloseTo(1 - w, 12); }
      expect(p.evidence.calibratedProbability).toBeNull();
    }
    expect(strings(snap).some(s => /\d%|percent confidence/.test(s))).toBe(false);
  });
  it("keeps a zero-shot player listed with zero shown as a value", () => {
    const p = get(CASES.zeroShot);
    expect(p.context.signals.find(s => s.metric === "shots_per_60")).toMatchObject({ current: 0, status: "available" });
    expect(p.score.list).not.toBeNull();
    expect(p.score.rank).toBeGreaterThan(0);
  });
  it("keeps context as hypotheses and carries thin personal references visibly", () => {
    const p = get(CASES.thin);
    expect(p.evidence.tier).toBe("measured_process_personal_reference");
    expect(p.evidence.reference.personalGames).toBeLessThanOrEqual(4);
    expect(p.context.heading).toBe("Context, not part of the score");
    expect(p.context.signals.every(s => s.scoreInput === false && s.interpretation === "hypothesis" && s.hypotheses.length >= 2)).toBe(true);
    expect(get(CASES.conflicting).score).toMatchObject({ list: null, rank: null, statusLabel: "Production and support disagree; withheld from lists" });
  });
  it("ranks each list contiguously by the frozen order and keeps every withheld profile", () => {
    for (const side of ["BL", "SH"] as const) {
      const ranks = snap.profiles.filter(p => p.score.list === side).map(p => p.score.rank!).sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    }
    expect(snap.counts.withheld).toBe(snap.profiles.filter(p => p.score.list === null).length);
    expect(snap.counts.profiles).toBe(fixtures.length);
    expect(snap).toMatchObject({ trusted: false, productionAdopted: false, confidenceProbability: null, issuedAtUTC: null, provisional: true, exploratory: true });
  });
  it("withholds a would-be listed profile with no personal history and says why", () => {
    const p = byId(CASES.burns);
    p.reference.personalN = 0;
    (p.production as { personal_n?: number }).personal_n = 0;
    expect(p.result.researchList).toBe("BL"); // The frozen score still lists it by direction alone.
    const text = reasonText(NO_PERSONAL_HISTORY_LIST_WITHHELD)!;
    expect(text).toMatch(/^Withheld from lists: no personal history/);
    expect(toDisplayProfile(p, null, RECORDED).score).toMatchObject({ list: null, rank: null, listLabel: "Withheld; inspect evidence", reason: NO_PERSONAL_HISTORY_LIST_WITHHELD, reasonText: text });
    expect(() => toDisplayProfile(p, 1, RECORDED)).toThrow("withheld profile has no rank");
    const gated = snapshot([...fixtures.filter(f => f.playerId !== CASES.burns), p]);
    const shown = gated.profiles.find(x => x.playerId === CASES.burns)!;
    expect(currentResearchLists(gated).withheld).toContain(shown);
    expect(currentStateLabel(shown)).toMatch(/^Withheld from lists: no personal history/);
    expect(gated.counts).toMatchObject({ BL: snap.counts.BL - 1, SH: snap.counts.SH, withheld: snap.counts.withheld + 1, withheldNoPersonalHistory: 1 });
    const ranks = gated.profiles.filter(x => x.score.list === "BL").map(x => x.score.rank!).sort((a, b) => a - b);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    expect(snap.counts.withheldNoPersonalHistory).toBe(0);
    expect(get(CASES.burns).score).toMatchObject({ list: "BL", reason: null, reasonText: null });
  });
});

describe("displayProfile: fails closed instead of displaying drifted values", () => {
  it("refuses components that no longer add to the gap", () => {
    const p = byId(CASES.burns);
    (p.explanation.tracks[0].components[0] as { value: number }).value += 0.5;
    expect(() => toDisplayProfile(p, 1, RECORDED)).toThrow("components add to the gap");
  });
  it("refuses changed claims, a missing rank or a rank on a withheld profile", () => {
    const claimed = byId(CASES.sh);
    (claimed.explanation.claims as { forecast: boolean }).forecast = true;
    expect(() => toDisplayProfile(claimed, 1, RECORDED)).toThrow("claims");
    expect(() => toDisplayProfile(byId(CASES.sh), null, RECORDED)).toThrow("list member has a rank");
    expect(() => toDisplayProfile(byId(CASES.conflicting), 3, RECORDED)).toThrow("withheld profile has no rank");
  });
  it("refuses a withheld context with no recorded reason", () => {
    const p = byId(CASES.wilson);
    p.explanation.coverage = p.explanation.coverage.filter(n => n.component !== "reference_window_context");
    expect(() => toDisplayProfile(p, null, RECORDED)).toThrow("reference context withheld without a recorded reason");
  });
  it("refuses another arm, duplicate players and a packaging time before capture", () => {
    expect(() => snapshot(fixtures, { referencePolicy: { ...POLICY, arm: "B_development_plus_2026_prefix" } })).toThrow("selected reference arm");
    expect(() => snapshot([...fixtures, byId(CASES.sh)])).toThrow("Duplicate");
    expect(() => snapshot(fixtures, { packagedAtUTC: "2026-10-27T00:00:00Z" })).toThrow("packaging time");
  });
});

const out = process.env.BLSH_DISPLAY_OUT;
describe.skipIf(!out)("displayProfile: provisional A + official-overlay candidate snapshot (opt-in, local)", () => {
  it("packages all 725 saved profiles without recomputing a score", () => {
    if (existsSync(out!) || dirname(out!) !== join(ARTIFACTS, "display-snapshot-v2")) throw new Error("Output must be a new file in display-snapshot-v2/");
    const summary = JSON.parse(readPinned(SUMMARY, PINS.summary));
    const profiles = lines(readPinned(SOURCE, PINS.source));
    const snap = snapshot(profiles, { assemblerVersion: summary.version, eventThroughDate: summary.eventThroughDate, asOfUTC: summary.asOfUTC, packagedAtUTC: new Date().toISOString(),
      sourcePins: { profiles: PINS.source, dryRunSummary: PINS.summary, ...summary.pins } });
    // Exact counts of the pinned source (Astra re-review of CLAUDE-122/124).
    // Mapper v2 withholds the 117 listed no-personal-history profiles (76 BL, 41 SH; frozen rule alone: 360 BL, 223 SH).
    expect(snap.counts).toEqual({ profiles: 725, numeric: 673, BL: 284, SH: 182, withheld: 259, withheldNoPersonalHistory: 117, unavailableTier: 52, referenceContextAbsent: 151,
      zeroShotWindows: 19, zeroShotNumeric: 15, zeroShotListed: 3, personalReference1to4: 36, referenceAgeDays: { n: 574, min: 894, max: 1451 } });
    const slotNotes = snap.profiles.flatMap(p => p.coverage.notes.filter(n => n.source === "slot"));
    expect(slotNotes.filter(n => n.component === "personal_reference" && n.games === null)).toHaveLength(151);
    expect(slotNotes.filter(n => n.component === "current_window" && n.games === null)).toHaveLength(112);
    // Scores are carried, never recomputed: every value equals its saved result.
    const saved = new Map(profiles.map(p => [p.playerId, p.result.value]));
    expect(snap.profiles.every(p => p.score.value === saved.get(p.playerId))).toBe(true);
    const fallbacks = snap.profiles.flatMap(p => [...p.context.opportunity, ...p.context.signals].flatMap(c => [[c.reason, c.reasonText], [c.referenceReason, c.referenceReasonText], [c.deltaReason, c.deltaReasonText]])
      .concat(p.coverage.notes.map(n => [n.reason, n.text]), [[p.score.reason, p.score.reasonText]]).filter(([r, t]) => r !== null && (!t || t === `Unavailable: ${r}`)));
    expect(fallbacks).toEqual([]);
    const text = JSON.stringify(snap) + "\n";
    writeFileSync(out!, text, { flag: "wx" });
    const bytes = readFileSync(out!);
    const self = (name: string) => sha256(readFileSync(join(__dirname, name)));
    writeFileSync(join(dirname(out!), `${basename(out!, ".json")}.RECEIPT.json`), JSON.stringify({
      candidate: { path: `tasks/artifacts/blsh-independent-review-2026-10-28/display-snapshot-v2/${basename(out!)}`, sha256: sha256(bytes), bytes: statSync(out!).size },
      schemaVersion: snap.schemaVersion, mapperVersion: snap.mapperVersion, handoffVersion: snap.handoffVersion, packagedAtUTC: snap.packagedAtUTC,
      mapper: { "web/lib/buyLowSellHigh/displayProfile.ts": self("displayProfile.ts"), "web/lib/buyLowSellHigh/displayProfile.test.ts": self("displayProfile.test.ts") },
      source: { profiles: { path: "tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl", sha256: PINS.source, bytes: statSync(SOURCE).size },
        dryRunSummary: { path: "tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json", sha256: PINS.summary } },
      counts: snap.counts, referencePolicy: snap.referencePolicy, database: false, network: false, scoreRecomputed: false,
      canonicalTarget: "web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json (Codex installs and pins; not written here)",
    }, null, 2) + "\n", { flag: "wx" });
  }, 300_000);
});
