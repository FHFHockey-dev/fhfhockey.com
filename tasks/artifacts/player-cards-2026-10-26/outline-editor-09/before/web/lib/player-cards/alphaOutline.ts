import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { teamsInfo } from "../teamsInfo";

export const PLAYER_RENDER_WIDTH = 600;
export const PLAYER_OUTLINE_PX = 5;
export const OUTLINE_SCALE = 2;
export const OUTLINE_VERSION = "fhfh-alpha-outline-v2";
export type OutlineInk = "white" | "primary" | "jersey" | "secondary" | "accent" | "stacked";
type OutlineOption = { id: OutlineInk; label: string; color: string; bands?: [string, string, string] };
export function outlineInks(team: string): OutlineOption[] {
  const palette = teamsInfo[team], result: OutlineOption[] = [{ id: "white", label: "White · #FFFFFF", color: "#FFFFFF" }];
  for (const [id, label, color] of [["primary", "Primary", palette?.primaryColor], ["jersey", "Jersey", palette?.jersey], ["secondary", "Secondary", palette?.secondaryColor], ["accent", "Accent", palette?.accent]] as const) {
    if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color) && !result.some(ink => ink.color.toUpperCase() === color.toUpperCase())) result.push({ id, label: `${label} · ${color}`, color });
  }
  const bands = [palette?.primaryColor, palette?.jersey, palette?.secondaryColor].filter((color): color is string => typeof color === "string" && /^#[\da-f]{6}$/i.test(color));
  if (bands.length === 3 && new Set(bands.map(color => color.toUpperCase())).size === 3) result.push({ id: "stacked", label: "Stacked · 3 × 5 px (15 px total)", color: bands[0], bands: bands as [string, string, string] });
  return result;
}
const MAX_OUTLINE_PIXELS = 2_000_000;
export type PreparedPlayerOutline = {
  version: typeof OUTLINE_VERSION; sourceAlphaSha256: string; sha256: string; dataUrl: string;
  thickness: 5 | 15; scale: 2; padding: number; width: number; height: number;
  ink: OutlineInk; color: string;
  bands?: [string, string, string]; bandWidth?: 5;
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

export function outlineKey(outline?: PreparedPlayerOutline): string {
  return outline ? `${outline.version}:${outline.thickness}:${outline.ink}:${outline.bands?.join(">") || outline.color}:${outline.sha256}` : "none";
}
export function validPlayerOutline(outline: PreparedPlayerOutline, hero: PreparedHero): boolean {
  const option = outlineInks(hero.team).find(ink => ink.id === outline.ink && ink.color === outline.color), thickness = option?.bands ? 15 : 5, pad = thickness * OUTLINE_SCALE + 1;
  return !!option && (option.bands ? outline.bandWidth === 5 && JSON.stringify(outline.bands) === JSON.stringify(option.bands) : !outline.bands) && outline.version === OUTLINE_VERSION && outline.sourceAlphaSha256 === hero.alphaSha256 && outline.thickness === thickness && outline.scale === OUTLINE_SCALE && outline.padding === pad && outline.width === PLAYER_RENDER_WIDTH * OUTLINE_SCALE + 2 * pad && outline.height === Math.ceil(PLAYER_RENDER_WIDTH * hero.sourceHeight / hero.sourceWidth * OUTLINE_SCALE) + 2 * pad && /^[a-f0-9]{64}$/.test(outline.sha256) && outline.dataUrl.startsWith("data:image/png;base64,");
}

/** One RGBA asset of disjoint annuli: D5, D10-D5, D15-D10. No opaque layer occlusion.
 *  Coverage differences partition every antialiased pixel; the sum is exactly D15.
 */
export function stackedOutlinePixels(input: Uint8ClampedArray, width: number, height: number, colors: readonly string[]): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_OUTLINE_PIXELS || input.length !== width * height * 4 || colors.length !== 3 || !colors.every(color => /^#[\da-f]{6}$/i.test(color)) || new Set(colors.map(color => color.toUpperCase())).size !== 3) throw new Error("Unsupported stacked outline dimensions or source colors.");
  const distance = distanceToContour(input, width, height), output = new Uint8ClampedArray(input.length), rgb = colors.map(color => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)));
  for (let i = 0; i < distance.length; i++) {
    if (input[i * 4 + 3] >= 128) continue;
    const d = Math.sqrt(distance[i]), inner = Math.max(0, Math.min(1, 11 - d)), middle = Math.max(0, Math.min(1, 21 - d)), outer = Math.max(0, Math.min(1, 31 - d));
    const alpha = Math.round(outer * (255 - input[i * 4 + 3])); if (!alpha) continue;
    for (let channel = 0; channel < 3; channel++) output[i * 4 + channel] = (inner * rgb[0][channel] + (middle - inner) * rgb[1][channel] + (outer - middle) * rgb[2][channel]) / outer;
    output[i * 4 + 3] = alpha;
  }
  return output;
}

/** Derive from the original reviewed alpha, independently of any RGB portrait treatment. */
export async function preparePlayerOutline(hero: PreparedHero, signal?: AbortSignal, ink: OutlineInk = "white"): Promise<PreparedPlayerOutline> {
  if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
  if (!hero.dataUrl.startsWith("data:image/png;base64,") || hero.treatment && hero.treatment.style !== "original") throw new Error("Original reviewed alpha is required for the outline.");
  const option = outlineInks(hero.team).find(option => option.id === ink); if (!option) throw new Error("Verified team outline color is unavailable.");
  const key = `${hero.alphaSha256}:${hero.sourceWidth}:${hero.sourceHeight}:${ink}:${option.bands?.join(">") || option.color}`;
  const existing = cache.get(key); if (existing) return existing;
  const thickness = option.bands ? 15 : 5, padding = thickness * OUTLINE_SCALE + 1, contentWidth = PLAYER_RENDER_WIDTH * OUTLINE_SCALE, contentHeight = PLAYER_RENDER_WIDTH * hero.sourceHeight / hero.sourceWidth * OUTLINE_SCALE;
  const width = contentWidth + padding * 2, height = Math.ceil(contentHeight) + padding * 2;
  if (!Number.isFinite(height) || height < 1 || width * height > MAX_OUTLINE_PIXELS) throw new Error("Outline exceeds the bounded rendering size.");
  const image = new Image(); image.src = hero.dataUrl; await image.decode();
  if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
  if (image.naturalWidth !== hero.sourceWidth || image.naturalHeight !== hero.sourceHeight) throw new Error("Outline source dimensions changed.");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Outline rendering unavailable.");
    context.drawImage(image, padding, padding, contentWidth, contentHeight);
    const frame = context.getImageData(0, 0, width, height); frame.data.set(option.bands ? stackedOutlinePixels(frame.data, width, height, option.bands) : alphaOutlinePixels(frame.data, width, height, PLAYER_OUTLINE_PX * OUTLINE_SCALE, option.color)); context.putImageData(frame, 0, 0);
    if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Outline encoding failed.")), "image/png"));
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, "0")).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Outline could not be read.")); reader.readAsDataURL(blob); });
    if (signal?.aborted) throw new DOMException("Outline cancelled.", "AbortError");
    const result: PreparedPlayerOutline = { version: OUTLINE_VERSION, sourceAlphaSha256: hero.alphaSha256, sha256: hash, dataUrl, thickness, scale: 2, padding, width, height, ink, color: option.color, ...(option.bands ? { bands: option.bands, bandWidth: 5 as const } : {}) };
    if (cache.size >= 2) cache.delete(cache.keys().next().value!); cache.set(key, result);
    return result;
  } finally { canvas.width = 0; canvas.height = 0; }
}
