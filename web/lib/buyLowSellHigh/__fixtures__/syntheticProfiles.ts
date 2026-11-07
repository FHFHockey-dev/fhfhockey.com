/** Fully authored inputs. No saved player rows, files, environment or network access. */
import type { Profile } from "../currentWindows";
import { PRODUCTION_REFERENCE_VERSION } from "../productionReference";
import { PROCESS, explainSupportGap, scoreAndAttribute, type ProductionAxis, type ScoringModel, type WindowEvidence } from "../supportGap";

export function syntheticProfile(id = 900001, side: "BL" | "SH" = "BL", options: { available?: boolean; fresh?: boolean; shots?: number | null; observed?: [number, number, number] } = {}): Profile {
  const model: ScoringModel = { featureNames: [...PROCESS], beta: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]],
    Cxx: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], cohortX: [1, 2, 3], rank: 3, donors: 12, deltaMin: [-10, -10, -10], deltaMax: [10, 10, 10] };
  const production: Profile["production"] = { version: PRODUCTION_REFERENCE_VERSION, value: side === "BL" ? 30 : -30, direction: side,
    trusted_list_eligible: false as const, tier: "synthetic", confidence_probability: null,
    player_id: id, current_source_ids: [1, 2, 3, 4, 5], reference_source_ids: [101],
    current_seconds: 3600, expected_totals: [10, 3, 1], raw_observed: options.available === false ? [null, 2, 0] : options.observed ?? (side === "BL" ? [8, 2, 0] : [12, 4, 2]),
    joint_gap_covariance: [[4, 0, 0], [0, 1, 0], [0, 0, 1]], personal_n: 50, personal_weight: 0.8 };
  // Null production deliberately exercises the scorer's runtime unavailable-input guard.
  const result = scoreAndAttribute(model, production as unknown as ProductionAxis, [1, 2, 3], [1, 2, 3], [true, true, true], options.fresh ?? true);
  // Context is explicitly absent, not fabricated from the score. Arithmetic tests assert literals separately.
  const fields = ["goals", "assists", "shots", "ixG", "onIceGoals", "onIceXG"];
  const current: WindowEvidence | null = options.shots === undefined ? null : {
    identity: { playerId: id, sourceIds: [1, 2, 3, 4, 5] }, appearances: 5, seconds: 3600, esSeconds: 3000, ppSeconds: 400,
    goals: 1, assists: 1, shots: options.shots, ixG: 1.6, onIceGF: 5, onIceXGF: 3.5,
    scopes: { goals: "all_situations", assists: "all_situations", shots: "all_situations", ixG: "all_situations", onIceGoals: "all_situations", onIceXG: "all_situations" },
    provenance: Object.fromEntries(fields.map(field => [field, { provider: "synthetic", field, revision: "synthetic-v1" }])) as WindowEvidence["provenance"],
  };
  const explanation = explainSupportGap(result, { current, reference: null });
  const profile: Omit<Profile, "opportunity"> = {
    playerId: id, name: `Synthetic ${id}`, team: "AAA", position: "F", arm: "A_development_reference",
    window: { sourceIds: [1, 2, 3, 4, 5], dates: ["2026-10-18", "2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26"], seconds: 3600,
      appearances: 5, spanDays: 8, lastDateAgeDays: options.fresh === false ? 9 : 0, fresh: options.fresh ?? true },
    reference: { sourceIds: [101], dates: ["2024-04-18"], personalN: 50, reason: null, seasons: [20232024], ageDays: 913,
      staleDevelopmentReference: true, historyStatus: "personal", missingSeasons: [], insufficientHistory: false, baseline: null },
    comparisons: [], production, result: structuredClone(result), explanation, coverage: [], exploratory: true,
  };
  // Legacy mapper inputs predate the optional opportunity attachment; keep it genuinely absent.
  return profile as Profile;
}
