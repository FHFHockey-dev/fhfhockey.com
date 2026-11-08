// @vitest-environment node
/** Authored synthetic defaults plus lazy retained empirical checks (BLSH_RETAINED_TEST_ROOT),
 * plus an opt-in step that packages the provisional candidate snapshot.
 *
 * BLSH_DISPLAY_OUT  optional: a new candidate path inside display-snapshot-v2/; writes the candidate and a receipt beside it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { retainedBytes, retainedEnabled, retainedSuite } from "./__fixtures__/retainedData";
import { syntheticProfile } from "./__fixtures__/syntheticProfiles";
import type { Profile } from "./currentWindows";
import { RETAINED_BLSH_SHA256, retainedBlshEvidence } from "../player-cards/retainedBlsh";
import {
  BLSH_LIST_TOP_N, buildDisplaySnapshot, HEADLINE_TRACK_CONFLICT_LIST_WITHHELD, HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD, INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD,
  listWithheldReason, personalHistoryReason, NO_PERSONAL_HISTORY_LIST_WITHHELD, OPPORTUNITY_NOT_ATTACHED, PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD, reasonText, SHORT_WINDOW_LIST_WITHHELD, toDisplayProfile,
  type MappedProfile, type ReferencePolicy,
} from "./displayProfile";
import { compareOpportunity, OPPORTUNITY_VERSION, PERSISTENCE_NOTE, summarizeOpportunityHistory, type OpportunityGame } from "./opportunity";
import { currentResearchLists, currentStateLabel } from "./researchSnapshot";

const ROOT = join(__dirname, "../../..");
const ARTIFACTS = join(ROOT, "tasks/artifacts/blsh-independent-review-2026-10-28");
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
let fixtures: Profile[];
const byId = (id: number) => structuredClone(fixtures.find(p => p.playerId === id)!);
const CASES = { burns: 8470613, thin: 8475413, sh: 8471215, wilson: 8475253, unavailable: 8473419, conflicting: 8474563, zeroShot: 8475795, stale: 8475718, oldest: 8478173, short: 8473422 };
const R1 = { rank: 1, positionRank: 1 };
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

describe.skipIf(!retainedEnabled)(retainedSuite, () => {
  beforeAll(() => { fixtures = lines(retainedBytes("profiles").toString("utf8")); });
describe("displayProfile: handoff v2 mapping on real saved profiles", () => {
  it("distinguishes unknown source coverage from confirmed no personal history", () => {
    const p = byId(CASES.wilson);
    p.reference.historyStatus = "unknown";
    expect(personalHistoryReason(p)).toBe(PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD);
    p.reference.historyStatus = "confirmed_none";
    expect(personalHistoryReason(p)).toBe(NO_PERSONAL_HISTORY_LIST_WITHHELD);
  });
  let snap: ReturnType<typeof snapshot>;
  beforeAll(() => { snap = snapshot(fixtures); });
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
  it("shows a zero-shot window's zero as a value and withholds a thin history for history, not for the zero", () => {
    const p = get(CASES.zeroShot);
    expect(p.context.signals.find(s => s.metric === "shots_per_60")).toMatchObject({ current: 0, status: "available" });
    // 9 personal games and a 4-game window: the history rule comes first.
    expect(p.score).toMatchObject({ list: null, rank: null, positionRank: null, positionTopN: false, reason: INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD });
  });
  it("keeps context as hypotheses and carries thin personal references visibly", () => {
    const p = get(CASES.thin);
    expect(p.evidence.tier).toBe("measured_process_personal_reference");
    expect(p.evidence.reference.personalGames).toBeLessThanOrEqual(4);
    expect(p.context.heading).toBe("Context, not part of the score");
    expect(p.context.signals.every(s => s.scoreInput === false && s.interpretation === "hypothesis" && s.hypotheses.length >= 2)).toBe(true);
    expect(get(CASES.conflicting).score).toMatchObject({ list: null, rank: null, statusLabel: "Production and support disagree; withheld from lists" });
  });
  it("ranks each list contiguously and keeps every withheld profile", () => {
    for (const side of ["BL", "SH"] as const) {
      const ranks = snap.profiles.filter(p => p.score.list === side).map(p => p.score.rank!).sort((a, b) => a - b);
      expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    }
    expect(snap.counts.withheld).toBe(snap.profiles.filter(p => p.score.list === null).length);
    expect(snap.counts.profiles).toBe(fixtures.length);
    expect(snap).toMatchObject({ trusted: false, productionAdopted: false, confidenceProbability: null, issuedAtUTC: null, provisional: true, exploratory: true });
  });
  // A copy of a listed profile with its personal history count replaced; the frozen score still lists it.
  const withHistory = (personalN: number | null, keepReferenceGames: boolean) => {
    const p = byId(CASES.burns);
    (p.reference as { personalN: number | null }).personalN = personalN;
    (p.result.productionAxis as { personal_n?: number | null }).personal_n = personalN;
    if (!keepReferenceGames) Object.assign(p.reference, { sourceIds: [], dates: [], seasons: [], ageDays: null });
    expect(p.result.researchList).toBe("BL");
    return p;
  };
  const gatedSnapshot = (p: Profile) => snapshot([...fixtures.filter(f => f.playerId !== p.playerId), p]);
  it("withholds a would-be listed profile with no personal history and says why", () => {
    const p = withHistory(0, false);
    const text = reasonText(NO_PERSONAL_HISTORY_LIST_WITHHELD)!;
    expect(text).toMatch(/^Withheld from lists: no personal history/);
    expect(toDisplayProfile(p, null, RECORDED).score).toMatchObject({ list: null, rank: null, listLabel: "Withheld; inspect evidence", reason: NO_PERSONAL_HISTORY_LIST_WITHHELD, reasonText: text });
    expect(() => toDisplayProfile(p, R1, RECORDED)).toThrow("withheld profile has no rank");
    const gated = gatedSnapshot(p);
    const shown = gated.profiles.find(x => x.playerId === CASES.burns)!;
    expect(currentResearchLists(gated).withheld).toContain(shown);
    expect(currentStateLabel(shown)).toMatch(/^Withheld from lists: no personal history/);
    expect(gated.counts).toMatchObject({ BL: snap.counts.BL - 1, SH: snap.counts.SH, withheld: snap.counts.withheld + 1, withheldNoPersonalHistory: 1, withheldPersonalHistoryUnavailable: 0 });
    const ranks = gated.profiles.filter(x => x.score.list === "BL").map(x => x.score.rank!).sort((a, b) => a - b);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    expect(snap.counts).toMatchObject({ withheldNoPersonalHistory: 0, withheldPersonalHistoryUnavailable: 0 });
  });
  it("lists the same player again once they gain personal history", () => {
    const before = gatedSnapshot(withHistory(0, false)).profiles.find(x => x.playerId === CASES.burns)!;
    const after = gatedSnapshot(withHistory(50, true)).profiles.find(x => x.playerId === CASES.burns)!;
    expect(before.score).toMatchObject({ list: null, rank: null, reason: NO_PERSONAL_HISTORY_LIST_WITHHELD });
    expect(after.score).toMatchObject({ list: "BL", rank: get(CASES.burns).score.rank, reason: null, reasonText: null });
    expect(get(CASES.burns).score).toMatchObject({ list: "BL", reason: null });
  });
  it("treats history that becomes unavailable as unknown, not as confirmed zero", () => {
    const text = reasonText(PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD)!;
    expect(text).toMatch(/^Withheld from lists: personal history could not be used \(unknown, not zero\)/);
    // Reference games exist but no usable count, a missing count, or a count that disagrees with the scored axis.
    const mismatched = withHistory(50, true);
    (mismatched.result.productionAxis as { personal_n?: number }).personal_n = 0;
    for (const p of [withHistory(0, true), withHistory(null, true), withHistory(null, false), mismatched]) {
      const gated = gatedSnapshot(p);
      const shown = gated.profiles.find(x => x.playerId === CASES.burns)!;
      expect(shown.score).toMatchObject({ list: null, rank: null, reason: PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD, reasonText: text });
      expect(gated.counts).toMatchObject({ BL: snap.counts.BL - 1, withheldNoPersonalHistory: 0, withheldPersonalHistoryUnavailable: 1 });
    }
  });
  // Fixture profiles the frozen rule lists but the history rule withholds, given 50 personal games and a full window
  // (padded with a synthetic fifth game so the window's dates and sources still match its game count).
  const eligibleCopy = (id: number) => {
    const p = byId(id), w = p.window;
    (p.reference as { personalN: number }).personalN = 50;
    (p.result.productionAxis as { personal_n?: number }).personal_n = 50;
    for (; w.appearances < 5; w.appearances++) { w.dates.push(w.dates.at(-1)!); w.sourceIds.push(Math.max(...w.sourceIds) + 1); }
    expect(p.result.researchList).not.toBeNull();
    return p;
  };
  let ordered: ReturnType<typeof snapshot>;
  beforeAll(() => { ordered = snapshot([...fixtures.filter(f => f.playerId !== CASES.thin && f.playerId !== CASES.zeroShot), eligibleCopy(CASES.thin), eligibleCopy(CASES.zeroShot)]); });
  const inOrdered = (id: number) => ordered.profiles.find(p => p.playerId === id)!;
  it("withholds direction below the provisional 20-game history cutoff, listed or not, and keeps unknown apart from zero", () => {
    const below = gatedSnapshot(withHistory(19, true)), at = gatedSnapshot(withHistory(20, true));
    expect(below.profiles.find(x => x.playerId === CASES.burns)!.score).toMatchObject({
      list: null, rank: null, reason: INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD, directionWithheldReason: INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD,
      gapSignLabel: "Direction withheld: insufficient personal history", gapSign: "buy_low_evidence" });
    expect(reasonText(INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD)).toMatch(/^Insufficient history: fewer than 20 personal games \(provisional cutoff\)/);
    expect(snap.counts.withheldInsufficientPersonalHistory).toBe(2); // Dowling (2 games) and McIlrath (9)
    expect(below.counts).toMatchObject({ BL: snap.counts.BL - 1, withheldInsufficientPersonalHistory: 3, withheldNoPersonalHistory: 0, withheldPersonalHistoryUnavailable: 0 });
    expect(at.profiles.find(x => x.playerId === CASES.burns)!.score).toMatchObject({ list: "BL", reason: null, directionWithheldReason: null, gapSignLabel: "Buy-low evidence" });
    // Not listed by the frozen rule, still no direction: confirmed zero (Wilson) keeps its own reason; an unavailable score has none to withhold.
    expect(get(CASES.wilson).score).toMatchObject({ list: null, reason: null, directionWithheldReason: NO_PERSONAL_HISTORY_LIST_WITHHELD, gapSignLabel: "Direction withheld: insufficient personal history" });
    expect(gatedSnapshot(withHistory(null, true)).profiles.find(x => x.playerId === CASES.burns)!.score.directionWithheldReason).toBe(PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD);
    expect(get(CASES.unavailable).score).toMatchObject({ directionWithheldReason: null, headline: null });
    expect(snap.counts.directionWithheld).toBe(snap.profiles.filter(p => p.score.value !== null && p.evidence.reference.personalGames < 20).length);
  });
  it("withholds a short window after history, and a headline gap that is missing or points the other way", () => {
    const short = eligibleCopy(CASES.burns);
    short.window.appearances = 4;
    expect(listWithheldReason(short)).toBe(SHORT_WINDOW_LIST_WITHHELD);
    expect(gatedSnapshot(short).counts).toMatchObject({ BL: snap.counts.BL - 1, withheldShortWindow: 1 });
    expect(reasonText(SHORT_WINDOW_LIST_WITHHELD)).toBe("Withheld from lists: fewer than 5 games in the window");
    expect(listWithheldReason(byId(CASES.thin))).toBe(INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD);
    const flip = (id: number, gap: number) => {
      const p = eligibleCopy(id);
      (p.explanation.tracks.find(t => t.track === "fantasy_points") as { gap: number }).gap = gap;
      return listWithheldReason(p);
    };
    expect([flip(CASES.burns, -0.5), flip(CASES.burns, 0), flip(CASES.sh, 0.5)]).toEqual(Array(3).fill(HEADLINE_TRACK_CONFLICT_LIST_WITHHELD));
    expect([flip(CASES.burns, 0.5), flip(CASES.sh, -0.5)]).toEqual([null, null]);
    // A missing headline is unavailable, never a zero gap.
    expect(flip(CASES.burns, Number.NaN)).toBe(HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD);
    const missing = eligibleCopy(CASES.burns);
    missing.explanation.tracks = missing.explanation.tracks.filter(t => t.track !== "fantasy_points");
    expect(listWithheldReason(missing)).toBe(HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD);
  });
  it("orders each list by the FHFH Standard gap, ranks within F and D, and shows G+A and Game Score as supporting tracks", () => {
    const [burns, mcIlrath, dowling] = [CASES.burns, CASES.zeroShot, CASES.thin].map(inOrdered);
    // Burns is provisional-tier, so the frozen evidence order would rank him after both measured-tier players.
    expect(burns.evidence.tier).toBe("provisional_estimated_or_extrapolated");
    expect([burns, mcIlrath, dowling].map(p => [p.position, p.score.rank, p.score.positionRank, p.score.positionTopN])).toEqual([["D", 1, 1, true], ["D", 2, 2, true], ["F", 3, 1, true]]);
    expect(burns.score.headline!.gap).toBeGreaterThan(mcIlrath.score.headline!.gap);
    expect(mcIlrath.score.headline!.gap).toBeGreaterThan(dowling.score.headline!.gap);
    const fp = burns.tracks.find(t => t.track === "fantasy_points")!;
    expect(burns.score.headline).toEqual({ track: "fantasy_points", scoring: "FHFH Standard", label: "FHFH Standard points", observed: fp.observed, expected: fp.supportConditioned, referenceAtCurrentTOI: fp.referenceAtCurrentTOI, gap: fp.gap });
    expect(burns.tracks.map(t => t.role)).toEqual(["headline", "supporting", "supporting"]);
    expect(inOrdered(CASES.sh).score).toMatchObject({ list: "SH", rank: 1, positionRank: 1 });
    expect(ordered.counts).toMatchObject({ BL: 3, SH: 1, byPosition: { F: { BL: 1, SH: 1 }, D: { BL: 2, SH: 0 } } });
    expect(ordered.headline).toMatchObject({ track: "fantasy_points", scoring: "FHFH Standard", supportingTracks: ["goals_plus_assists", "wigo_game_score"] });
    expect(ordered.lists).toEqual({ topN: 25, positionGroups: ["F", "D"], minPersonalGames: 20, minPersonalGamesProvisional: true, windowGames: 5 });
  });
  it("marks the top 25 per side and position group and keeps the full ranked list", () => {
    const clone = (id: number, position: "F" | "D") => Object.assign(byId(CASES.burns), { playerId: id, position });
    const many = snapshot([...Array.from({ length: BLSH_LIST_TOP_N + 2 }, (_, i) => clone(i + 1, "D")), clone(100, "F"), clone(101, "F")]);
    const rows = currentResearchLists(many).BL;
    expect(rows).toHaveLength(BLSH_LIST_TOP_N + 4);
    expect(rows.map(p => [p.playerId, p.score.rank, p.score.positionRank, p.score.positionTopN])).toEqual([
      ...Array.from({ length: BLSH_LIST_TOP_N + 2 }, (_, i) => [i + 1, i + 1, i + 1, i < BLSH_LIST_TOP_N]), [100, 28, 1, true], [101, 29, 2, true]]);
    expect(() => snapshot([Object.assign(byId(CASES.burns), { position: null })])).toThrow("has no position group");
  });
  it("gives Player Cards the same saved list, ranks, headline, direction and reason the preview reads", () => {
    for (const s of [gatedSnapshot(withHistory(0, false)), ordered]) {
      const { profiles, ...metadata } = s;
      const lists = currentResearchLists(s);
      const preview = new Map([...lists.BL, ...lists.SH, ...lists.withheld].map(p => [p.playerId, p.score]));
      const cards = profiles.filter(p => p.team !== null).map(p => retainedBlshEvidence({ id: p.playerId, team: p.team! }, s.seasonId,
        { profile: p, metadata, snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract: gated mapper snapshot" }));
      const carried = cards.flatMap(c => (c.retained ? [c.retained.profile] : []));
      expect(carried.map(p => p.playerId)).toEqual(expect.arrayContaining([CASES.burns, ...lists.BL.map(p => p.playerId), ...lists.SH.map(p => p.playerId)]));
      const keys = ["list", "rank", "positionRank", "positionTopN", "headline", "gapSignLabel", "directionWithheldReason", "reason", "reasonText"] as const;
      const pick = (score: (typeof profiles)[number]["score"]) => Object.fromEntries(keys.map(k => [k, score[k]]));
      for (const p of carried) expect(pick(p.score)).toEqual(pick(preview.get(p.playerId)!));
    }
    expect(gatedSnapshot(withHistory(0, false)).profiles.find(p => p.playerId === CASES.burns)!.score).toMatchObject({ list: null, rank: null, reason: NO_PERSONAL_HISTORY_LIST_WITHHELD });
  });
});

describe("displayProfile: decision-3 opportunity comparisons as provisional context", () => {
  /** Attach a real `compareOpportunity` result whose window is the profile's own scored window (synthetic PP time).
   * `level` scales the baseline per-game production: well above the window reads buy-low, well below sell-high. */
  const attach = (id: number, level: number, games = 40): MappedProfile => {
    const p: MappedProfile = byId(id), observed = p.explanation.tracks.map(t => t.actual);
    const history: OpportunityGame[] = Array.from({ length: games }, (_, i) => ({ seconds: 1200, ppSeconds: 120, goals: 1, assists: 1, ppPoints: 0,
      tracks: observed.map(v => (v / 5 + 1) * level * (1 + 0.3 * ((i % 3) - 1))) }));
    p.opportunity = compareOpportunity(summarizeOpportunityHistory(history), { games: 5, seconds: p.window.seconds, ppSeconds: 600, observed }, { headlineTrack: 0 });
    return p;
  };
  const shown = (p: MappedProfile) => snapshot([...fixtures.filter(f => f.playerId !== p.playerId), p]).profiles.find(x => x.playerId === p.playerId)!;
  let base: ReturnType<typeof toDisplayProfile>;
  beforeAll(() => { base = snapshot(fixtures).profiles.find(x => x.playerId === CASES.burns)!; });

  it("shows an explicit unavailable state when nothing is attached, never zeros", () => {
    const snap = snapshot(fixtures);
    for (const p of snap.profiles) {
      expect(p.opportunity).toMatchObject({ status: "unavailable", reason: OPPORTUNITY_NOT_ATTACHED, version: null, tracks: [], headline: null, changes: null, listCheck: null, affectsLists: false, forecast: false });
      expect(p.opportunity.reasonText).toMatch(/^Opportunity comparisons unavailable: .*\(not zero\)$/);
    }
    expect(snap.counts.opportunityAttached).toBe(0);
  });
  it("maps both comparisons, the assessment, TOI and PP changes and the claims for each track", () => {
    const p = shown(attach(CASES.burns, 3)), o = p.opportunity;
    expect(o).toMatchObject({ status: "available", version: OPPORTUNITY_VERSION, provisional: true, affectsLists: false, persistenceNote: PERSISTENCE_NOTE,
      retrospective: true, forecast: false, trusted: false, calibratedProbability: null });
    expect(o.tracks.map(t => t.track)).toEqual(["fantasy_points", "goals_plus_assists", "wigo_game_score"]);
    o.tracks.forEach((t, i) => expect(t.perGame.observed).toBe(p.tracks[i].observed));
    const fp = o.tracks[0];
    expect(fp.perGame).toMatchObject({ kind: "per_game_baseline", available: true, direction: "buy_low_evidence", directionLabel: "Buy-low evidence", reasonText: null });
    expect(fp.adjusted).toMatchObject({ kind: "opportunity_adjusted", available: true, direction: "buy_low_evidence" });
    expect(fp.adjusted.label).toMatch(/^Opportunity-adjusted: /);
    // Game Score has no PP split: the adjusted comparison is unavailable with text, and has no values.
    expect(o.tracks[2].adjusted).toMatchObject({ available: false, reason: "no_strength_split_for_track", expected: null, gap: null, z: null, direction: null,
      reasonText: "Unavailable: this track has no power-play split" });
    expect(o.headline).toEqual(fp.assessment);
    expect(o.headline).toMatchObject({ direction: "buy_low_evidence", reason: "comparisons_agree", directionLabel: "Buy-low evidence", reasonText: "Both comparisons point the same way" });
    expect(o.changes!.toi).toMatchObject({ baseline: 1200, current: 4581 / 5 });
    expect(o.changes!.pp).toMatchObject({ baseline: 120, current: 120 });
    expect(o.changes!.toi.text.length).toBeGreaterThan(0);
    expect(o.listCheck).toMatchObject({ state: "agrees", applied: false });
    expect(o.listCheck!.text).toMatch(/^Provisional context, not yet validated and not applied to the list: /);
  });
  it("never changes the list or the rank, even when the assessment contradicts or withholds", () => {
    const against = shown(attach(CASES.burns, 0.05)), thin = shown(attach(CASES.burns, 3, 10));
    expect(against.opportunity.headline!.direction).toBe("sell_high_evidence");
    expect(against.opportunity.listCheck!.state).toBe("contradicts");
    expect(thin.opportunity.headline).toMatchObject({ direction: "unavailable", reason: "per_game_unavailable" });
    expect(thin.opportunity.tracks.every(t => t.perGame.reason === "insufficient_personal_history" && t.perGame.expected === null && t.adjusted.expected === null)).toBe(true);
    expect(thin.opportunity.listCheck!.state).toBe("unavailable");
    for (const p of [against, thin]) expect(p.score).toEqual(base.score);
    // A profile outside the lists gets the comparisons but no list check.
    expect(shown(attach(CASES.conflicting, 3)).opportunity).toMatchObject({ status: "available", listCheck: null });
  });
  it("fails closed on a result that does not match the scored window or claims a forecast", () => {
    const moved = attach(CASES.burns, 3);
    moved.opportunity!.tracks[0].perGame.observed! += 1;
    expect(() => toDisplayProfile(moved, R1, RECORDED)).toThrow("opportunity window matches the scored window");
    const forecast = attach(CASES.burns, 3);
    (forecast.opportunity as { forecast: boolean }).forecast = true;
    expect(() => toDisplayProfile(forecast, R1, RECORDED)).toThrow("opportunity version and claims");
    const zeroed = attach(CASES.burns, 3);
    Object.assign(zeroed.opportunity!.tracks[2].adjusted, { gap: 0 });
    expect(() => toDisplayProfile(zeroed, R1, RECORDED)).toThrow("unavailable opportunity comparison has a reason and no values");
  });
  it("gives Player Cards the same opportunity the preview reads", () => {
    const s = snapshot([...fixtures.filter(f => f.playerId !== CASES.burns), attach(CASES.burns, 3)]);
    const { profiles, ...metadata } = s;
    const p = profiles.find(x => x.playerId === CASES.burns)!;
    const card = retainedBlshEvidence({ id: p.playerId, team: p.team! }, s.seasonId, { profile: p, metadata, snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract: opportunity" });
    expect(card.retained!.profile.opportunity).toEqual(currentResearchLists(s).BL.find(x => x.playerId === CASES.burns)!.opportunity);
    expect(s.counts).toMatchObject({ opportunityAttached: 1, opportunityListCheck: { agrees: 1, qualified: 0, balanced: 0, contradicts: 0, withheld: 0, unavailable: 0 } });
  });
});

describe("displayProfile: fails closed instead of displaying drifted values", () => {
  it("refuses components that no longer add to the gap", () => {
    const p = byId(CASES.burns);
    (p.explanation.tracks[0].components[0] as { value: number }).value += 0.5;
    expect(() => toDisplayProfile(p, R1, RECORDED)).toThrow("components add to the gap");
  });
  it("refuses changed claims, a missing rank or a rank on a withheld profile", () => {
    const claimed = byId(CASES.sh);
    (claimed.explanation.claims as { forecast: boolean }).forecast = true;
    expect(() => toDisplayProfile(claimed, R1, RECORDED)).toThrow("claims");
    expect(() => toDisplayProfile(byId(CASES.sh), null, RECORDED)).toThrow("list member has a rank");
    expect(() => toDisplayProfile(byId(CASES.conflicting), { rank: 3, positionRank: 1 }, RECORDED)).toThrow("withheld profile has no rank");
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
    // Frozen rule alone: 360 BL, 223 SH. Mapper v3 withholds 217 of them: 117 no personal history, 53 under 20 personal games,
    // 21 short windows and 26 whose FHFH Standard gap points the other way (mapper v2 alone: 284 BL, 182 SH).
    expect(snap.counts).toEqual({ profiles: 725, numeric: 673, BL: 228, SH: 138, withheld: 359, withheldNoPersonalHistory: 117, withheldPersonalHistoryUnavailable: 0,
      withheldInsufficientPersonalHistory: 53, withheldShortWindow: 21, withheldHeadlineConflict: 26, withheldHeadlineUnavailable: 0, directionWithheld: 199,
      opportunityAttached: 0, opportunityListCheck: { agrees: 0, qualified: 0, balanced: 0, contradicts: 0, withheld: 0, unavailable: 0 },
      byPosition: { F: { BL: 140, SH: 98 }, D: { BL: 88, SH: 40 } }, unavailableTier: 52, referenceContextAbsent: 151,
      zeroShotWindows: 19, zeroShotNumeric: 15, zeroShotListed: 0, personalReference1to4: 36, referenceAgeDays: { n: 574, min: 894, max: 1451 } });
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

describe("displayProfile: authored synthetic defaults (no retained data)", () => {
  it.each(["BL", "SH"] as const)("preserves independently calculated %s arithmetic", side => {
    const p = syntheticProfile(900001, side), before = JSON.stringify(p), shown = toDisplayProfile(p, R1, RECORDED);
    // Diagonal covariance [4,1,1] and equal track weights: standardized gaps are +/-[1,1,1].
    // Their joint standardized sum is +/-sqrt(3), giving the literal bounded index below.
    const sign = side === "BL" ? 1 : -1;
    expect(shown.score.normalizedGap).toBeCloseTo(sign * 1.7320508075688772, 12);
    expect(shown.score.value).toBeCloseTo(sign * 63.39745962155614, 12);
    expect(shown.tracks.map(t => t.observed)).toEqual(side === "BL" ? [8, 2, 0] : [12, 4, 2]);
    expect(shown.tracks.map(t => t.supportConditioned)).toEqual([10, 3, 1]);
    expect(shown.tracks.map(t => t.gap)).toEqual([2 * sign, sign, sign]);
    expect(shown.tracks.map(t => t.componentSum)).toEqual([2 * sign, sign, sign]);
    expect(shown.score.list).toBe(side); expect(shown.evidence.calibratedProbability).toBeNull();
    expect(shown.evidence.reference.estimatorWeight).toBe(0.8);
    expect(shown.opportunity).toMatchObject({ status: "unavailable", reason: OPPORTUNITY_NOT_ATTACHED, tracks: [] });
    expect(JSON.stringify(p)).toBe(before);
  });
  it.each([0, 19, 20])("enforces the personal-history boundary at %i", n => {
    const p = syntheticProfile(); p.reference.personalN = n; p.result.productionAxis.personal_n = n;
    if (!n) { p.reference.sourceIds = []; p.reference.dates = []; p.reference.historyStatus = "confirmed_none"; }
    const shown = toDisplayProfile(p, n >= 20 ? R1 : null, RECORDED);
    expect(shown.score.list).toBe(n >= 20 ? "BL" : null);
    expect(shown.score.reason).toBe(n === 0 ? NO_PERSONAL_HISTORY_LIST_WITHHELD : n < 20 ? INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD : null);
  });
  it("keeps unknown history distinct from zero and prioritizes it over short windows", () => {
    const p = syntheticProfile(); p.reference.personalN = 0; p.reference.historyStatus = "unknown"; p.result.productionAxis.personal_n = 0;
    p.window.appearances = 4;
    expect(toDisplayProfile(p, null, RECORDED).score.reason).toBe(PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD);
    p.reference.personalN = 50; p.result.productionAxis.personal_n = 50;
    expect(toDisplayProfile(p, null, RECORDED).score.reason).toBe(SHORT_WINDOW_LIST_WITHHELD);
  });
  it("withholds contradictory, balanced, nonfinite and absent headlines", () => {
    for (const side of ["BL", "SH"] as const) {
      for (const gap of [side === "BL" ? -1 : 1, 0, NaN]) {
        const p = syntheticProfile(900001, side); p.explanation.tracks[0].gap = gap;
        expect(listWithheldReason(p)).toBe(Number.isNaN(gap) ? HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD : HEADLINE_TRACK_CONFLICT_LIST_WITHHELD);
      }
    }
    const p = syntheticProfile(); p.explanation.tracks = p.explanation.tracks.slice(1);
    expect(listWithheldReason(p)).toBe(HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD);
  });
  it("withholds thin direction in cards and rejects assigning it a list rank", () => {
    const p = syntheticProfile(); p.reference.personalN = 19; p.result.productionAxis.personal_n = 19;
    expect(() => toDisplayProfile(p, R1, RECORDED)).toThrow("withheld profile has no rank");
    const s = snapshot([p]), { profiles, ...metadata } = s;
    expect(profiles[0].score).toMatchObject({ gapSign: "buy_low_evidence", list: null, directionWithheldReason: INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD });
    const card = retainedBlshEvidence({ id: p.playerId, team: p.team! }, s.seasonId, { profile: profiles[0], metadata, snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic contract" });
    expect(card.direction).toBe("unknown");
  });
  it("keeps a measured zero numeric, an absent score unavailable, and stale windows withheld", () => {
    const zero = toDisplayProfile(syntheticProfile(), R1, RECORDED);
    expect(zero.tracks[2].observed).toBe(0); expect(zero.score.value).not.toBeNull();
    const missing = toDisplayProfile(syntheticProfile(900002, "BL", { available: false }), null, RECORDED);
    expect(missing.score).toMatchObject({ value: null, status: "unavailable", list: null, rank: null });
    expect(missing.score.reasonText).toMatch(/^Score unavailable/);
    expect(missing.evidence).toMatchObject({ tier: null, tierLabel: "Unavailable: no score" });
    expect(missing.tracks).toEqual([]);
    const stale = toDisplayProfile(syntheticProfile(900003, "BL", { fresh: false }), null, RECORDED);
    expect(stale.score).toMatchObject({ list: null, rank: null }); expect(stale.score.value).not.toBeNull();
    expect(stale.evidence.window).toMatchObject({ fresh: false, lastGameDaysBeforeRecordedThrough: 9, recordedThroughDate: RECORDED });
    expect(stale.evidence.window.freshnessText).toMatch(/stale window; withheld from lists$/);
  });
  it("renders zero shots as zero and missing shots as unavailable context", () => {
    const zero = toDisplayProfile(syntheticProfile(900001, "BL", { shots: 0 }), R1, RECORDED);
    const missing = toDisplayProfile(syntheticProfile(900002, "BL", { shots: null }), R1, RECORDED);
    expect(zero.context.signals.find(c => c.metric === "shots_per_60")).toMatchObject({ current: 0, status: "available" });
    expect(missing.context.signals.find(c => c.metric === "shots_per_60")).toMatchObject({ current: null, status: "unavailable" });
    expect(zero.score.value).toBe(missing.score.value);
  });
  it("counts games only for slot coverage notes", () => {
    const p = syntheticProfile();
    p.coverage = [{ component: "current_window_slot", reason: "missing_measurement_or_exposure", count: 2 },
      { component: "personal_reference", reason: "no_personal_history_cohort", count: 1 }];
    const notes = toDisplayProfile(p, R1, RECORDED).coverage.notes.filter(n => n.source === "slot");
    expect(notes.map(n => [n.component, n.games])).toEqual([["current_window_slot", 2], ["personal_reference", null]]);
  });
  it("orders by headline gap even when the combined index orders the other way", () => {
    const highIndex = syntheticProfile(900001, "BL", { observed: [9, 0, -2] });
    const bigHeadline = syntheticProfile(900002, "BL", { observed: [6, 3, 1] }); bigHeadline.position = "D";
    expect(highIndex.result.value!).toBeGreaterThan(bigHeadline.result.value!);
    const s = snapshot([highIndex, bigHeadline]);
    expect(currentResearchLists(s).BL.map(p => p.playerId)).toEqual([900002, 900001]);
    expect(currentResearchLists(s).BL.map(p => p.score.headline!.gap)).toEqual([4, 1]);
    expect(s.profiles.every(p => p.score.positionRank === 1)).toBe(true);
    expect(s.profiles[0].tracks.map(t => t.role)).toEqual(["headline", "supporting", "supporting"]);
  });
  it("preserves absent context as unavailable, not zero", () => {
    const p = toDisplayProfile(syntheticProfile(), R1, RECORDED);
    expect(p.coverage.context.reference).toMatchObject({ verified: false, reason: "reference_window_not_supplied" });
    expect(p.context.signals.every(c => c.scoreInput === false && c.interpretation === "hypothesis")).toBe(true);
    expect(p.coverage.notes.every(n => n.text.length > 0)).toBe(true);
  });
  it.each(["component", "normalization", "claims", "rank", "context"])("rejects synthetic %s drift", kind => {
    const p = syntheticProfile();
    if (kind === "component") p.explanation.tracks[0].components[0].value++;
    if (kind === "normalization") p.explanation.normalizedGap!++;
    if (kind === "claims") Object.assign(p.explanation.claims, { forecast: true });
    if (kind === "context") p.explanation.coverage = p.explanation.coverage.filter(n => n.component !== "reference_window_context");
    expect(() => toDisplayProfile(p, kind === "rank" ? null : R1, RECORDED)).toThrow();
  });
  it("keeps both position lists contiguous, deterministic, and capped at 25", () => {
    const profiles = Array.from({ length: 27 }, (_, i) => { const p = syntheticProfile(900001 + i); p.position = "D"; return p; });
    profiles.push(syntheticProfile(900100), syntheticProfile(900101, "SH"));
    const s = snapshot(profiles.reverse());
    const ds = s.profiles.filter(p => p.position === "D").sort((a, b) => a.score.positionRank! - b.score.positionRank!);
    expect(ds.map(p => p.playerId)).toEqual(Array.from({ length: 27 }, (_, i) => 900001 + i));
    expect(ds.map(p => p.score.positionRank)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(ds.filter(p => p.score.positionTopN)).toHaveLength(25);
    expect(s.counts).toMatchObject({ profiles: 29, BL: 28, SH: 1, withheld: 0 });
  });
  it.each(["arm", "duplicate", "chronology"])("rejects synthetic snapshot %s drift", kind => {
    const p = syntheticProfile();
    expect(() => snapshot(kind === "duplicate" ? [p, p] : [p], kind === "arm" ? { referencePolicy: { ...POLICY, arm: "B_development_plus_2026_prefix" } } : kind === "chronology" ? { packagedAtUTC: "2026-10-27T00:00:00Z" } : {})).toThrow();
  });
  it("gives every opportunity reason code a written text", () => {
    const codes = ["no_personal_history", "insufficient_personal_history", "track_unavailable_in_history", "observed_production_unavailable", "window_games_unavailable", "unestimated_scale",
      "no_strength_split_for_track", "window_toi_unavailable", "window_pp_toi_unavailable", "history_toi_unavailable", "pp_split_inputs_unavailable", "no_non_pp_exposure",
      "pp_rate_unsupported_without_cohort", "split_rates_unavailable", "toi_unavailable", "comparisons_agree", "both_balanced", "opportunity_explains_per_game_gap",
      "adjusted_within_balanced_band", "opposite_directions_role_persistence_unknown", "per_game_at_baseline_rates_shifted", "adjusted_unavailable_per_game_only",
      "adjusted_unavailable_balanced", "adjusted_unavailable_opportunity_may_explain", "adjusted_unavailable_opportunity_unknown", "per_game_unavailable"];
    expect(codes.filter(c => reasonText(c)!.startsWith("Unavailable: " + c))).toEqual([]);
  });
  it.each([0.1, 3])("keeps opportunity level %s provisional and outside the list calculation", level => {
    const p = syntheticProfile(), base = toDisplayProfile(p, R1, RECORDED);
    const history: OpportunityGame[] = Array.from({ length: 40 }, (_, i) => ({ seconds: 1200, ppSeconds: 120,
      goals: 1, assists: 1, ppPoints: 0, tracks: [8, 2, 0].map(v => (v / 5 + 1) * level * (1 + 0.3 * ((i % 3) - 1))) }));
    p.opportunity = compareOpportunity(summarizeOpportunityHistory(history), { games: 5, seconds: 3600, ppSeconds: 600, observed: [8, 2, 0] }, { headlineTrack: 0 });
    const shown = toDisplayProfile(p, R1, RECORDED);
    expect(shown.score).toEqual(base.score);
    expect(shown.opportunity).toMatchObject({ status: "available", affectsLists: false, provisional: true, forecast: false, trusted: false, calibratedProbability: null });
    const c = shown.opportunity.tracks[0].perGame;
    // 40-game repeating factor has mean .9925; five games times baseline mean.
    expect(c.expected).toBeCloseTo(12.9025 * level, 10);
    expect(c.gap).toBeCloseTo(8 - 12.9025 * level, 10);
    const s = snapshot([p]), { profiles, ...metadata } = s;
    const card = retainedBlshEvidence({ id: p.playerId, team: p.team! }, s.seasonId, { profile: profiles[0], metadata, snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract only" });
    expect(card.retained?.profile).toEqual(profiles[0]);
    expect(shown.opportunity.tracks[2].adjusted).toMatchObject({ available: false, reason: "no_strength_split_for_track", expected: null, gap: null, z: null, direction: null });
    expect(shown.opportunity.changes!.toi).toMatchObject({ baseline: 1200, current: 720 });
    expect(shown.opportunity.changes!.pp).toMatchObject({ baseline: 120, current: 120 });
    expect(shown.opportunity.listCheck).toMatchObject({ state: level < 1 ? "contradicts" : "agrees", applied: false });
    for (const kind of ["observed", "forecast", "unavailable zero"]) {
      const corrupt = structuredClone(p);
      if (kind === "observed") corrupt.opportunity.tracks[0].perGame.observed!++;
      if (kind === "forecast") Object.assign(corrupt.opportunity, { forecast: true });
      if (kind === "unavailable zero") corrupt.opportunity.tracks[2].adjusted.gap = 0;
      expect(() => toDisplayProfile(corrupt, R1, RECORDED)).toThrow();
    }
    p.opportunity = compareOpportunity(summarizeOpportunityHistory(history.slice(0, 10)), { games: 5, seconds: 3600, ppSeconds: 600, observed: [8, 2, 0] }, { headlineTrack: 0 });
    const thin = toDisplayProfile(p, R1, RECORDED);
    expect(thin.score).toEqual(base.score);
    expect(thin.opportunity.listCheck).toMatchObject({ state: "unavailable", applied: false });
    expect(thin.opportunity.tracks.every(t => t.perGame.reason === "insufficient_personal_history" && t.perGame.expected === null && t.adjusted.expected === null)).toBe(true);
  });
});
