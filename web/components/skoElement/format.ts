import type { Measured } from "lib/skoElement/contract";

export const reasonText = (reason: string | null) => (reason ?? "unavailable").replace(/_/g, " ");

/** A Measured value, or an explicit "Unavailable" with its reason. Never renders a missing value as 0. */
export function formatMeasured(measured: Measured, digits = 2, signed = false): string {
  if (measured.value === null) return `Unavailable (${reasonText(measured.reason)})`;
  const text = measured.value.toFixed(digits);
  return signed && measured.value > 0 ? `+${text}` : text;
}

/** Units for a per-team-game difference, e.g. "Points per team game". Decision 130: units only, no alert words. */
export const perTeamGameUnit = (label: string) => `${label} per team game`;

export const percent = (value: number | null, digits = 1) => (value === null ? "Unavailable" : `${(value * 100).toFixed(digits)}%`);
