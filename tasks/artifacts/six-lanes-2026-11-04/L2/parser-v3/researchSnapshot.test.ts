import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseResearchSnapshot, parseHistoricalResearchSnapshot, parseCurrentResearchSnapshot, currentResearchLists, savedResearchLists, profileName, stateLabel, numberText } from "./researchSnapshot";

const data = JSON.parse(readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json"), "utf8"));
const copy = () => structuredClone(parseHistoricalResearchSnapshot(data));
describe("immutable BLSH historical snapshot contract", () => {
  it("retains all924 profiles, reviewed list order and unavailable coverage", () => {
    const s = parseHistoricalResearchSnapshot(data); const lists = savedResearchLists(s);
    expect(s.profiles).toHaveLength(924); expect(lists.BL).toHaveLength(364); expect(lists.SH).toHaveLength(265); expect(lists.withheld).toHaveLength(295);
    expect(s.profiles.filter(p => p.score.value !== null)).toHaveLength(910);
    expect(s.profiles.filter(p => p.score.status === "conflicting_baseline_and_support")).toHaveLength(37);
    expect(lists.BL.map(p => p.score.rank)).toEqual(Array.from({ length: 364 }, (_, i) => i + 1));
  });
  it("preserves the independently reviewed low-shot example without rescoring", () => {
    const p = parseHistoricalResearchSnapshot(data).profiles.find(p => p.playerId === 8480246)!;
    expect(p.score.productionP).toBe(54.86873315539758); expect(p.score.value).toBe(61.59186369954333);
    expect(p.coverage.shots).toBe(3); expect(p.score.list).toBe("BL"); expect(p.score.trusted).toBe(false);
  });
  it("keeps zero shots numeric and missing support null", () => {
    const profiles = parseHistoricalResearchSnapshot(data).profiles;
    expect(profiles.some(p => p.coverage.shots === 0 && p.score.value !== null)).toBe(true);
    const unavailable = profiles.find(p => p.score.value === null)!;
    expect(stateLabel(unavailable)).toMatch(/evidence/i); expect(numberText(unavailable.score.value)).toBe("Unavailable");
    expect(numberText(0)).toBe("0.00"); expect(numberText(null)).toBe("Unavailable");
  });
  it("does not substitute BLSH score signs for absent streaks", () => {
    const profiles = parseHistoricalResearchSnapshot(data).profiles;
    expect(profiles.filter(p => p.streak !== null)).toHaveLength(4);
    expect(profiles.some(p => p.score.list === "BL" && p.streak === null)).toBe(true);
  });
  it.each(["player", "date", "version"])("rejects mismatched streak %s", field => {
    const s = copy(); const p = s.profiles.find(p => p.streak)!;
    if (field === "player") p.streak!.playerId++;
    if (field === "date") p.streak!.eventThroughDate = "2024-04-19";
    if (field === "version") Object.assign(p.streak!, { detectorVersion: "other" });
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
  it("rejects duplicate identities and future current-window rows", () => {
    const a = copy(); a.profiles[1].playerId = a.profiles[0].playerId;
    expect(() => parseResearchSnapshot(a)).toThrow();
    const b = copy(); const p = b.profiles.find(p => p.reference.currentDates.length)!;
    p.reference.currentDates[p.reference.currentDates.length - 1] = "2024-04-19";
    expect(() => parseResearchSnapshot(b)).toThrow();
  });
  it("rejects reference/current overlap", () => {
    const s = copy(); const p = s.profiles.find(p => p.reference.referenceDates.length && p.reference.currentDates.length)!;
    p.reference.referenceDates[p.reference.referenceDates.length - 1] = p.reference.currentDates[0];
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
  it.each(["stale", "conflict", "trusted"])("fails closed on %s list drift", kind => {
    const s = copy(); const p = s.profiles.find(p => p.score.list === "BL")!;
    if (kind === "stale") p.coverage.freshProxy = false;
    if (kind === "conflict") p.score.status = "conflicting_baseline_and_support";
    if (kind === "trusted") Object.assign(p.score, { trusted: true });
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
  it("rejects fabricated issuance, confidence and nonfinite values", () => {
    const a = copy(); (a as unknown as { issuedAtUTC: string }).issuedAtUTC = "2024-04-18T20:00:00Z";
    expect(() => parseResearchSnapshot(a)).toThrow();
    const b = copy(); b.profiles[0].score.value = Number.NaN;
    expect(() => parseResearchSnapshot(b)).toThrow();
    const c = copy(); (c as unknown as { confidenceProbability: number }).confidenceProbability = 0.9;
    expect(() => parseResearchSnapshot(c)).toThrow();
  });
  it("keeps fallback identity explicit", () => {
    const p = parseHistoricalResearchSnapshot(data).profiles[0];
    expect(profileName({ ...p, displayName: null })).toContain(`Player ${p.playerId}`);
  });
});

const currentData = JSON.parse(readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json"), "utf8"));
const currentCopy = () => structuredClone(parseCurrentResearchSnapshot(currentData));
describe("immutable BLSH current-research display contract", () => {
  it("dispatches v2 without changing v1 and retains the full saved population", () => {
    const s = parseCurrentResearchSnapshot(currentData), lists = currentResearchLists(s);
    expect(parseResearchSnapshot(currentData).schemaVersion).toBe("fhfh.blsh.current-research-snapshot.v2");
    expect(parseResearchSnapshot(data).schemaVersion).toBe("fhfh.blsh.historical-snapshot.v1");
    expect(s.profiles).toHaveLength(725); expect(lists.BL).toHaveLength(360); expect(lists.SH).toHaveLength(223); expect(lists.withheld).toHaveLength(142);
    expect(s.profiles.filter(p => p.score.value !== null)).toHaveLength(673);
    expect(s.profiles.filter(p => p.evidence.tier === null)).toHaveLength(52);
    expect(s.profiles.filter(p => p.coverage.context.reference.reason === "reference_window_not_supplied")).toHaveLength(151);
    const zero = s.profiles.filter(p => p.context.signals.some(c => c.metric === "shots_per_60" && c.current === 0));
    expect(zero).toHaveLength(19); expect(zero.filter(p => p.score.value !== null)).toHaveLength(15); expect(zero.filter(p => p.score.list !== null)).toHaveLength(7);
    expect(s.counts.referenceAgeDays).toEqual({ n: 574, min: 894, max: 1451 });
  });
  it.each(["duplicate", "future", "overlap", "custody"])("rejects %s identity/window drift", kind => {
    const s = currentCopy(), p = s.profiles.find(p => p.evidence.reference.dates.length)!;
    if (kind === "duplicate") s.profiles[1].playerId = s.profiles[0].playerId;
    if (kind === "future") p.evidence.window.dates[p.evidence.window.dates.length - 1] = "2026-10-27";
    if (kind === "overlap") p.evidence.reference.dates[p.evidence.reference.dates.length - 1] = p.evidence.window.dates[0];
    if (kind === "custody") p.evidence.reference.seasons = [20252026];
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
  it.each(["component", "contribution", "index", "count", "sign", "withheld"])("rejects saved %s drift without repairing it", kind => {
    const s = currentCopy(), p = s.profiles.find(p => p.tracks.length)!;
    if (kind === "component") p.tracks[0].components[0].value++;
    if (kind === "contribution") p.tracks[0].normalizedGapContribution++;
    if (kind === "index") p.score.value!++;
    if (kind === "count") s.counts.BL++;
    if (kind === "sign") p.score.gapSign = p.score.value! > 0 ? "sell_high_evidence" : "buy_low_evidence";
    if (kind === "withheld") s.profiles.find(p => p.score.list)!.score.directionWithheldReason = "insufficient_personal_history_list_withheld";
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
  it("keeps unavailable tiers and profile notes distinct from estimates and game counts", () => {
    const s = currentCopy(), p = s.profiles.find(p => p.score.value === null)!;
    p.evidence.tier = "provisional_estimated_or_extrapolated";
    expect(() => parseResearchSnapshot(s)).toThrow(/unavailable/);
    const b = currentCopy(), n = b.profiles.flatMap(p => p.coverage.notes).find(n => n.component === "personal_reference")!;
    n.games = 1;
    expect(() => parseResearchSnapshot(b)).toThrow(/note units/);
  });
  it.each(["stale", "conflict", "rank", "claim", "issued", "anchor"])("rejects %s interpretation drift", kind => {
    const s = currentCopy(), p = s.profiles.find(p => p.score.list === "BL")!;
    if (kind === "stale") p.evidence.window.fresh = false;
    if (kind === "conflict") p.score.status = "conflicting_baseline_and_support";
    if (kind === "rank") p.score.rank = 10000;
    if (kind === "claim") Object.assign(p.claims, { forecast: true });
    if (kind === "issued") Object.assign(s, { issuedAtUTC: s.asOfUTC });
    if (kind === "anchor") p.evidence.window.recordedThroughDate = "2026-10-28";
    expect(() => parseResearchSnapshot(s)).toThrow();
  });
});

// Synthetic v3 metadata on a small retained arm-A display sample; no new source admission or packaging.
function v3Fixture() {
  const s = currentCopy();
  const original = s.profiles.find(p => p.score.list === "BL" && p.evidence.reference.personalGames >= 20
    && p.evidence.window.games >= 5 && p.tracks[0].gap > 0 && p.tracks[0].observed > 4)!;
  s.profiles = [structuredClone(original), structuredClone(original), structuredClone(original)];
  s.mapperVersion = "blsh-display-profile-v3";
  s.lists = { topN: 25, positionGroups: ["F", "D"], minPersonalGames: 20, minPersonalGamesProvisional: true, windowGames: 5 };
  s.headline = { track: "fantasy_points", scoring: "FHFH Standard", label: "FHFH Standard points gap", supportingTracks: ["goals_plus_assists", "wigo_game_score"], listOrder: "Directed headline gap", combinedIndexNote: "Supporting index" };
  s.profiles.forEach((p, i) => {
    p.playerId = 900001 + i; p.position = i === 1 ? "D" : "F";
    p.tracks.forEach(t => { t.role = t.track === "fantasy_points" ? "headline" : "supporting"; });
    const fp = p.tracks[0];
    Object.assign(p.score, { list: "BL", rank: i + 1, positionRank: i === 2 ? 2 : 1, positionTopN: true,
      headline: { track: "fantasy_points", scoring: "FHFH Standard", label: "FHFH Standard points", observed: fp.observed,
        expected: fp.supportConditioned, referenceAtCurrentTOI: fp.referenceAtCurrentTOI, gap: fp.gap },
      directionWithheldReason: null, directionWithheldText: null, reason: null, reasonText: null });
    p.opportunity = { status: "unavailable", reason: "opportunity_not_attached", reasonText: "Not attached", version: null,
      heading: "Opportunity: per-game and opportunity-adjusted comparisons", provisional: true, affectsLists: false,
      tracks: [], headline: null, changes: null, persistenceNote: "Persistence is unknown", listCheck: null,
      retrospective: true, forecast: false, trusted: false, calibratedProbability: null };
  });
  Object.assign(s.counts, { profiles: 3, numeric: 3, BL: 3, SH: 0, withheld: 0, unavailableTier: 0,
    withheldNoPersonalHistory: 0, withheldPersonalHistoryUnavailable: 0, withheldInsufficientPersonalHistory: 0,
    withheldShortWindow: 0, withheldHeadlineConflict: 0, withheldHeadlineUnavailable: 0, directionWithheld: 0, opportunityAttached: 0,
    byPosition: { F: { BL: 2, SH: 0 }, D: { BL: 1, SH: 0 } },
    opportunityListCheck: { agrees: 0, qualified: 0, balanced: 0, contradicts: 0, withheld: 0, unavailable: 0 } });
  return s;
}
function attachSyntheticOpportunity(s: ReturnType<typeof v3Fixture>) {
  const p = s.profiles[0], o = p.opportunity;
  o.status = "available"; o.reason = null; o.reasonText = null; o.version = "blsh-opportunity-split-v1";
  o.tracks = p.tracks.map(t => ({ track: t.track, label: t.label,
    perGame: { kind: "per_game_baseline", label: "Per game", available: true, reason: null, reasonText: null,
      observed: t.observed, expected: t.observed, gap: 0, scale: 1, z: 0, direction: "balanced", directionLabel: "Balanced" },
    adjusted: { kind: "opportunity_adjusted", label: "Adjusted", available: false, reason: "unestimated_scale", reasonText: "Scale unavailable",
      observed: t.observed, expected: null, gap: null, scale: null, z: null, direction: null, directionLabel: null },
    assessment: { direction: "balanced", qualified: false, conflict: false, reason: "adjusted_unavailable_balanced", text: "Balanced observed context",
      directionLabel: "Balanced", reasonText: "Balanced comparison", opportunityEffect: null, opportunityEffectSource: null, opportunityShift: "unknown" } }));
  o.headline = structuredClone(o.tracks[0].assessment);
  const change = { label: "Unknown change", units: "seconds/game" as const, baseline: null, current: null, delta: null, deltaPct: null,
    impact: [null, null, null], impactReason: "toi_unavailable", impactReasonText: "Unknown", text: "Unknown" };
  o.changes = { toi: { ...change, metric: "toi_per_game" }, pp: { ...change, metric: "pp_toi_per_game" } };
  o.listCheck = { state: "balanced", applied: false, text: "Provisional context only" };
  s.counts.opportunityAttached = 1; s.counts.opportunityListCheck.balanced = 1;
  return s;
}

function nonzeroOpportunity(direction: "buy_low_evidence" | "sell_high_evidence") {
  const s = attachSyntheticOpportunity(v3Fixture()), o = s.profiles[0].opportunity;
  const below = direction === "buy_low_evidence", observed = s.profiles[0].tracks[0].observed;
  const comparison = { available: true, reason: null, reasonText: null, observed,
    expected: below ? observed + 2 : observed - 2, gap: below ? -2 : 2, scale: 1, z: below ? -2 : 2,
    direction, directionLabel: below ? "Buy-low evidence" : "Sell-high evidence" };
  Object.assign(o.tracks[0].perGame, comparison);
  Object.assign(o.tracks[0].adjusted, comparison);
  Object.assign(o.tracks[0].assessment, { direction, directionLabel: comparison.directionLabel,
    reason: "comparisons_agree", reasonText: "Both comparisons agree", text: below ? "Production below both comparisons" : "Production above both comparisons" });
  o.headline = structuredClone(o.tracks[0].assessment);
  const state = below ? "agrees" : "contradicts";
  o.listCheck = { state, applied: false, text: "Provisional context only" };
  s.counts.opportunityListCheck.balanced = 0; s.counts.opportunityListCheck[state] = 1;
  return s;
}

describe("saved mapper-v3 validation", () => {
  it("accepts legacy pinned arm-A bytes and v3 unattached opportunity without mutation", () => {
    const legacy = JSON.parse(readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json"), "utf8"));
    const before = JSON.stringify(legacy);
    expect(parseCurrentResearchSnapshot(legacy)).toBe(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
    const s = v3Fixture(), saved = JSON.stringify(s);
    expect(parseCurrentResearchSnapshot(s)).toBe(s);
    expect(JSON.stringify(s)).toBe(saved);
  });
  it("accepts balanced attached context on a buy-low list without changing ranks or scores", () => {
    const s = attachSyntheticOpportunity(v3Fixture()), before = JSON.stringify(s);
    expect(parseCurrentResearchSnapshot(s)).toBe(s);
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each(["buy_low_evidence", "sell_high_evidence"] as const)("retains nonzero %s opportunity using observed minus expected", direction => {
    const s = nonzeroOpportunity(direction), before = JSON.stringify(s);
    expect(parseCurrentResearchSnapshot(s)).toBe(s);
    expect(s.profiles[0].opportunity.tracks[0].perGame.gap).toBe(direction === "buy_low_evidence" ? -2 : 2);
    expect(s.profiles[0].opportunity.tracks[0].adjusted.z).toBe(direction === "buy_low_evidence" ? -2 : 2);
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each(["gap sign", "z sign", "z ratio", "zero scale", "negative scale", "direction sign"])("rejects nonzero comparison %s corruption", kind => {
    const s = nonzeroOpportunity("buy_low_evidence"), c = s.profiles[0].opportunity.tracks[0].perGame;
    if (kind === "gap sign") c.gap = 2;
    if (kind === "z sign") c.z = 2;
    if (kind === "z ratio") c.z = -1;
    if (kind === "zero scale") c.scale = 0;
    if (kind === "negative scale") c.scale = -1;
    if (kind === "direction sign") { c.direction = "sell_high_evidence"; c.directionLabel = "Sell-high evidence"; }
    const before = JSON.stringify(s);
    expect(() => parseCurrentResearchSnapshot(s)).toThrow(/available opportunity values/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("allows a nonzero balanced comparison without assuming an unsaved band threshold", () => {
    const s = attachSyntheticOpportunity(v3Fixture()), c = s.profiles[0].opportunity.tracks[0].perGame;
    c.expected = c.observed! + 2; c.gap = -2; c.scale = 10; c.z = -0.2;
    const before = JSON.stringify(s);
    expect(parseCurrentResearchSnapshot(s)).toBe(s);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects a non-balanced direction on a zero z comparison", () => {
    const s = attachSyntheticOpportunity(v3Fixture()), c = s.profiles[0].opportunity.tracks[0].perGame;
    c.direction = "buy_low_evidence"; c.directionLabel = "Buy-low evidence";
    expect(() => parseCurrentResearchSnapshot(s)).toThrow(/available opportunity values/);
  });
  it("retains a thin-history withheld profile and rejects a contradictory gate reason", () => {
    const s = v3Fixture(), p = s.profiles[2];
    p.evidence.reference.personalGames = 19;
    Object.assign(p.score, { list: null, rank: null, positionRank: null, positionTopN: false,
      directionWithheldReason: "insufficient_personal_history_list_withheld", directionWithheldText: "Thin history",
      gapSignLabel: "Direction withheld: insufficient personal history", reason: "insufficient_personal_history_list_withheld" });
    Object.assign(s.counts, { BL: 2, withheld: 1, directionWithheld: 1, withheldInsufficientPersonalHistory: 1 });
    s.counts.byPosition.F.BL = 1;
    expect(parseCurrentResearchSnapshot(s)).toBe(s);
    p.evidence.reference.personalGames = 30;
    expect(() => parseCurrentResearchSnapshot(s)).toThrow(/thin-history reason/);
  });
  it.each([
    "version", "missing headline", "headline value", "track role", "history gate", "window gate", "policy gate", "direction", "position rank", "topN",
    "rank tie", "position order", "position count", "reason count", "direction count", "opportunity count", "opportunity claim", "unattached numeric", "arm C",
  ])("rejects %s drift without repairing the payload", kind => {
    const s = v3Fixture(), p = s.profiles[0];
    if (kind === "version") Object.assign(s, { mapperVersion: "blsh-display-profile-v99" });
    if (kind === "missing headline") p.score.headline = null;
    if (kind === "headline value") p.score.headline!.expected++;
    if (kind === "track role") p.tracks[1].role = "headline";
    if (kind === "history gate") p.evidence.reference.personalGames = 19;
    if (kind === "window gate") p.evidence.window.games = 4;
    if (kind === "policy gate") Object.assign(s.lists, { minPersonalGames: 1 });
    if (kind === "direction") p.score.directionWithheldReason = "insufficient_personal_history_list_withheld";
    if (kind === "position rank") p.score.positionRank = null;
    if (kind === "topN") p.score.positionTopN = false;
    if (kind === "rank tie") [s.profiles[0].playerId, s.profiles[1].playerId] = [s.profiles[1].playerId, s.profiles[0].playerId];
    if (kind === "position order") s.profiles[2].score.positionRank = 1;
    if (kind === "position count") s.counts.byPosition.F.BL++;
    if (kind === "reason count") s.counts.withheldShortWindow++;
    if (kind === "direction count") s.counts.directionWithheld++;
    if (kind === "opportunity count") s.counts.opportunityAttached++;
    if (kind === "opportunity claim") Object.assign(p.opportunity, { affectsLists: true });
    if (kind === "unattached numeric") Object.assign(p.opportunity, { headline: { opportunityEffect: 0 } });
    if (kind === "arm C") Object.assign(s.referencePolicy, { arm: "C_weighted_personal_baseline", stale: false });
    const before = JSON.stringify(s);
    expect(() => parseCurrentResearchSnapshot(s)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each(["expected", "window", "gap", "headline", "applied", "state", "check count", "missing check", "version", "changes"])("rejects attached opportunity %s drift", kind => {
    const s = attachSyntheticOpportunity(v3Fixture()), o = s.profiles[0].opportunity;
    if (kind === "expected") o.tracks[0].adjusted.expected = 0;
    if (kind === "window") o.tracks[0].adjusted.observed!++;
    if (kind === "gap") o.tracks[0].perGame.gap = 1;
    if (kind === "headline") o.headline!.text = "Different assessment";
    if (kind === "applied") Object.assign(o.listCheck!, { applied: true });
    if (kind === "state") o.listCheck!.state = "agrees";
    if (kind === "check count") s.counts.opportunityListCheck.balanced = 0;
    if (kind === "missing check") o.listCheck = null;
    if (kind === "version") o.version = null;
    if (kind === "changes") o.changes!.toi.impact = [null];
    expect(() => parseCurrentResearchSnapshot(s)).toThrow();
  });
});
