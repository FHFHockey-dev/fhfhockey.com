import { formatSecondsToMMSS } from "utils/formattingUtils";

export const WIGO_TIMEFRAME_KEYS = [
  "STD",
  "LY",
  "3YA",
  "CA",
  "L5",
  "L10",
  "L20"
] as const;

export type WigoTimeframeKey = (typeof WIGO_TIMEFRAME_KEYS)[number];

export const WIGO_STAT_ORDER = [
  "GP",
  "ATOI",
  "Points",
  "Goals",
  "Assists",
  "SOG",
  "S%",
  "PPP",
  "PPG",
  "PPA",
  "PPTOI",
  "PP%",
  "HIT",
  "BLK",
  "PIM",
  "ixG",
  "iCF",
  "G/60",
  "A/60",
  "PTS/60",
  "SOG/60",
  "ixG/60",
  "iCF/60",
  "PPP/60",
  "PPG/60",
  "PPA/60",
  "iHDCF/60",
  "iSCF/60",
  "HIT/60",
  "BLK/60",
  "PIM/60",
  "IPP",
  "oiSH%",
  "OZS%",
  "PTS1%",
  "PTS1/60"
] as const;

export type WigoStatLabel = (typeof WIGO_STAT_ORDER)[number];

type WigoStatFormatKind =
  | "integer"
  | "decimal1"
  | "decimal2"
  | "percent1"
  | "timeSeconds";

type WigoStatNormalization =
  | "identity"
  | "minutesToSeconds"
  | "fractionToPercent";

type WigoDiffMode = "direct" | "perGameCount";

export interface WigoStatMetadata {
  label: WigoStatLabel;
  baseKey: string;
  formatKind: WigoStatFormatKind;
  normalization: WigoStatNormalization;
  diffMode: WigoDiffMode;
  includeGpMetadata: boolean;
  isPerSixty: boolean;
}

const createStat = (
  label: WigoStatLabel,
  baseKey: string,
  formatKind: WigoStatFormatKind,
  normalization: WigoStatNormalization = "identity",
  diffMode: WigoDiffMode = "direct",
  includeGpMetadata = false,
  isPerSixty = false
): WigoStatMetadata => ({
  label,
  baseKey,
  formatKind,
  normalization,
  diffMode,
  includeGpMetadata,
  isPerSixty
});

export const WIGO_STAT_METADATA: Record<WigoStatLabel, WigoStatMetadata> = {
  GP: createStat("GP", "gp", "integer", "identity", "direct", true),
  ATOI: createStat(
    "ATOI",
    "atoi",
    "timeSeconds",
    "minutesToSeconds",
    "direct",
    true
  ),
  Points: createStat(
    "Points",
    "pts",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  Goals: createStat(
    "Goals",
    "g",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  Assists: createStat(
    "Assists",
    "a",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  SOG: createStat(
    "SOG",
    "sog",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  "S%": createStat("S%", "s_pct", "percent1", "fractionToPercent"),
  PPP: createStat(
    "PPP",
    "ppp",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  PPG: createStat(
    "PPG",
    "ppg",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  PPA: createStat(
    "PPA",
    "ppa",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  PPTOI: createStat("PPTOI", "pptoi", "timeSeconds", "identity", "direct", true),
  "PP%": createStat("PP%", "pp_pct", "percent1", "fractionToPercent"),
  HIT: createStat(
    "HIT",
    "hit",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  BLK: createStat(
    "BLK",
    "blk",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  PIM: createStat(
    "PIM",
    "pim",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  ixG: createStat(
    "ixG",
    "ixg",
    "decimal1",
    "identity",
    "perGameCount",
    true
  ),
  iCF: createStat(
    "iCF",
    "icf",
    "integer",
    "identity",
    "perGameCount",
    true
  ),
  "G/60": createStat("G/60", "g_per_60", "decimal2", "identity", "direct", false, true),
  "A/60": createStat("A/60", "a_per_60", "decimal2", "identity", "direct", false, true),
  "PTS/60": createStat(
    "PTS/60",
    "pts_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "SOG/60": createStat(
    "SOG/60",
    "sog_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "ixG/60": createStat(
    "ixG/60",
    "ixg_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "iCF/60": createStat(
    "iCF/60",
    "icf_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "PPP/60": createStat(
    "PPP/60",
    "ppp_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "PPG/60": createStat(
    "PPG/60",
    "ppg_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "PPA/60": createStat(
    "PPA/60",
    "ppa_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "iHDCF/60": createStat(
    "iHDCF/60",
    "ihdcf_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "iSCF/60": createStat(
    "iSCF/60",
    "iscf_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "HIT/60": createStat(
    "HIT/60",
    "hit_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "BLK/60": createStat(
    "BLK/60",
    "blk_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  "PIM/60": createStat(
    "PIM/60",
    "pim_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  ),
  IPP: createStat("IPP", "ipp", "percent1", "fractionToPercent"),
  "oiSH%": createStat("oiSH%", "oi_sh_pct", "percent1", "fractionToPercent"),
  "OZS%": createStat("OZS%", "ozs_pct", "percent1", "fractionToPercent"),
  "PTS1%": createStat("PTS1%", "pts1_pct", "percent1", "fractionToPercent"),
  "PTS1/60": createStat(
    "PTS1/60",
    "pts1_per_60",
    "decimal2",
    "identity",
    "direct",
    false,
    true
  )
};

export function getWigoStatMetadata(label: string): WigoStatMetadata | undefined {
  return WIGO_STAT_METADATA[label as WigoStatLabel];
}

export function isWigoStatLabel(label: string): label is WigoStatLabel {
  return Object.prototype.hasOwnProperty.call(WIGO_STAT_METADATA, label);
}

export function normalizeWigoAggregateValue(
  label: string,
  value: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  const metadata = getWigoStatMetadata(label);
  if (!metadata) {
    return value;
  }

  switch (metadata.normalization) {
    case "minutesToSeconds":
      return value * 60;
    case "fractionToPercent":
      return value * 100;
    case "identity":
    default:
      return value;
  }
}

export function formatWigoStatValue(
  label: string,
  value: number | null | undefined
): string {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  const metadata = getWigoStatMetadata(label);
  if (!metadata) {
    return value.toFixed(1);
  }

  switch (metadata.formatKind) {
    case "integer":
      return Math.round(value).toString();
    case "decimal2":
      return value.toFixed(2);
    case "percent1":
      return `${value.toFixed(1)}%`;
    case "timeSeconds":
      return formatSecondsToMMSS(value);
    case "decimal1":
    default:
      return value.toFixed(1);
  }
}

export function shouldUseGpForDiff(label: string): boolean {
  return getWigoStatMetadata(label)?.diffMode === "perGameCount";
}

export function shouldAttachGpMetadata(label: string): boolean {
  return getWigoStatMetadata(label)?.includeGpMetadata ?? false;
}

export function isWigoTimeStat(label: string): boolean {
  return getWigoStatMetadata(label)?.formatKind === "timeSeconds";
}

export function isWigoPercentStat(label: string): boolean {
  return getWigoStatMetadata(label)?.formatKind === "percent1";
}

export function isWigoCountChartStat(label: string): boolean {
  const metadata = getWigoStatMetadata(label);

  return (
    metadata?.diffMode === "perGameCount" || metadata?.formatKind === "timeSeconds"
  );
}
