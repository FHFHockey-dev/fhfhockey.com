import { teamsInfo } from "lib/teamsInfo";

/** Tuesday tile body colour (`.trendTileArt` fade target), the background every neon logo must glow against. */
export const NEON_CARD = "#15191f";
/** TT-11 floor: WCAG 4.5:1 contrast against the card, so navy and black marks still read as neon. */
export const NEON_MIN_CONTRAST = 4.5;

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function hsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hex([h, s, l]: [number, number, number]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Raise HSL lightness (hue and saturation kept) just until the colour clears the contrast floor on the card. */
export function withNeonFloor(color: string) {
  const value = color.toLowerCase();
  if (contrast(value, NEON_CARD) >= NEON_MIN_CONTRAST) return value;
  const [h, s, l] = hsl(value);
  let lo = l, hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (contrast(hex([h, s, mid]), NEON_CARD) >= NEON_MIN_CONTRAST) hi = mid; else lo = mid; }
  return hex([h, s, hi]);
}

/**
 * TT-11: the logo's own neon colours. Stroke = lightColor (primaryColor when absent), halo = secondaryColor, each lifted
 * to the floor. The tile's green/red stays on its border, hero, sparkline, badge, labels and chips.
 */
export function teamNeon(abbreviation: string): { stroke: string; halo: string; strokeFrom: "lightColor" | "primaryColor" } | null {
  const info = teamsInfo[abbreviation];
  if (!info) return null;
  return { stroke: withNeonFloor(info.lightColor ?? info.primaryColor), halo: withNeonFloor(info.secondaryColor), strokeFrom: info.lightColor ? "lightColor" : "primaryColor" };
}
