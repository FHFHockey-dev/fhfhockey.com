import type { EspnLeagueSettingsV1 } from "./contracts";

export type EspnScoringToolOverrideV1 = {
  version: 1;
  namespace: string;
  externalLeagueId: string;
  externalTeamId: string | null;
  leagueName: string;
  settings: EspnLeagueSettingsV1;
};

export function espnScoringOverrideKey(tool: string) {
  return `fhfh:espn:${tool}:settings:v1`;
}

export function loadEspnScoringOverride(
  storage: Pick<Storage, "getItem">,
  tool: string,
): EspnScoringToolOverrideV1 | null {
  try {
    const raw = storage.getItem(espnScoringOverrideKey(tool));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<EspnScoringToolOverrideV1>;
    if (
      value.version !== 1 ||
      typeof value.namespace !== "string" ||
      !value.namespace.startsWith("espn:") ||
      typeof value.externalLeagueId !== "string" ||
      typeof value.leagueName !== "string" ||
      !value.settings ||
      value.settings.version !== 1 ||
      value.settings.mappingVersion !== "espn-fhl-v1"
    ) {
      return null;
    }
    return value as EspnScoringToolOverrideV1;
  } catch {
    return null;
  }
}

export function saveEspnScoringOverride(
  storage: Pick<Storage, "setItem">,
  tool: string,
  value: EspnScoringToolOverrideV1,
) {
  storage.setItem(espnScoringOverrideKey(tool), JSON.stringify(value));
}
