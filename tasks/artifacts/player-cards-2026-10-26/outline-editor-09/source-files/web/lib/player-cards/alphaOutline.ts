import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { defaultOutlineStack, outlineStackKey, outlineTotal, teamOutlineColors, validateOutlineStack, type OutlineRing } from "./outlineStack";

export const PLAYER_RENDER_WIDTH = 600;
export const PLAYER_OUTLINE_PX = 5;
export const OUTLINE_SCALE = 2;
export const OUTLINE_VERSION = "fhfh-alpha-outline-v3";
export type OutlineInk = "white" | "primary" | "jersey" | "secondary" | "accent" | "stacked" | "custom";
type OutlineOption = { id: OutlineInk; label: string; color: string; bands?: [string, string, string] };
export function outlineInks(team: string): OutlineOption[] {
  const result: OutlineOption[] = teamOutlineColors(team).map(option => ({ ...option, id: option.id as OutlineInk }));
  const rings = defaultOutlineStack(team);
  if (rings.length === 3) result.push({ id: "stacked", label: "Stacked · 3 × 5 px (15 px total)", color: rings[0].color, bands: rings.map(r => r.color) as [string, string, string] });
  result.push({ id: "custom", label: "Customize stack…", color: "#FFFFFF" });
  return result;
}
const MAX_OUTLINE_PIXELS = 2_000_000;
export type PreparedPlayerOutline = {
  version: typeof OUTLINE_VERSION; sourceAlphaSha256: string; sha256: string; dataUrl: string;
  thickness: number; scale: 2; padding: number; width: number; height: number;
  ink: OutlineInk; color: string;
  bands?: [string, string, string]; bandWidth?: 5; rings?: OutlineRing[];
};
const cache = new Map<string, PreparedPlayerOutline>();

/** Exact squared Euclidean distance transform of a binary mask, in two linear passes. */
function distanceToContour(mask: Uint8ClampedArray, width: number, height: number): Float64Array {
  const distance = new Float64Array(width * height), length = Math.max(width, height);
  const f = new Float64Array(length), d = new Float64Array(length), sites = new Int32Array(length), intersections = new Float64Array(length + 1);
  for (let i = 0; i < distance.length; i++) distance[i] = mask[i * 4 + 3] >= 128 ? 0 : 1e12;
  function line(size: number) {
    let k = 0; sites[0] = 0; intersections[0] = -Infinity; intersections[1] = Infinity;
    for (let q = 1; q < size; q++) {
      let s = ((f[q] + q * q) - (f[sites[k]] + sites[k] * sites[k])) / (2 * q - 2 * sites[k]);
      while (s <= intersections[k]) { k--; s = ((f[q] + q * q) - (f[sites[k]] + sites[k] * sites[k])) / (2 * q - 2 * sites[k]); }
      k++; sites[k] = q; intersections[k] = s; intersections[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < size; q++) { while (intersections[k + 1] < q) k++; d[q] = (q - sites[k]) ** 2 + f[sites[k]]; }
  }
  for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) f[x] = distance[y * width + x]; line(width); for (let x = 0; x < width; x++) distance[y * width + x] = d[x]; }
  for (let x = 0; x < width; x++) { for (let y = 0; y < height; y++) f[y] = distance[y * width + x]; line(height); for (let y = 0; y < height; y++) distance[y * width + x] = d[y]; }
  return distance;
}

/** Single-color disk-dilation ring outside the 50%-alpha contour, never a rectangle or shadow.
 *  The one-raster-pixel outer coverage ramp is 0.5 design px at the fixed 2x scale.
 *  Original alpha is subtracted with destination-out semantics, including inner holes.
 */
export function alphaOutlinePixels(input: Uint8ClampedArray, width: number, height: number, radius = PLAYER_OUTLINE_PX * OUTLINE_SCALE, color = "#FFFFFF"): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_OUTLINE_PIXELS || input.length !== width * height * 4 || !Number.isFinite(radius) || radius <= 0 || radius > 20) throw new Error("Unsupported alpha-outline dimensions or radius.");
  const distance = distanceToContour(input, width, height), output = new Uint8ClampedArray(input.length);
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error("Unsupported outline color.");
  const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  for (let i = 0; i < distance.length; i++) {
    const coverage = Math.max(0, Math.min(1, radius + 1 - Math.sqrt(distance[i])));
    // Soft but interior cutout pixels must not receive a white underpaint.
    const alpha = input[i * 4 + 3] >= 128 ? 0 : Math.round(coverage * (255 - input[i * 4 + 3]));
    if (alpha) { output[i * 4] = rgb[0]; output[i * 4 + 1] = rgb[1]; output[i * 4 + 2] = rgb[2]; output[i * 4 + 3] = alpha; }
  }
  return output;
}

export function outlineRecipe(outline: PreparedPlayerOutline): OutlineRing[] {
  return validateOutlineStack(outline.rings || (outline.bands ? outline.bands.map(color => ({ color, width: 5 })) : [{ color: outline.color, width: outline.thickness }]));
}
export function outlineKey(outline?: PreparedPlayerOutline): string {
  return outline ? `${outline.version}:${outline.ink}:${outlineStackKey(outlineRecipe(outline))}:${outline.sha256}` : "none";
}
export function validOutlineSettings(hero: PreparedHero): boolean {
  try {
    if (hero.outlineSettings === undefined) return hero.outline?.ink !== "custom";
    const settings = validateOutlineStack(hero.outlineSettings);
    return settings.length ? !!hero.outline && hero.outline.ink === "custom" && outlineStackKey(settings) === outlineStackKey(outlineRecipe(hero.outline)) : !hero.outline;
  } catch { return false; }
}
export function validPlayerOutline(outline: PreparedPlayerOutline, hero: PreparedHero): boolean {
  try {
    const rings = outlineRecipe(outline), thickness = outlineTotal(rings), pad = thickness * OUTLINE_SCALE + 1;
    const option = outlineInks(hero.team).find(ink => ink.id === outline.ink);
    const expected = option?.bands ? option.bands.map(color => ({ color, width: 5 })) : [{ color: option?.color || "", width: 5 }];
    return !!rings.length && !!option && (outline.ink === "custom" ? !!outline.rings : outlineStackKey(rings) === outlineStackKey(expected)) && outline.color === rings[0].color && (outline.ink !== "stacked" || outline.bandWidth === 5 && JSON.stringify(outline.bands) === JSON.stringify(option.bands)) && outline.version === OUTLINE_VERSION && outline.sourceAlphaSha256 === hero.alphaSha256 && outline.thickness === thickness && outline.scale === OUTLINE_SCALE && outline.padding === pad && outline.width === PLAYER_RENDER_WIDTH * OUTLINE_SCALE + 2 * pad && outline.height === Math.ceil(PLAYER_RENDER_WIDTH * hero.sourceHeight / hero.sourceWidth * OUTLINE_SCALE) + 2 * pad && /^[a-f0-9]{64}$/.test(outline.sha256) && outline.dataUrl.startsWith("data:image/png;base64,");
  } catch { return false; }
}

/** One RGBA asset of disjoint annuli: D5, D10-D5, D15-D10. No opaque layer occlusion.
 *  Coverage differences partition every antialiased pixel; the sum is exactly D15.
 */
export function stackedOutlinePixels(input: Uint8ClampedArray, width: number, height: number, colors: readonly string[]): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_OUTLINE_PIXELS || input.length !== width * height * 4 || colors.length !== 3 || !colors.every(color => /^#[\da-f]{6}$/i.test(color)) || new Set(colors.map(color => color.toUpperCase())).size !== 3) throw new Error("Unsupported stacked outline dimensions or source colors.");
  return outlineBandPixels(input, width, height, colors.map(color => ({ color, width: 5 })));
}

/** Cumulative disk dilations partition into disjoint coverage bands, in final-card pixel units. */
export function outlineBandPixels(input: Uint8ClampedArray, width: number, height: number, recipe: readonly OutlineRing[]): Uint8ClampedArray {
  const rings = validateOutlineStack(recipe);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_OUTLINE_PIXELS || input.length !== width * height * 4) throw new Error("Unsupported alpha-outline dimensions.");
  const output = new Uint8ClampedArray(input.length); if (!rings.length) return output;
  const distance = distanceToContour(input, width, height);
  let radius = 0;
  const bands = rings.map(ring => ({ radius: radius += ring.width * OUTLINE_SCALE, rgb: [1, 3, 5].map(start => parseInt(ring.color.slice(start, start + 2), 16)) }));
  for (let i = 0; i < distance.length; i++) {
    if (input[i * 4 + 3] >= 128) continue;
    const d = Math.sqrt(distance[i]), outer = Math.max(0, Math.min(1, radius + 1 - d));
    const alpha = Math.round(outer * (255 - input[i * 4 + 3])); if (!alpha) continue;
    let previous = 0, red = 0, green = 0, blue = 0;
    for (const band of bands) {
      const coverage = Math.max(0, Math.min(1, band.radius + 1 - d)), weight = coverage - previous;
      red += weight * band.rgb[0]; green += weight * band.rgb[1]; blue += weight * band.rgb[2]; previous = coverage;
    }
    output[i * 4] = red / outer; output[i * 4 + 1] = green / outer; output[i * 4 + 2] = blue / outer; output[i * 4 + 3] = alpha;
  }
  return output;
}

/** Derive from the original reviewed alpha, independently of any RGB portrait treatment. */
export async function preparePlayerOutline(hero: PreparedHero, signal?: AbortSignal, ink: OutlineInk = "white", custom?: readonly OutlineRing[]): Promise<PreparedPlayerOutline> {
  if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
  if (!hero.dataUrl.startsWith("data:image/png;base64,") || hero.treatment && hero.treatment.style !== "original") throw new Error("Original reviewed alpha is required for the outline.");
  const option = outlineInks(hero.team).find(option => option.id === ink); if (!option) throw new Error("Verified team outline color is unavailable.");
  const rings = validateOutlineStack(ink === "custom" ? custom || [] : option.bands ? option.bands.map(color => ({ color, width: 5 })) : [{ color: option.color, width: 5 }]);
  if (!rings.length) throw new Error("An empty outline stack has no raster asset.");
  const key = `${hero.alphaSha256}:${hero.sourceWidth}:${hero.sourceHeight}:${ink}:${outlineStackKey(rings)}`;
  const existing = cache.get(key); if (existing) return existing;
  const thickness = outlineTotal(rings), padding = thickness * OUTLINE_SCALE + 1, contentWidth = PLAYER_RENDER_WIDTH * OUTLINE_SCALE, contentHeight = PLAYER_RENDER_WIDTH * hero.sourceHeight / hero.sourceWidth * OUTLINE_SCALE;
  const width = contentWidth + padding * 2, height = Math.ceil(contentHeight) + padding * 2;
  if (!Number.isFinite(height) || height < 1 || width * height > MAX_OUTLINE_PIXELS) throw new Error("Outline exceeds the bounded rendering size.");
  const image = new Image(); image.src = hero.dataUrl; await image.decode();
  if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
  if (image.naturalWidth !== hero.sourceWidth || image.naturalHeight !== hero.sourceHeight) throw new Error("Outline source dimensions changed.");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Outline rendering unavailable.");
    context.drawImage(image, padding, padding, contentWidth, contentHeight);
    const frame = context.getImageData(0, 0, width, height); frame.data.set(outlineBandPixels(frame.data, width, height, rings)); context.putImageData(frame, 0, 0);
    if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Outline encoding failed.")), "image/png"));
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, "0")).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Outline could not be read.")); reader.readAsDataURL(blob); });
    if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
    const result: PreparedPlayerOutline = { version: OUTLINE_VERSION, sourceAlphaSha256: hero.alphaSha256, sha256: hash, dataUrl, thickness, scale: 2, padding, width, height, ink, color: rings[0].color, rings, ...(option.bands ? { bands: option.bands, bandWidth: 5 as const } : {}) };
    if (cache.size >= 2) cache.delete(cache.keys().next().value!); cache.set(key, result);
    return result;
  } finally { canvas.width = 0; canvas.height = 0; }
}
