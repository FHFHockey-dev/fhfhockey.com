import {
  GOALIE_SCORING_TARGETS,
  SKATER_SCORING_TARGETS,
} from "./contracts";
import {
  DEFAULT_GOALIE_FANTASY_POINTS,
  DEFAULT_SKATER_FANTASY_POINTS,
} from "lib/projectionsConfig/fantasyPointsConfig";
import { DEFAULT_CATEGORY_WEIGHTS } from "lib/user-settings/defaults";

export const FANTASY_PROJECTION_SCORING_V1_KEY =
  "fhfh:fantasy-projection-scoring:v1";
export const FANTASY_PROJECTION_SCORING_V2_KEY =
  "fhfh:fantasy-projection-scoring:v2";

export type FantasyProjectionScoringSettingsV2 = {
  version: 2;
  leagueType: "points" | "categories";
  skaterPoints: Record<string, number>;
  goaliePoints: Record<string, number>;
  categoryWeights: Record<string, number>;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function finiteMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, Number(raw)] as const)
      .filter(([, number]) => Number.isFinite(number)),
  );
}

export function defaultFantasyProjectionScoringSettings(): FantasyProjectionScoringSettingsV2 {
  return {
    version: 2,
    leagueType: "points",
    skaterPoints: { ...DEFAULT_SKATER_FANTASY_POINTS },
    goaliePoints: { ...DEFAULT_GOALIE_FANTASY_POINTS },
    categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
  };
}

function normalizeV2(value: unknown): FantasyProjectionScoringSettingsV2 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 2) return null;
  const defaults = defaultFantasyProjectionScoringSettings();
  const hasMap = (candidate: unknown) =>
    Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
  return {
    version: 2,
    leagueType: raw.leagueType === "categories" ? "categories" : "points",
    skaterPoints: hasMap(raw.skaterPoints)
      ? finiteMap(raw.skaterPoints)
      : defaults.skaterPoints,
    goaliePoints: hasMap(raw.goaliePoints)
      ? finiteMap(raw.goaliePoints)
      : defaults.goaliePoints,
    categoryWeights: hasMap(raw.categoryWeights)
      ? finiteMap(raw.categoryWeights)
      : defaults.categoryWeights,
  };
}

function migrateV1(value: unknown): FantasyProjectionScoringSettingsV2 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const combined = finiteMap(
    raw.version === 1 && raw.scoring && typeof raw.scoring === "object"
      ? raw.scoring
      : raw,
  );
  if (!Object.keys(combined).length) return null;
  const defaults = defaultFantasyProjectionScoringSettings();
  const skaterTargets = new Set<string>(SKATER_SCORING_TARGETS);
  const goalieTargets = new Set<string>(GOALIE_SCORING_TARGETS);
  for (const [key, value] of Object.entries(combined)) {
    if (skaterTargets.has(key)) defaults.skaterPoints[key] = value;
    if (goalieTargets.has(key)) defaults.goaliePoints[key] = value;
  }
  return defaults;
}

export function saveFantasyProjectionScoringSettings(
  storage: StorageLike,
  settings: FantasyProjectionScoringSettingsV2,
) {
  storage.setItem(
    FANTASY_PROJECTION_SCORING_V2_KEY,
    JSON.stringify({ ...settings, version: 2 }),
  );
}

export function readFantasyProjectionScoringSettings(storage: StorageLike): {
  settings: FantasyProjectionScoringSettingsV2;
  source: "v2" | "v1" | "default";
} {
  try {
    const rawV2 = storage.getItem(FANTASY_PROJECTION_SCORING_V2_KEY);
    const v2 = rawV2 ? normalizeV2(JSON.parse(rawV2)) : null;
    if (v2) return { settings: v2, source: "v2" };
  } catch {
    // A malformed v2 payload should not prevent migration of a valid v1 preset.
  }

  try {
    const rawV1 = storage.getItem(FANTASY_PROJECTION_SCORING_V1_KEY);
    const migrated = rawV1 ? migrateV1(JSON.parse(rawV1)) : null;
    if (migrated) {
      saveFantasyProjectionScoringSettings(storage, migrated);
      storage.removeItem(FANTASY_PROJECTION_SCORING_V1_KEY);
      return { settings: migrated, source: "v1" };
    }
  } catch {
    // Browser storage is optional; malformed values fall back safely.
  }
  return { settings: defaultFantasyProjectionScoringSettings(), source: "default" };
}
