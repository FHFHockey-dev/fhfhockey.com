import {
  SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS,
  SUSTAINABILITY_SCORE_PRECISION
} from "./runtimeContract";

export type SustainabilityGuardrailState = "ok" | "degraded" | "blocked";

export type SustainabilityGuardrailResult = {
  sRaw: number;
  s100: number;
  components: Record<string, unknown>;
  state: SustainabilityGuardrailState;
  warnings: string[];
};

const SCORE_RAW_LIMIT = 8;
const Z_SCORE_LIMIT = 3;
const LUCK_PRESSURE_LIMIT = 12;
const GUARDED_Z_KEYS = ["z_shp", "z_oishp", "z_ipp", "z_ppshp"] as const;

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function round(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

function mergeWarnings(
  components: Record<string, unknown>,
  warnings: string[]
): Record<string, unknown> {
  const existing = Array.isArray(components.warnings)
    ? components.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  return {
    ...components,
    warnings: [...new Set([...existing, ...warnings])]
  };
}

const LUCK_INPUTS = ["shp", "oishp", "ipp", "ppshp"] as const;
const SKILL_INPUTS = ["ixg60", "icf60", "hdcf60"] as const;

export type SustainabilityScoreCoverage = {
  /** False for legacy rows that never recorded which inputs were missing. */
  assessed: boolean;
  luckKnown: number;
  luckTotal: number;
  skillKnown: number;
  skillTotal: number;
  /** Both input families have at least one known component. */
  sufficient: boolean;
};

/**
 * Which score inputs were actually known (BC W1-9 A2). A missing input was
 * scored as z = 0, so a score with no luck or no skill input is not a
 * measurement of the blend at all: it is unavailable, never a neutral 50.
 */
export function assessSustainabilityScoreCoverage(
  components: Record<string, unknown> | null | undefined
): SustainabilityScoreCoverage {
  const record = components ?? {};
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((w): w is string => typeof w === "string")
    : null;
  const assessed = warnings !== null || "fallbackFlags" in record;
  const known = (list: readonly string[], prefix: string, nullKey: boolean) =>
    list.filter(
      (stat) =>
        !(warnings ?? []).includes(`${prefix}${stat}`) &&
        !(nullKey && record[`z_${stat}`] === null)
    ).length;
  const luckKnown = known(LUCK_INPUTS, "missing_window_z_", false);
  const skillKnown = known(SKILL_INPUTS, "missing_skill_window_", true);
  return {
    assessed,
    luckKnown,
    luckTotal: LUCK_INPUTS.length,
    skillKnown,
    skillTotal: SKILL_INPUTS.length,
    sufficient: !assessed || (luckKnown > 0 && skillKnown > 0)
  };
}

export function clampSustainabilityZScore(
  value: unknown,
  key: string,
  warnings: string[],
  limit = Z_SCORE_LIMIT
): number {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    warnings.push(`guardrail_invalid_${key}`);
    return 0;
  }
  const clipped = clamp(numericValue, -limit, limit);
  if (clipped !== numericValue) warnings.push(`guardrail_clipped_${key}`);
  return clipped;
}

export function applySustainabilityScoreGuardrails(input: {
  sRaw: unknown;
  s100?: unknown;
  components?: Record<string, unknown> | null;
  recomputeScore?: boolean;
  precision?: number;
}): SustainabilityGuardrailResult {
  const precision = input.precision ?? SUSTAINABILITY_SCORE_PRECISION;
  const warnings: string[] = [];
  const components = { ...(input.components ?? {}) };

  for (const key of GUARDED_Z_KEYS) {
    if (key in components) {
      components[key] = clampSustainabilityZScore(components[key], key, warnings);
    }
  }

  const rawValue = toFiniteNumber(input.sRaw);
  let state: SustainabilityGuardrailState = "ok";
  let sRaw = 0;
  if (rawValue === null) {
    warnings.push("guardrail_invalid_s_raw");
    state = "blocked";
  } else {
    sRaw = clamp(rawValue, -SCORE_RAW_LIMIT, SCORE_RAW_LIMIT);
    if (sRaw !== rawValue) warnings.push("guardrail_clipped_s_raw");
  }

  let s100: number;
  if (input.recomputeScore ?? true) {
    s100 = round(100 * sigmoid(sRaw), precision);
  } else {
    const scoreValue = toFiniteNumber(input.s100);
    if (scoreValue === null) {
      warnings.push("guardrail_invalid_s_100");
      state = "blocked";
      s100 = round(100 * sigmoid(sRaw), precision);
    } else {
      s100 = round(clamp(scoreValue, 0, 100), precision);
      if (s100 !== scoreValue) warnings.push("guardrail_clipped_s_100");
      const rawProbability = sigmoid(sRaw);
      if (
        s100 === 100 &&
        rawProbability < SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS.upper
      ) {
        warnings.push("guardrail_invalid_exact_100");
        s100 = round(100 * rawProbability, precision);
      } else if (
        s100 === 0 &&
        rawProbability > SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS.lower
      ) {
        warnings.push("guardrail_invalid_exact_0");
        s100 = round(100 * rawProbability, precision);
      }
    }
  }

  const coverage = assessSustainabilityScoreCoverage(components);
  if (!coverage.sufficient) {
    warnings.push("guardrail_insufficient_inputs");
    state = "blocked";
  } else if (
    coverage.assessed &&
    (coverage.luckKnown < coverage.luckTotal ||
      coverage.skillKnown < coverage.skillTotal)
  ) {
    warnings.push("guardrail_partial_inputs");
  }

  if (Math.abs(sRaw) >= SCORE_RAW_LIMIT || warnings.length > 0) {
    state = state === "blocked" ? "blocked" : "degraded";
  }

  return {
    sRaw: round(sRaw, 6),
    s100,
    components: {
      ...mergeWarnings(components, warnings),
      ...(coverage.assessed
        ? {
            inputCoverage: {
              luck: coverage.luckKnown,
              luckTotal: coverage.luckTotal,
              skill: coverage.skillKnown,
              skillTotal: coverage.skillTotal
            }
          }
        : {}),
      guardrailState: state
    },
    state,
    warnings
  };
}

export function guardSustainabilityDashboardRow(input: {
  sRaw: unknown;
  s100: unknown;
  luckPressure: unknown;
  components?: Record<string, unknown> | null;
  precision?: number;
}): SustainabilityGuardrailResult & { luckPressure: number } {
  const warnings: string[] = [];
  const score = applySustainabilityScoreGuardrails({
    sRaw: input.sRaw,
    s100: input.s100,
    components: input.components,
    recomputeScore: false,
    precision: input.precision
  });
  warnings.push(...score.warnings);

  const luckPressureValue = toFiniteNumber(input.luckPressure);
  let luckPressure = 0;
  let state = score.state;
  if (luckPressureValue === null) {
    warnings.push("guardrail_invalid_luck_pressure");
    state = "blocked";
  } else {
    luckPressure = clamp(
      luckPressureValue,
      -LUCK_PRESSURE_LIMIT,
      LUCK_PRESSURE_LIMIT
    );
    if (luckPressure !== luckPressureValue) {
      warnings.push("guardrail_clipped_luck_pressure");
      state = state === "blocked" ? "blocked" : "degraded";
    }
  }

  return {
    ...score,
    luckPressure: round(luckPressure, 6),
    state,
    warnings: [...new Set(warnings)],
    components: {
      ...mergeWarnings(score.components, warnings),
      guardrailState: state
    }
  };
}
