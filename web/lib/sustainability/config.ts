import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "lib/supabase/database-generated.types"
import {
  SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS,
  SUSTAINABILITY_SCORE_CONFIG_HASH,
  SUSTAINABILITY_SCORE_MODEL_VERSION,
  SUSTAINABILITY_SCORE_PRECISION,
  SUSTAINABILITY_SCORE_WINDOW_CODES,
  buildSustainabilityConfigHash,
} from "./runtimeContract"
import type { WeightConfig } from "./score"

type SustainabilityClient = SupabaseClient<Database>

export type ActiveSustainabilityConfig = {
  configRevision: number
  modelVersion: string
  configHash: string
  weights: WeightConfig
  toggles: Record<string, Json | undefined>
  constants: Record<string, Json | undefined>
  sdMode: "fixed" | "empirical"
  freshnessDays: number
}

type ConfigRow = {
  model_version: number
  score_model_version: string
  config_hash: string
  weights_json: Json
  toggles_json: Json
  constants_json: Json
  sd_mode: string
  freshness_days: number
}

function isObject(value: Json): value is Record<string, Json | undefined> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function finiteWeight(value: Json | undefined, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid Sustainability weight: ${key}`)
  }
  return value
}

function parseWeights(value: Json): WeightConfig {
  if (
    !isObject(value) ||
    !isObject(value.luck as Json) ||
    !isObject(value.skill as Json)
  ) {
    throw new Error("Active Sustainability weights do not match score v2")
  }
  const luck = value.luck as Record<string, Json | undefined>
  const skill = value.skill as Record<string, Json | undefined>
  return {
    luck: {
      shp: finiteWeight(luck.shp, "luck.shp"),
      oishp: finiteWeight(luck.oishp, "luck.oishp"),
      ipp: finiteWeight(luck.ipp, "luck.ipp"),
      ppshp: finiteWeight(luck.ppshp, "luck.ppshp"),
    },
    skill: {
      ixg60: finiteWeight(skill.ixg60, "skill.ixg60"),
      icf60: finiteWeight(skill.icf60, "skill.icf60"),
      hdcf60: finiteWeight(skill.hdcf60, "skill.hdcf60"),
    },
  }
}

export function buildSustainabilityConfigIdentity(args: {
  modelVersion: string
  weights: WeightConfig
  toggles: Record<string, Json | undefined>
  constants: Record<string, Json | undefined>
  sdMode: "fixed" | "empirical"
  freshnessDays: number
}) {
  return buildSustainabilityConfigHash(args)
}

export function canonicalSustainabilityConfigSeed() {
  const weights: WeightConfig = {
    luck: { shp: -1.2, oishp: -1, ipp: -0.8, ppshp: -0.4 },
    skill: { ixg60: 0.9, icf60: 0.7, hdcf60: 0.6 },
  }
  const toggles: Record<string, Json | undefined> = {}
  const constants: Record<string, Json | undefined> = {
    scorePrecision: SUSTAINABILITY_SCORE_PRECISION,
    exactScoreProbabilityThresholds:
      SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS,
    windowCodes: [...SUSTAINABILITY_SCORE_WINDOW_CODES],
  }
  const identity = {
    modelVersion: SUSTAINABILITY_SCORE_MODEL_VERSION,
    weights,
    toggles,
    constants,
    sdMode: "fixed" as const,
    freshnessDays: 45,
  }
  if (
    buildSustainabilityConfigIdentity(identity) !==
    SUSTAINABILITY_SCORE_CONFIG_HASH
  ) {
    throw new Error("Canonical Sustainability config hash constant drifted")
  }
  return {
    configRevision: 2,
    ...identity,
    configHash: SUSTAINABILITY_SCORE_CONFIG_HASH,
  }
}

export function parseActiveSustainabilityConfig(
  row: ConfigRow,
): ActiveSustainabilityConfig {
  if (row.score_model_version !== SUSTAINABILITY_SCORE_MODEL_VERSION) {
    throw new Error(
      `Unsupported active Sustainability model: ${row.score_model_version}`,
    )
  }
  if (row.sd_mode !== "fixed" && row.sd_mode !== "empirical") {
    throw new Error(`Unsupported Sustainability sd mode: ${row.sd_mode}`)
  }
  const sdMode: "fixed" | "empirical" = row.sd_mode
  if (!isObject(row.toggles_json) || !isObject(row.constants_json)) {
    throw new Error("Active Sustainability config JSON must contain objects")
  }
  const weights = parseWeights(row.weights_json)
  const identity = {
    modelVersion: row.score_model_version,
    weights,
    toggles: row.toggles_json,
    constants: row.constants_json,
    sdMode,
    freshnessDays: row.freshness_days,
  }
  const expectedHash = buildSustainabilityConfigIdentity(identity)
  if (row.config_hash !== expectedHash) {
    throw new Error("Active Sustainability config hash mismatch")
  }
  return {
    configRevision: row.model_version,
    configHash: expectedHash,
    ...identity,
  }
}

export async function loadActiveSustainabilityConfig(
  client: SustainabilityClient,
): Promise<ActiveSustainabilityConfig> {
  const { data, error } = await client
    .from("model_sustainability_config")
    .select(
      "model_version, score_model_version, config_hash, weights_json, toggles_json, constants_json, sd_mode, freshness_days",
    )
    .eq("active", true)
    .order("model_version", { ascending: false })
    .limit(2)
  if (error) throw error
  if (data?.length !== 1) {
    throw new Error("Expected exactly one active Sustainability config")
  }
  return parseActiveSustainabilityConfig(data[0] as ConfigRow)
}
