import { teamsInfo } from "../teamsInfo";
import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { prepareTeamLogo } from "./teamLogo";
import { outlineKey, preparePlayerOutline } from "./alphaOutline";

export const PORTRAIT_STYLES = ["original", "posterized", "pixelated", "team-colors", "posterized-team-colors", "pixelated-team-colors"] as const;
export type PortraitStyle = typeof PORTRAIT_STYLES[number];
export const PORTRAIT_LABELS: Record<PortraitStyle, string> = {
  original: "Original photo", posterized: "Posterized", pixelated: "Pixelated", "team-colors": "Team colors",
  "posterized-team-colors": "Posterized → Team Colors", "pixelated-team-colors": "Pixelated → Team Colors",
};
export const PORTRAIT_VERSION = "fhfh-portrait-v1";
export const COMPOSITION_VERSION = "fhfh-sequential-v2";
export const MAX_PORTRAIT_PIXELS = 2_000_000;
export type PortraitTreatment = {
  style: PortraitStyle; version: typeof PORTRAIT_VERSION; sourceAlphaSha256: string;
  renderedSha256: string; width: number; height: number;
  composition?: { version: typeof COMPOSITION_VERSION; order: ["posterized" | "pixelated", "team-colors"]; firstStagePreset: "five-tone" | "fine"; firstPixelSha256: string; finalPixelSha256: string };
};
type Palette = { primaryColor: string; secondaryColor: string; darkColor?: string; jersey?: string };

export function isPortraitStyle(value: unknown): value is PortraitStyle {
  return PORTRAIT_STYLES.some(style => style === value);
}

export function isCompositionStyle(style: PortraitStyle): style is "posterized-team-colors" | "pixelated-team-colors" {
  return style === "posterized-team-colors" || style === "pixelated-team-colors";
}

/** RGB-only transforms: the reviewed silhouette and every alpha byte are retained. */
export function portraitPixels(input: Uint8ClampedArray, width: number, height: number, style: PortraitStyle, palette: Palette, compositionFirstStage = false, fullTeamPalette = false): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PORTRAIT_PIXELS || input.length !== width * height * 4 || !isPortraitStyle(style)) throw new Error("Unsupported portrait dimensions or treatment.");
  if (isCompositionStyle(style)) return compositionPixels(input, width, height, style, palette).final;
  const output = new Uint8ClampedArray(input);
  if (style === "original") return output;
  const rgb = (hex: string) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Team palette is unavailable.");
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  };
  const colors = [rgb(palette.darkColor || palette.primaryColor), rgb(palette.primaryColor), ...(fullTeamPalette ? [rgb(palette.jersey || palette.secondaryColor)] : []), rgb(palette.secondaryColor), [242, 241, 235]];
  // Combined: 11 source pixels at 1296px (formerly 22); standalone stays at seven.
  const block = Math.max(2, Math.round(width / (compositionFirstStage ? 120 : 185)));
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
      if (compositionFirstStage) {
        // Five flat regions retain the team's additional jersey ink in the second pass.
        const luminance = .2126 * input[i] + .7152 * input[i + 1] + .0722 * input[i + 2];
        const band = Math.round(Math.round(luminance / 255 * 4) * 255 / 4);
        output[i] = band; output[i + 1] = band; output[i + 2] = band;
        continue;
      }
      // Quantize lightness in six bands while retaining the photographed hue.
      const light = Math.max(input[i], input[i + 1], input[i + 2]);
      const band = light < 34 ? 15 : light < 74 ? 52 : light < 118 ? 96 : light < 164 ? 143 : light < 210 ? 190 : 240;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = light === 0 ? 0 : Math.round(input[i + channel] / light * band / 12) * 12;
    }
    if (style === "team-colors") {
      const luminance = .2126 * output[i] + .7152 * output[i + 1] + .0722 * output[i + 2];
      const last = colors.length - 1;
      const position = Math.min(last, Math.round(luminance / 255 * last * 2) / 2);
      const low = Math.floor(position), high = Math.min(last, low + 1), weight = position - low;
      for (let channel = 0; channel < 3; channel++) output[i + channel] = colors[low][channel] * (1 - weight) + colors[high][channel] * weight;
    }
  }
  return output;
}

/** Two actual buffers and passes: the team map consumes the completed first-stage output. */
export function compositionPixels(input: Uint8ClampedArray, width: number, height: number, style: "posterized-team-colors" | "pixelated-team-colors", palette: Palette) {
  const firstStyle: "posterized" | "pixelated" = style === "posterized-team-colors" ? "posterized" : "pixelated";
  const first = portraitPixels(input, width, height, firstStyle, palette, true);
  const final = portraitPixels(first, width, height, "team-colors", palette, false, true);
  return { firstStyle, first, final };
}

export function compositionKey(hero: PreparedHero): string {
  const proof = hero.treatment?.composition;
  return proof ? `${proof.version}:${proof.order.join(">")}:${proof.firstPixelSha256}:${proof.finalPixelSha256}` : "single";
}

export function portraitKey(hero: PreparedHero): string {
  return `${hero.treatment?.style || "original"}:${hero.treatment?.version || PORTRAIT_VERSION}:${hero.treatment?.renderedSha256 || hero.alphaSha256}${hero.teamLogo ? `:logo:${hero.teamLogo.sha256}` : ""}${hero.outline ? `:outline:${outlineKey(hero.outline)}` : ""}`;
}

/** RGB stages keep their order and pixels; the independent outline derives only from original alpha. */
export async function prepareOutlinedPortrait(hero: PreparedHero, style: PortraitStyle, signal?: AbortSignal): Promise<PreparedHero> {
  const treated = await preparePortrait(hero, style, signal);
  return { ...treated, outline: await preparePlayerOutline(hero, signal) };
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
    if (isCompositionStyle(style)) {
      const stages = compositionPixels(frame.data, canvas.width, canvas.height, style, palette);
      const pixelHash = async (data: Uint8ClampedArray) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data)))].map(n => n.toString(16).padStart(2, "0")).join("");
      treatment.composition = { version: COMPOSITION_VERSION, order: [stages.firstStyle, "team-colors"], firstStagePreset: stages.firstStyle === "posterized" ? "five-tone" : "fine", firstPixelSha256: await pixelHash(stages.first), finalPixelSha256: await pixelHash(stages.final) };
      frame.data.set(stages.final);
    } else frame.data.set(portraitPixels(frame.data, canvas.width, canvas.height, style, palette));
    context.putImageData(frame, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Portrait rendering failed.")), "image/png"));
    if (signal?.aborted) throw new DOMException("Portrait rendering cancelled.", "AbortError");
    const bytes = await blob.arrayBuffer();
    treatment.renderedSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Portrait could not be read.")); reader.readAsDataURL(blob);
    });
    const teamLogo = isCompositionStyle(style) ? await prepareTeamLogo(hero.team, signal) : undefined;
    return { ...hero, dataUrl, treatment, teamLogo };
  } finally { canvas.width = 0; canvas.height = 0; }
}
