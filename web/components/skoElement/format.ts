import type { GapDirection, Measured } from "lib/skoElement/contract";

export const reasonText = (reason: string | null) => (reason ?? "unavailable").replace(/_/g, " ");

/** A Measured value, or an explicit "Unavailable" with its reason. Never renders a missing value as 0. */
export function formatMeasured(measured: Measured, digits = 2, signed = false): string {
  if (measured.value === null) return `Unavailable (${reasonText(measured.reason)})`;
  const text = measured.value.toFixed(digits);
  return signed && measured.value > 0 ? `+${text}` : text;
}

export const DIRECTION_TEXT: Record<GapDirection, string> = {
  rebound: "Rebound watch",
  cooling: "Cooling watch",
  level: "Level (not a stability or quality signal)",
  unavailable: "Gap unavailable",
};

export const percent = (value: number | null, digits = 1) => (value === null ? "Unavailable" : `${(value * 100).toFixed(digits)}%`);
