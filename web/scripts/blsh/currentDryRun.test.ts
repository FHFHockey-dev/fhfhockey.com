// @vitest-environment node
/** Opt-in local BLSH current-season dry run. Skipped unless every input path is set.
 * Reads frozen local files only, each verified by SHA-256 at consumption; writes only to BLSH_DRY_RUN_OUT.
 * No database, provider or network access. Results are exploratory research, not trusted.
 *
 * BLSH_CURRENT_DIR       Codex task-3 current-research-overlay-01 (CURRENT-REQUEST.json, RESEARCH-GOAL-BUNDLE.json)
 * BLSH_V1_RUN_DIR        Codex support-conditioned-ranking-v1/run-guarded-v1 (block catalog; ../INPUTS.json source pins)
 * BLSH_DEV_HISTORY       dev-history.jsonl written by export_dev_history.py, with EXPORT-RECEIPT.json beside it
 * BLSH_DRY_RUN_OUT       new output directory
 * BLSH_PREVIOUS_DRY_RUN  optional earlier output directory; scores must be unchanged against it
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { qualifyCurrentResearchInputs, type CurrentInputRequest, type ResearchGoalBundle } from "../../lib/buyLowSellHigh/currentInput";
import { assembleProfiles, CURRENT_WINDOWS_VERSION, type Arm, type DevRow, type Profile } from "../../lib/buyLowSellHigh/currentWindows";
import { rankTwoLists, type TrainingBlock } from "../../lib/buyLowSellHigh/supportGap";

const PINS = {
  "CURRENT-REQUEST.json": "6a76d0e8c36636eb5afe6adab46c677ace55214a8dafae4e9d11e28f1c53c5a8",
  "RESEARCH-GOAL-BUNDLE.json": "6c8b5dfa025dac1bfbe3b1018fc6b255ca7abcce41b520111eb14451ce89e95b",
  "ORIGINAL-BLOCK-CATALOG.jsonl": "f60056cd5ab6b80688d130661d2efbaacfe31c001de7b690a634514900ded529",
  /** v1 run INPUTS.json, which pins the six parquet sources the history was exported from. */
  "INPUTS.json": "343e796081506a0aa31d3a3da47927af872e11b4e9d150f06c5a902d3bdf2eac",
  /** Exported history and the exporter that wrote it, pinned here rather than trusted from the receipt beside them. */
  "dev-history.jsonl": "da32a473923e7b9940032c7ee22c1292e73798c7dc242a956a0244233d020106",
  "export_dev_history.py": "b6a4a580acc7af04a6d469429fbfefa19411aea4cf52a92d5847b3acd4deefe6",
};
/** Production-axis fields added in explanation v3.1 (identity and scored outcome split); not score inputs. */
const ADDED_AXIS_FIELDS = ["player_id", "reference_source_ids", "current_goals", "current_assists"];
const HISTORY_SOURCES = ["wgo2022", "wgo2023", "audit", "calendar2022", "calendar2023", "onice_raw"];
const env = process.env, ready = ["BLSH_CURRENT_DIR", "BLSH_V1_RUN_DIR", "BLSH_DEV_HISTORY", "BLSH_DRY_RUN_OUT"].every(k => env[k]);
const sha256 = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
/** Exclusive-method quantile (same convention as Python's statistics.quantiles default). */
const exclusiveQuantile = (sorted: number[], q: number) => {
  const h = q * (sorted.length + 1) - 1, lo = Math.min(Math.max(Math.floor(h), 0), sorted.length - 1), hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - Math.floor(h)) * (sorted[hi] - sorted[lo]);
};

describe.skipIf(!ready)("BLSH current-season dry run (local, exploratory)", () => {
  it("assembles and scores every captured player under both reference and overlay arms", async () => {
    const read = (path: string, pin: string) => {
      const bytes = readFileSync(path);
      if (sha256(bytes) !== pin) throw new Error(`Pin mismatch: ${path}`);
      return bytes.toString("utf8");
    };
    const out = env.BLSH_DRY_RUN_OUT!;
    if (existsSync(out)) throw new Error("Output directory must be new");
    const request = JSON.parse(read(join(env.BLSH_CURRENT_DIR!, "CURRENT-REQUEST.json"), PINS["CURRENT-REQUEST.json"])) as CurrentInputRequest;
    const bundle = JSON.parse(read(join(env.BLSH_CURRENT_DIR!, "RESEARCH-GOAL-BUNDLE.json"), PINS["RESEARCH-GOAL-BUNDLE.json"])) as ResearchGoalBundle;
    const blocks = read(join(env.BLSH_V1_RUN_DIR!, "ORIGINAL-BLOCK-CATALOG.jsonl"), PINS["ORIGINAL-BLOCK-CATALOG.jsonl"]).split("\n").filter(Boolean).map(l => JSON.parse(l) as TrainingBlock);
    // The exported history is a derivative: verify its own hash and that it was built from the pinned sources.
    const receipt = JSON.parse(readFileSync(join(dirname(env.BLSH_DEV_HISTORY!), "EXPORT-RECEIPT.json"), "utf8"));
    const sourcePins = JSON.parse(read(join(env.BLSH_V1_RUN_DIR!, "..", "INPUTS.json"), PINS["INPUTS.json"])).sources;
    if (HISTORY_SOURCES.some(k => receipt.sources?.[k]?.sha256 !== sourcePins[k].sha256)) throw new Error("Exported history was not built from the pinned sources");
    if (receipt.output?.sha256 !== PINS["dev-history.jsonl"] || receipt.exporter?.sha256 !== PINS["export_dev_history.py"]) throw new Error("Export receipt does not match the pinned history or exporter");
    read(join(__dirname, "export_dev_history.py"), PINS["export_dev_history.py"]);
    const history = read(env.BLSH_DEV_HISTORY!, PINS["dev-history.jsonl"]).split("\n").filter(Boolean).map(l => JSON.parse(l) as DevRow);
    const names = new Map<number, string>((request.wgo?.rows ?? []).map(r => [r.player_id, r.player_name ?? ""]));
    mkdirSync(out, { recursive: true });

    const tally = <T,>(items: T[], key: (t: T) => string | null | undefined) => items.reduce<Record<string, number>>((acc, t) => { const k = String(key(t) ?? "null"); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
    const brief = (p: Profile) => ({
      playerId: p.playerId, name: p.name, team: p.team, position: p.position, value: p.result.value, status: p.result.status, tier: p.result.evidenceTier ?? null,
      window: { first: p.window.dates[0], last: p.window.dates.at(-1), appearances: p.window.appearances, spanDays: p.window.spanDays, minutes: Math.round((p.window.seconds ?? 0) / 60) },
      reference: { games: p.reference.personalN, recordedSlots: p.reference.sourceIds.length, seasons: p.reference.seasons, daysBeforeWindow: p.reference.ageDays },
      tracks: p.explanation.tracks.map(t => ({ track: t.track, actual: t.actual, expected: t.expectedSupport, gap: t.gap,
        components: Object.fromEntries(t.components.map(c => [c.id, Number(c.value.toFixed(3))])) })),
      opportunity: p.explanation.opportunity.map(o => ({ metric: o.metric, current: o.current, reference: o.reference })),
      context: p.explanation.context.map(c => ({ metric: c.metric, current: c.current, reference: c.reference, delta: c.delta, status: c.status, reason: c.reason, deltaReason: c.deltaReason })),
      confidence: p.explanation.confidence,
    });
    const listedIds = new Map<string, Map<number, "BL" | "SH">>();
    const runs: Record<string, Profile[]> = {};
    const integrity = { numeric: 0, worstTrackResidual: 0, worstNormalizedResidual: 0, nonFiniteNumbers: 0, contextWithheld: {} as Record<string, number>,
      deltaWithheld: {} as Record<string, number>, deltaUnverifiedRevision: {} as Record<string, number> };
    const summary: Record<string, unknown> = { version: CURRENT_WINDOWS_VERSION, asOfUTC: request.asOfUTC, eventThroughDate: request.eventThroughDate,
      pins: PINS,
      exploratory: true, historyGate: "simplified currentInput-style gate on development rows; not the sealed v1 transport",
      eligibility: "unchanged complete-window rule: a process rate needs every selected game qualified; a production track needs every selected game", runs: {} };

    for (const [overlayArm, overlay] of [["verified_inputs_only", null], ["official_receipt_overlay", bundle]] as const) {
      const qualified = qualifyCurrentResearchInputs(request, overlay);
      const anyQualified = new Map<number, boolean>();
      qualified.records.forEach(r => anyQualified.set(r.research.record.player_id, (anyQualified.get(r.research.record.player_id) ?? false) || r.research.individual.qualified || r.research.onIce.qualified));
      for (const arm of ["A_development_reference", "B_development_plus_2026_prefix"] as Arm[]) {
        const profiles = await assembleProfiles({ current: qualified.records, history, blocks, arm, eventThroughDate: request.eventThroughDate, names });
        const key = `${arm}__${overlayArm}`;
        runs[key] = profiles;
        const lists = rankTwoLists(profiles.map(p => ({ playerId: p.playerId, snapshotDate: request.eventThroughDate, candidate: p.result })));
        listedIds.set(key, new Map([...lists.BL.map(r => [r.playerId, "BL"] as const), ...lists.SH.map(r => [r.playerId, "SH"] as const)]));
        const listed = listedIds.get(key)!;
        const coverage: Record<string, number> = {};
        profiles.forEach(p => p.coverage.forEach(c => { const k = `${c.component}: ${c.reason}`; coverage[k] = (coverage[k] ?? 0) + c.count; }));
        const numeric = profiles.filter(p => p.result.value !== null);
        // Real-window integrity: explanations must reconcile, describe the scored games and contain only finite numbers.
        for (const p of profiles) {
          if (p.result.value !== null) {
            integrity.numeric++;
            p.explanation.tracks.forEach(t => { integrity.worstTrackResidual = Math.max(integrity.worstTrackResidual, Math.abs(t.reconciliationResidual) / Math.max(1, Math.abs(t.gap))); });
            integrity.worstNormalizedResidual = Math.max(integrity.worstNormalizedResidual, Math.abs(p.explanation.normalizedReconciliationResidual ?? 0));
          }
          p.explanation.coverage.filter(n => n.component.endsWith("_window_context")).forEach(n => { integrity.contextWithheld[n.reason] = (integrity.contextWithheld[n.reason] ?? 0) + 1; });
          p.explanation.coverage.filter(n => n.component.startsWith("delta:")).forEach(n => {
            const bucket = n.state === "partial" ? integrity.deltaUnverifiedRevision : integrity.deltaWithheld, k = `${n.component}: ${n.reason}`;
            bucket[k] = (bucket[k] ?? 0) + 1;
          });
          const walk = (v: unknown): void => { if (typeof v === "number" && !Number.isFinite(v)) integrity.nonFiniteNumbers++; else if (v && typeof v === "object") Object.values(v).forEach(walk); };
          walk(p.explanation);
        }
        const short = profiles.filter(p => p.window.appearances < 5);
        const blocked = profiles.filter(p => p.result.reason === "no_observed_current_process");
        // |FP support adjustment| / |final FP support gap|, numeric scores with a nonzero gap.
        const ratios = numeric.map(p => p.explanation.tracks[0]).filter(t => t && t.gap !== 0)
          .map(t => Math.abs(t.components.filter(c => c.id.startsWith("process:")).reduce((s, c) => s + c.value, 0)) / Math.abs(t.gap)).sort((a, b) => a - b);
        const spans = profiles.filter(p => listed.has(p.playerId)).map(p => p.window.spanDays).sort((a, b) => a - b);
        (summary.runs as Record<string, unknown>)[key] = {
          players: profiles.length, numericScores: numeric.length,
          status: tally(profiles, p => p.result.status), evidenceTier: tally(profiles, p => p.result.evidenceTier),
          unavailableReason: tally(profiles.filter(p => p.result.value === null), p => p.result.reason),
          productionTier: tally(profiles, p => p.production.tier), personalReferenceReason: tally(profiles, p => p.reference.reason),
          fresh: profiles.filter(p => p.window.fresh).length,
          lists: { BL: lists.BL.length, SH: lists.SH.length, provisionalListed: profiles.filter(p => listed.has(p.playerId) && p.result.evidenceTier !== "measured_process_personal_reference").length },
          incompleteProcessWindows: { players: blocked.length, withAtLeastOneQualifiedGame: blocked.filter(p => anyQualified.get(p.playerId)).length },
          shortWindows: { players: short.length, scored: short.filter(p => p.result.value !== null).length, listed: short.filter(p => listed.has(p.playerId)).length,
            listedWithOneAppearance: short.filter(p => p.window.appearances === 1 && listed.has(p.playerId)).length },
          listedWindowSpanDays: spans.length ? { median: exclusiveQuantile(spans, 0.5), p90: exclusiveQuantile(spans, 0.9), max: spans.at(-1) } : null,
          supportAdjustmentShareOfFPGap: { definition: "abs(FP support adjustment) / abs(final FP support gap); exclusive quantiles; numeric scores with nonzero gap",
            n: ratios.length, median: ratios.length ? exclusiveQuantile(ratios, 0.5) : null, p90: ratios.length ? exclusiveQuantile(ratios, 0.9) : null },
          overlayCoverage: qualified.coverage, coverageBySlotReason: Object.fromEntries(Object.entries(coverage).sort((a, b) => b[1] - a[1])),
          topBuyLow: lists.BL.slice(0, 8).map(r => brief(profiles.find(p => p.playerId === r.playerId)!)),
          topSellHigh: lists.SH.slice(0, 8).map(r => brief(profiles.find(p => p.playerId === r.playerId)!)),
        };
        writeFileSync(join(out, `PROFILES-${key}.jsonl`), profiles.map(p => JSON.stringify(p)).join("\n") + "\n", { flag: "wx" });
        // Yield between arms so the test worker can report progress during this long synchronous run.
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    /** Pairwise comparison, with each sign flip attributed to what changed in the available reference evidence. */
    const compare = (a: string, b: string) => {
      const x = new Map(runs[a].map(p => [p.playerId, p])), la = listedIds.get(a)!, lb = listedIds.get(b)!;
      let both = 0, flips = 0, maxDiff = 0, gained = 0, lost = 0, listChanges = 0;
      const flipCauses: Record<string, number> = {};
      for (const q of runs[b]) {
        const p = x.get(q.playerId)!, v = p.result.value, w = q.result.value;
        if ((la.get(p.playerId) ?? null) !== (lb.get(p.playerId) ?? null)) listChanges++;
        if (v !== null && w !== null) {
          both++; maxDiff = Math.max(maxDiff, Math.abs(v - w));
          if (Math.sign(v) !== Math.sign(w)) {
            flips++;
            const cause = p.reference.personalN > 0 && q.reference.personalN === 0 ? "personal_production_history_lost"
              : p.reference.personalN === 0 && q.reference.personalN > 0 ? "personal_production_history_restored"
              : JSON.stringify(p.result.process?.modes) !== JSON.stringify(q.result.process?.modes) ? "process_reference_mode_changed"
              : "reference_rates_changed_same_evidence_modes";
            flipCauses[cause] = (flipCauses[cause] ?? 0) + 1;
          }
        } else if (v === null && w !== null) gained++; else if (v !== null && w === null) lost++;
      }
      return { bothNumeric: both, signFlips: flips, flipCauses, maxAbsValueDifference: maxDiff, numericOnlyInSecond: gained, numericOnlyInFirst: lost, listAssignmentChanges: listChanges };
    };
    summary.comparisons = {
      A_vs_B_verified: compare("A_development_reference__verified_inputs_only", "B_development_plus_2026_prefix__verified_inputs_only"),
      A_vs_B_overlay: compare("A_development_reference__official_receipt_overlay", "B_development_plus_2026_prefix__official_receipt_overlay"),
      verified_vs_overlay_A: compare("A_development_reference__verified_inputs_only", "A_development_reference__official_receipt_overlay"),
      verified_vs_overlay_B: compare("B_development_plus_2026_prefix__verified_inputs_only", "B_development_plus_2026_prefix__official_receipt_overlay"),
    };
    summary.realWindowIntegrity = integrity;

    // The frozen score must be unchanged against an earlier run of the same inputs.
    if (env.BLSH_PREVIOUS_DRY_RUN) {
      let compared = 0, differing = 0;
      for (const key of Object.keys(runs)) {
        // Score fields must be identical. The production axis may differ only by the identity/outcome fields added in v3.
        const comparable = (result: Record<string, unknown>) => {
          const { productionAxis, ...rest } = result as { productionAxis: Record<string, unknown> };
          const axis = Object.fromEntries(Object.entries(productionAxis).filter(([k]) => !ADDED_AXIS_FIELDS.includes(k)));
          return JSON.stringify([rest, axis]);
        };
        const before = new Map(readFileSync(join(env.BLSH_PREVIOUS_DRY_RUN, `PROFILES-${key}.jsonl`), "utf8").split("\n").filter(Boolean)
          .map(l => JSON.parse(l)).map(p => [p.playerId as number, comparable(p.result)]));
        for (const p of runs[key]) { compared++; if (before.get(p.playerId) !== comparable(p.result as unknown as Record<string, unknown>)) differing++; }
      }
      summary.scoreUnchangedAgainstPrevious = { previous: env.BLSH_PREVIOUS_DRY_RUN, compared, differing, axisFieldsIgnored: ADDED_AXIS_FIELDS };
      expect(differing).toBe(0);
    }
    writeFileSync(join(out, "SUMMARY.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
    expect(Object.keys(runs)).toHaveLength(4);
    expect(integrity.worstTrackResidual).toBeLessThanOrEqual(1e-9);
    expect(integrity.worstNormalizedResidual).toBeLessThanOrEqual(1e-9);
    expect(integrity.nonFiniteNumbers).toBe(0);
    expect(Object.keys(integrity.contextWithheld).filter(r => /identity|mismatch|disagree|invalid/.test(r))).toEqual([]);
  }, 900_000);
});
