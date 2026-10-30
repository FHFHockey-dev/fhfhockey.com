import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";

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

/**
 * Raise HSL lightness (hue and saturation kept) just until the colour clears the contrast floor on the card. `min` is
 * a higher per-team floor for logos TJ asked to be brighter (TT-13, set in the offline bake).
 */
export function withNeonFloor(color: string, min = NEON_MIN_CONTRAST) {
  const value = color.toLowerCase();
  if (contrast(value, NEON_CARD) >= min) return value;
  const [h, s, l] = hsl(value);
  let lo = l, hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (contrast(hex([h, s, mid]), NEON_CARD) >= min) hi = mid; else lo = mid; }
  return hex([h, s, hi]);
}

type ColorField = "lightColor" | "primaryColor" | "secondaryColor" | "accent" | "jersey";
/**
 * Glow strength around the outline (TT-12, TJ): `normal` is TT-7's (white 3px at 50%, halo 2px at 55%); `soft` is smaller
 * and dimmer; `distinct` dims the white glow so the halo's own colour shows, without a wider halo.
 */
export type NeonSpread = "normal" | "soft" | "distinct";
export const NEON_SPREADS: Record<NeonSpread, { glowPx: number; glowAlpha: number; haloPx: number; haloAlpha: number }> = {
  normal: { glowPx: 3, glowAlpha: 0.5, haloPx: 2, haloAlpha: 0.55 },
  soft: { glowPx: 2, glowAlpha: 0.3, haloPx: 1.5, haloAlpha: 0.35 },
  distinct: { glowPx: 2, glowAlpha: 0.3, haloPx: 2, haloAlpha: 0.85 },
};
/**
 * TT-12: outlines baked offline in the logo's own colours (public/teamLogos/outline/color), not tinted at runtime.
 * The add-on (TJ) extends this to every team; NEON_SINGLE_COLOUR lists the ones that keep their tuned single colour.
 */
export const NEON_SINGLE_COLOUR: Readonly<Record<string, string>> = {
  TBL: "the logo is one blue, so a multi-colour bake is the same single colour; the tuned tint (distinct halo) stays",
  NSH: "TJ (TT-13): back to the TT-11 all-yellow single colour",
};
/**
 * Saved alternatives TJ wants kept (TT-13, "save both"): the switch is NEON_SINGLE_COLOUR. Adding the team there with
 * the reason shows the alternative; removing it shows the baked multi-colour outline. Nothing is deleted either way.
 */
export const NEON_SAVED_VARIANTS: Readonly<Record<string, string>> = {
  ANA: "TT-11 single orange (lightColor #ec623c, secondaryColor halo); shipped: the TT-12 multi-colour bake",
};
export const NEON_MULTICOLOUR: ReadonlySet<string> = new Set([...activeTeamAbbreviations].map(String).filter(team => !(team in NEON_SINGLE_COLOUR)));
/**
 * TJ's per-team choices from the TT-11 contact sheet (TT-12). Unlisted teams keep TT-11: lightColor stroke,
 * secondaryColor halo, normal spread.
 * - VGK: gold stroke. CHI / NYI / SJS: accent halo instead of a black secondary. DAL: jersey green (the neon green was abrasive).
 * - soft: BUF, CBJ, CHI, DAL, DET, MTL, NYR, OTT (dimmer, smaller glow).
 * - distinct: the "no difference" teams COL, EDM, FLA, LAK, MIN, STL, TBL, TOR, WSH. FLA, STL, TOR and WSH are on the
 *   dimmer list too: distinct dims their white glow and keeps the 2px halo, so both asks hold.
 * - MIN: jersey red halo against its green stroke; LAK: jersey white halo, the only colour apart from its silver.
 */
export const NEON_OVERRIDES: Record<string, { stroke?: ColorField; halo?: ColorField; spread?: NeonSpread }> = {
  VGK: { stroke: "secondaryColor" }, CHI: { halo: "accent", spread: "soft" }, NYI: { halo: "accent" }, SJS: { halo: "accent" },
  DAL: { stroke: "jersey", spread: "soft" },
  BUF: { spread: "soft" }, CBJ: { spread: "soft" }, DET: { spread: "soft" }, MTL: { spread: "soft" }, NYR: { spread: "soft" }, OTT: { spread: "soft" },
  COL: { spread: "distinct" }, EDM: { spread: "distinct" }, FLA: { spread: "distinct" }, LAK: { halo: "jersey", spread: "distinct" },
  MIN: { halo: "jersey", spread: "distinct" }, STL: { spread: "distinct" }, TBL: { spread: "distinct" }, TOR: { spread: "distinct" }, WSH: { spread: "distinct" },
};

export type TeamNeon = { stroke: string; halo: string; strokeFrom: ColorField; haloFrom: ColorField; spread: NeonSpread; multicolour: boolean };
/**
 * TT-11/12: the logo's own neon colours, each lifted to the floor. The tile's green/red stays on its border, hero,
 * sparkline, badge, labels and chips. Multi-colour teams still report their single stroke (the runtime fallback).
 */
export function teamNeon(abbreviation: string): TeamNeon | null {
  const info = teamsInfo[abbreviation];
  if (!info) return null;
  const override = NEON_OVERRIDES[abbreviation] ?? {};
  const strokeFrom: ColorField = override.stroke ?? (info.lightColor ? "lightColor" : "primaryColor"), haloFrom: ColorField = override.halo ?? "secondaryColor";
  return { stroke: withNeonFloor(info[strokeFrom] ?? info.primaryColor), halo: withNeonFloor(info[haloFrom] ?? info.secondaryColor), strokeFrom, haloFrom,
    spread: override.spread ?? "normal", multicolour: NEON_MULTICOLOUR.has(abbreviation) };
}
