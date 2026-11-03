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
  it.each(["component", "contribution", "index", "count"])("rejects saved %s drift without repairing it", kind => {
    const s = currentCopy(), p = s.profiles.find(p => p.tracks.length)!;
    if (kind === "component") p.tracks[0].components[0].value++;
    if (kind === "contribution") p.tracks[0].normalizedGapContribution++;
    if (kind === "index") p.score.value!++;
    if (kind === "count") s.counts.BL++;
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
