import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";

export const SOURCE_CONTROL_PREFERENCES_KEY = "draft.sourceControls.v4";
export const LEGACY_SOURCE_CONTROL_KEYS = [
  "draft.sourceControls.v3",
  "draft.sourceControls.v2"
] as const;

export type ProjectionSourceControls = Record<
  string,
  { isSelected: boolean; weight: number }
>;

type PreferencePayload = {
  version: 4;
  skater: ProjectionSourceControls;
  goalie: ProjectionSourceControls;
};

export function createDefaultSourceControls(
  sources: ProjectionSourceConfig[],
  playerType: "skater" | "goalie"
): ProjectionSourceControls {
  return Object.fromEntries(
    sources
      .filter((source) => source.playerType === playerType)
      .map((source) => [source.id, { isSelected: true, weight: 1 }])
  );
}

function clampWeight(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Number(Math.max(0, Math.min(2, numeric)).toFixed(3));
}

function sanitizeControls(
  defaults: ProjectionSourceControls,
  candidate: unknown
): ProjectionSourceControls {
  const source =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, any>)
      : {};
  const next: ProjectionSourceControls = {};
  for (const [id, fallback] of Object.entries(defaults)) {
    const saved = source[id];
    next[id] = saved
      ? {
          isSelected:
            typeof saved.isSelected === "boolean"
              ? saved.isSelected
              : typeof saved.enabled === "boolean"
                ? saved.enabled
                : fallback.isSelected,
          weight: clampWeight(saved.weight)
        }
      : { ...fallback };
  }
  return next;
}

function legacyArrayToMap(raw: unknown) {
  if (!Array.isArray(raw)) return {};
  const valid = raw.filter(
    (item) => item && typeof item === "object" && typeof item.id === "string"
  );
  const percentStyle = valid.some((item) => Number(item.weight) > 2);
  const enabledTotal = valid.reduce((total, item) => {
    const enabled = item.enabled ?? item.isSelected ?? true;
    const weight = Math.max(0, Number(item.weight) || 0);
    return enabled ? total + weight : total;
  }, 0);

  return Object.fromEntries(
    valid.map((item) => {
      const isSelected = Boolean(item.enabled ?? item.isSelected ?? true);
      const rawWeight = Math.max(0, Number(item.weight) || 0);
      const weight =
        percentStyle && enabledTotal > 0 && isSelected
          ? rawWeight / enabledTotal
          : rawWeight;
      return [item.id, { isSelected, weight }];
    })
  );
}

export function loadSourceControlPreferences(
  defaults: { skater: ProjectionSourceControls; goalie: ProjectionSourceControls },
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> =
    window.localStorage
): PreferencePayload {
  try {
    const current = storage.getItem(SOURCE_CONTROL_PREFERENCES_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed?.version === 4) {
        return {
          version: 4,
          skater: sanitizeControls(defaults.skater, parsed.skater),
          goalie: sanitizeControls(defaults.goalie, parsed.goalie)
        };
      }
    }

    for (const key of LEGACY_SOURCE_CONTROL_KEYS) {
      const legacy = storage.getItem(key);
      if (!legacy) continue;
      const mapped = legacyArrayToMap(JSON.parse(legacy));
      const migrated: PreferencePayload = {
        version: 4,
        skater: sanitizeControls(defaults.skater, mapped),
        goalie: sanitizeControls(defaults.goalie, mapped)
      };
      saveSourceControlPreferences(migrated, defaults, storage);
      for (const legacyKey of LEGACY_SOURCE_CONTROL_KEYS) {
        storage.removeItem(legacyKey);
      }
      return migrated;
    }
  } catch {
    // Invalid preferences fail closed to current official-source defaults.
  }

  return {
    version: 4,
    skater: sanitizeControls(defaults.skater, defaults.skater),
    goalie: sanitizeControls(defaults.goalie, defaults.goalie)
  };
}

export function saveSourceControlPreferences(
  controls: PreferencePayload,
  defaults: { skater: ProjectionSourceControls; goalie: ProjectionSourceControls },
  storage: Pick<Storage, "setItem"> = window.localStorage
) {
  const payload: PreferencePayload = {
    version: 4,
    skater: sanitizeControls(defaults.skater, controls.skater),
    goalie: sanitizeControls(defaults.goalie, controls.goalie)
  };
  storage.setItem(SOURCE_CONTROL_PREFERENCES_KEY, JSON.stringify(payload));
}
