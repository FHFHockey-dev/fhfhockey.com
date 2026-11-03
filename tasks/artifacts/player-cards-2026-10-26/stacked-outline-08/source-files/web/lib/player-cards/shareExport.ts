import type { FlowSnapshot } from "./interactionSnapshot";
import type { CardShareFormat, HeroSample, PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { portraitKey, compositionKey, COMPOSITION_VERSION, PORTRAIT_VERSION, isPortraitStyle, isCompositionStyle } from "./portraitTreatment";
import { isPreparedTeamLogo } from "./teamLogo";
import { outlineKey, validPlayerOutline } from "./alphaOutline";

export async function prepareHero(sample: HeroSample): Promise<PreparedHero> {
  if (sample.acceptance !== "accepted" || !/^\/player-cards\/hero-samples\/\d+\.png$/.test(sample.localPath)) throw new Error("Reviewed local artwork required.");
  const response = await fetch(sample.localPath);
  if (!response.ok) throw new Error("Reviewed artwork unavailable. Please retry.");
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (hash !== sample.alphaSha256) throw new Error("Artwork changed since review. Export blocked.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Artwork could not be read.")); reader.readAsDataURL(new Blob([bytes], { type: "image/png" }));
  });
  const image = new Image(); image.src = dataUrl; await image.decode();
  if (image.naturalWidth !== sample.sourceWidth || image.naturalHeight !== sample.sourceHeight) throw new Error("Artwork dimensions do not match the reviewed source.");
  return { ...sample, dataUrl };
}

export function assertCardExport(svg: SVGSVGElement, snapshot: FlowSnapshot, hero: PreparedHero, format: CardShareFormat) {
  if (snapshot.source !== "synthetic" || snapshot.player.id !== String(hero.id) || svg.dataset.snapshotId !== snapshot.id || svg.dataset.artworkHash !== hero.alphaSha256 || svg.dataset.shareFormat !== format || svg.dataset.portraitKey !== portraitKey(hero)) throw new Error("The displayed card changed. Retry this snapshot.");
  const treatment = hero.treatment;
  if (treatment && (!isPortraitStyle(treatment.style) || treatment.version !== PORTRAIT_VERSION || treatment.sourceAlphaSha256 !== hero.alphaSha256 || treatment.width !== hero.sourceWidth || treatment.height !== hero.sourceHeight || !/^[a-f0-9]{64}$/.test(treatment.renderedSha256))) throw new Error("Portrait provenance changed. Retry this snapshot.");
  if (snapshot.sample.gp === null || snapshot.sample.toiSeconds === null || !snapshot.readings.some(r => r.state === "valid")) throw new Error("Verified sample context is required to export.");
  const images = [...svg.querySelectorAll("image")];
  const composition = isCompositionStyle(treatment?.style || "original");
  if (composition) {
    const proof = treatment?.composition;
    const first = treatment?.style === "posterized-team-colors" ? "posterized" : "pixelated";
    if (!proof || proof.version !== COMPOSITION_VERSION || proof.order[0] !== first || proof.order[1] !== "team-colors" || proof.order.length !== 2 || !/^[a-f0-9]{64}$/.test(proof.firstPixelSha256) || !/^[a-f0-9]{64}$/.test(proof.finalPixelSha256) || svg.dataset.pipelineKey !== compositionKey(hero)) throw new Error("Sequential portrait pipeline changed. Retry this snapshot.");
  }
  const heroImage = svg.querySelector('[data-hero-image="true"]');
  if (images.length !== (composition ? 2 : 1) + (hero.outline ? 1 : 0) || heroImage?.getAttribute("href") !== hero.dataUrl || !hero.dataUrl.startsWith("data:image/png;base64,")) throw new Error("Embedded reviewed artwork is required to export.");
  const ring = svg.querySelector('[data-player-outline="true"]');
  if (hero.outline && (!validPlayerOutline(hero.outline, hero) || svg.dataset.outlineKey !== outlineKey(hero.outline) || ring?.getAttribute("href") !== hero.outline.dataUrl || ring?.getAttribute("data-outline-width") !== String(hero.outline.thickness) || hero.outline.bands && (ring?.getAttribute("data-outline-band-width") !== "5" || ring?.getAttribute("data-outline-band-colors") !== hero.outline.bands.join(">")))) throw new Error("The player outline changed. Retry this snapshot.");
  if (composition && (!isPreparedTeamLogo(hero.teamLogo, hero.team) || svg.dataset.teamLogoHash !== hero.teamLogo.sha256 || svg.querySelector('[data-team-logo="true"]')?.getAttribute("href") !== hero.teamLogo.dataUrl)) throw new Error("Embedded matching team logo is required to export.");
}

export async function rasterizePlayerCard(svg: SVGSVGElement, snapshot: FlowSnapshot, hero: PreparedHero, format: CardShareFormat): Promise<Blob> {
  const width = 1200, height = format === "social-square" ? 1200 : 1020;
  return rasterizeCardSvg(svg, () => assertCardExport(svg, snapshot, hero, format), width, height);
}

/** Shared bounded rasterization; each card supplies its own unchanged-snapshot assertion. */
export async function rasterizeCardSvg(svg: SVGSVGElement, assertCurrent: () => void, width: number, height: number): Promise<Blob> {
  assertCurrent();
  if (width !== 1200 || ![1020, 1200].includes(height)) throw new Error("Unsupported card dimensions");
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", String(width)); copy.setAttribute("height", String(height)); copy.removeAttribute("class"); copy.removeAttribute("style");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
  const backing: { canvas: HTMLCanvasElement | null } = { canvas: null };
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PNG creation timed out. Please retry.")), 10000);
      const image = new Image(); image.onerror = () => { clearTimeout(timer); reject(new Error("PNG artwork could not be decoded.")); };
      image.onload = () => {
        try {
          assertCurrent();
          const canvas = document.createElement("canvas"); backing.canvas = canvas; canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
          context.drawImage(image, 0, 0);
          canvas.toBlob(blob => { clearTimeout(timer); try { assertCurrent(); if (!blob) throw new Error("PNG export failed."); resolve(blob); } catch (error) { reject(error); } }, "image/png");
        } catch (error) { clearTimeout(timer); reject(error); }
      }; image.src = url;
    });
  } finally { if (backing.canvas) { backing.canvas.width = 0; backing.canvas.height = 0; } URL.revokeObjectURL(url); }
}

export function saveCardFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the device share sheet only on a user click. No automatic social posting. */
export async function shareCardFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "FHFH player card · illustrative statistics" }); return "shared"; }
    catch (error) { if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return "cancelled"; throw error; }
  }
  saveCardFile(file, file.name); return "downloaded";
}
