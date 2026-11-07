import { contrast } from "lib/socialShare/teamNeon";

export const LIGHT_INK = "#ffffff";
export const DARK_INK = "#101214";

const toHex6 = (color: string) => {
  const value = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${[...value.slice(1)].map((c) => c + c).join("")}`;
  }
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
};

/**
 * The first team colour that reads on `background` at `min` contrast (WCAG 4.5:1 for text by default),
 * else white or near-black, whichever contrasts more. Same rule as the Team HQ tab bands.
 */
export function readableInk(background: string, candidates: string[], min = 4.5) {
  const bg = toHex6(background);
  if (!bg) return LIGHT_INK;
  for (const candidate of candidates) {
    const hex = toHex6(candidate);
    if (hex && contrast(hex, bg) >= min) return hex;
  }
  return contrast(LIGHT_INK, bg) >= contrast(DARK_INK, bg) ? LIGHT_INK : DARK_INK;
}
