import { describe, expect, it, vi } from "vitest"

import {
  canonicalSustainabilityConfigSeed,
  loadActiveSustainabilityConfig,
  parseActiveSustainabilityConfig,
} from "./config"

describe("canonical Sustainability configuration", () => {
  it("matches the migration seed and preserves an order-independent hash", () => {
    const seed = canonicalSustainabilityConfigSeed()
    expect(seed).toMatchObject({
      configRevision: 2,
      modelVersion: "sustainability_score_v2",
      configHash: "fnv1a_91691726",
      sdMode: "fixed",
      freshnessDays: 45,
    })
    expect(
      parseActiveSustainabilityConfig({
        model_version: seed.configRevision,
        score_model_version: seed.modelVersion,
        config_hash: seed.configHash,
        weights_json: {
          skill: seed.weights.skill,
          luck: seed.weights.luck,
        },
        toggles_json: seed.toggles,
        constants_json: seed.constants,
        sd_mode: seed.sdMode,
        freshness_days: seed.freshnessDays,
      }),
    ).toEqual(seed)
  })

  it("fails closed on incompatible or tampered active configuration", () => {
    const seed = canonicalSustainabilityConfigSeed()
    expect(() =>
      parseActiveSustainabilityConfig({
        model_version: 1,
        score_model_version: "legacy_draft_v1",
        config_hash: "legacy_unversioned",
        weights_json: {},
        toggles_json: {},
        constants_json: {},
        sd_mode: "fixed",
        freshness_days: 45,
      }),
    ).toThrow("Unsupported active Sustainability model")
    expect(() =>
      parseActiveSustainabilityConfig({
        model_version: seed.configRevision,
        score_model_version: seed.modelVersion,
        config_hash: "fnv1a_00000000",
        weights_json: seed.weights,
        toggles_json: seed.toggles,
        constants_json: seed.constants,
        sd_mode: seed.sdMode,
        freshness_days: seed.freshnessDays,
      }),
    ).toThrow("config hash mismatch")
  })

  it("requires exactly one active row from the database", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    }
    const client = { from: vi.fn().mockReturnValue(query) }
    await expect(
      loadActiveSustainabilityConfig(client as never),
    ).rejects.toThrow("exactly one active")
    expect(limit).toHaveBeenCalledWith(2)
  })
})
