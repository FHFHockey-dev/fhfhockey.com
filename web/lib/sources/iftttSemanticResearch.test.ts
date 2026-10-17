// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import research from "./fixtures/iftttSemanticResearch/semantic-family-cases.json";

// Integrity of provisional research only: no parser, identity resolver, storage or dispatch.
const variants = new Map(research.text_variants.map((variant) => [variant.variant_id, variant]));

describe("IFTTT provisional semantic research integrity", () => {
  it("retains the finite inventory and non-runtime provenance", () => {
    expect(research.format).toBe("ifttt-curated-semantic-research-v1");
    expect(research.status).toBe("provisional_offline_specification_not_executed");
    expect(research.cases).toHaveLength(15);
    expect(research.cases.flatMap((entry) => entry.expected_claims)).toHaveLength(40);
    expect(variants.size).toBe(29);
    expect(research.text_variants).toHaveLength(29);
    expect(new Set(research.cases.map((entry) => entry.case_id)).size).toBe(15);
    expect(research.provenance).toMatchObject({
      ground_truth: false, application_execution: "not_run", dispatch_enabled: false, production_wiring: false,
      source_archive_sha256: "6b1fcfcb46c7492de9ef8aa6f0c6b4bef6880f8433659077eb64e710da10be46",
    });
    expect(research.label_provenance).toMatchObject({
      status: "provisional", human_adjudication: "not_completed", independent_ground_truth: null, holdout: false,
    });
  });

  it.each(research.text_variants)("preserves exact text bytes for $variant_id", (variant) => {
    expect(createHash("sha256").update(variant.text, "utf8").digest("hex")).toBe(variant.sha256_utf8);
    expect(Array.from(variant.text)).toHaveLength(variant.character_count);
    expect(Object.keys(variant).sort()).toEqual(["character_count", "sha256_utf8", "text", "variant_id"]);
  });

  it.each(research.cases)("retains exact spans and unresolved bindings for $case_id", (entry) => {
    expect(entry.execution_status).toBe("not_run_against_implementation");
    expect(entry.human_adjudication).toBe("not_completed");
    expect(entry.independent_ground_truth).toBeNull();
    expect(entry.expected_effects).toEqual({
      actual_dispatch_count: 0, production_applicability: "historical_discovery_fixture_only", requires_fresh_snapshot_adapter: true,
    });
    for (const id of entry.variant_ids) expect(variants.has(id)).toBe(true);
    for (const claim of entry.expected_claims) {
      expect(claim.canonical_player_id).toBeNull();
      expect(claim.effective_game_id).toBeNull();
      const span = claim.evidence;
      expect(entry.variant_ids).toContain(span.variant_id);
      const variant = variants.get(span.variant_id)!;
      const codepoints = Array.from(variant.text);
      for (const [start, end, length] of [
        [span.start_codepoint, span.end_codepoint, codepoints.length],
        [span.start_utf16, span.end_utf16, variant.text.length],
      ]) {
        expect(Number.isInteger(start) && Number.isInteger(end)).toBe(true);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        expect(end).toBeLessThanOrEqual(length);
      }
      expect(codepoints.slice(span.start_codepoint, span.end_codepoint).join("")).toBe(span.text);
      expect(variant.text.slice(span.start_utf16, span.end_utf16)).toBe(span.text);
      expect(codepoints.slice(0, span.start_codepoint).join("").length).toBe(span.start_utf16);
      expect(codepoints.slice(0, span.end_codepoint).join("").length).toBe(span.end_utf16);
    }
  });

  it("indexes every family membership exactly once without orphan cases", () => {
    const expected: Record<string, string[]> = {};
    for (const entry of research.cases) {
      expect(entry.families.length).toBeGreaterThan(0);
      expect(new Set(entry.families).size).toBe(entry.families.length);
      for (const family of entry.families) (expected[family] ??= []).push(entry.case_id);
    }
    expect(Object.keys(research.families)).toHaveLength(19);
    expect(research.families).toEqual(expected);
  });

  it("keeps NX015 outside a bound same-game IN versus OUT acceptance case", () => {
    const entry = research.cases.find((item) => item.case_id === "NX015")!;
    expect(entry.forbidden_promotions).toContain("true_same_game_in_out_dispute_claimed");
    expect(entry.expected_relations).toContainEqual(expect.objectContaining({
      strict_contradiction: "not_established", current_availability: "unknown",
    }));
  });
});
