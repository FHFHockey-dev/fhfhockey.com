import { teamsInfo } from "../teamsInfo";
import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";

export const PORTRAIT_STYLES = ["original", "posterized", "pixelated", "team-colors"] as const;
export type PortraitStyle = typeof PORTRAIT_STYLES[number];
export const PORTRAIT_LABELS: Record<PortraitStyle, string> = {
  original: "Original photo", posterized: "Posterized", pixelated: "Pixelated", "team-colors": "Team colors",
};
export const PORTRAIT_VERSION = "fhfh-portrait-v1";
export const MAX_PORTRAIT_PIXELS = 2_000_000;
export type PortraitTreatment = {
  style: PortraitStyle; version: typeof PORTRAIT_VERSION; sourceAlphaSha256: string;
  renderedSha256: string; width: number; height: number;
};
type Palette = { primaryColor: string; secondaryColor: string; darkColor?: string };

export function isPortraitStyle(value: unknown): value is PortraitStyle {
  return PORTRAIT_STYLES.some(style => style === value);
}

/** RGB-only transforms: the reviewed silhouette and every alpha byte are retained. */
export function portraitPixels(input: Uint8ClampedArray, width: number, height: number, style: PortraitStyle, palette: Palette): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PORTRAIT_PIXELS || input.length !== width * height * 4 || !isPortraitStyle(style)) throw new Error("Unsupported portrait dimensions or treatment.");
  const output = new Uint8ClampedArray(input);
  if (style === "original") return output;
  const rgb = (hex: string) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Team palette is unavailable.");
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  };
  const colors = [rgb(palette.darkColor || palette.primaryColor), rgb(palette.primaryColor), rgb(palette.secondaryColor), [242, 241, 235]];
  // Seven source pixels at the reviewed 1296px width; scale with actual dimensions.
  const block = Math.max(2, Math.round(width / 185));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (input[i + 3] === 0) continue;
    if (style === "pixelated") {
      const sx = Math.min(width - 1, Math.floor(x / block) * block + Math.floor(block / 2));
      const sy = Math.min(height - 1, Math.floor(y / block) * block + Math.floor(block / 2));
      const sample = (sy * width + sx) * 4;
      // Never pull hidden background RGB into a visible silhouette-edge pixel.
      const from = input[sample + 3] >= 128 ? sample : i;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = input[from + channel];
    } else if (style === "posterized") {
      // Quantize lightness in six bands while retaining the photographed hue.
      const light = Math.max(input[i], input[i + 1], input[i + 2]);
      const band = light < 34 ? 15 : light < 74 ? 52 : light < 118 ? 96 : light < 164 ? 143 : light < 210 ? 190 : 240;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = light === 0 ? 0 : Math.round(input[i + channel] / light * band / 12) * 12;
    } else {
      const luminance = .2126 * input[i] + .7152 * input[i + 1] + .0722 * input[i + 2];
      const position = Math.min(3, Math.round(luminance / 255 * 6) / 2);
      const low = Math.floor(position), high = Math.min(3, low + 1), weight = position - low;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = colors[low][channel] * (1 - weight) + colors[high][channel] * weight;
    }
  }
  return output;
}

export function portraitKey(hero: PreparedHero): string {
  return `${hero.treatment?.style || "original"}:${hero.treatment?.version || PORTRAIT_VERSION}:${hero.treatment?.renderedSha256 || hero.alphaSha256}`;
}

/** Always start from the verified original, never from a previously filtered derivative. */
export async function preparePortrait(hero: PreparedHero, style: PortraitStyle, signal?: AbortSignal): Promise<PreparedHero> {
  if (signal?.aborted) throw new DOMException("Portrait rendering cancelled.", "AbortError");
  if (!isPortraitStyle(style) || hero.treatment && hero.treatment.style !== "original" || !Number.isInteger(hero.sourceWidth) || !Number.isInteger(hero.sourceHeight) || hero.sourceWidth < 1 || hero.sourceHeight < 1 || hero.sourceWidth * hero.sourceHeight > MAX_PORTRAIT_PIXELS) throw new Error("A bounded, original reviewed portrait is required.");
  const treatment: PortraitTreatment = { style, version: PORTRAIT_VERSION, sourceAlphaSha256: hero.alphaSha256, renderedSha256: hero.alphaSha256, width: hero.sourceWidth, height: hero.sourceHeight };
  if (style === "original") return { ...hero, treatment };
  const palette = teamsInfo[hero.team];
  if (!palette) throw new Error("Team palette is unavailable.");
  const image = new Image(); image.src = hero.dataUrl; await image.decode();
  if (signal?.aborted) throw new DOMException("Portrait rendering cancelled.", "AbortError");
  if (image.naturalWidth !== hero.sourceWidth || image.naturalHeight !== hero.sourceHeight) throw new Error("Portrait dimensions changed.");
  const canvas = document.createElement("canvas"); canvas.width = hero.sourceWidth; canvas.height = hero.sourceHeight;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Portrait rendering is unavailable.");
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    frame.data.set(portraitPixels(frame.data, canvas.width, canvas.height, style, palette));
    context.putImageData(frame, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Portrait rendering failed.")), "image/png"));
    if (signal?.aborted) throw new DOMException("Portrait rendering cancelled.", "AbortError");
    const bytes = await blob.arrayBuffer();
    treatment.renderedSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Portrait could not be read.")); reader.readAsDataURL(blob);
    });
    return { ...hero, dataUrl, treatment };
  } finally { canvas.width = 0; canvas.height = 0; }
}
