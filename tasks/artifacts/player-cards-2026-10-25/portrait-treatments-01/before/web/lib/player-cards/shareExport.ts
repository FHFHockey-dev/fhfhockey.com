import type { FlowSnapshot } from "./interactionSnapshot";
import type { CardShareFormat, HeroSample, PreparedHero } from "../../components/player-cards/HeroPlayerCard";

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
  if (snapshot.source !== "synthetic" || snapshot.player.id !== String(hero.id) || svg.dataset.snapshotId !== snapshot.id || svg.dataset.artworkHash !== hero.alphaSha256 || svg.dataset.shareFormat !== format) throw new Error("The displayed card changed. Retry this snapshot.");
  if (snapshot.sample.gp === null || snapshot.sample.toiSeconds === null || !snapshot.readings.some(r => r.state === "valid")) throw new Error("Verified sample context is required to export.");
  const images = [...svg.querySelectorAll("image")];
  if (images.length !== 1 || images[0].getAttribute("href") !== hero.dataUrl || !hero.dataUrl.startsWith("data:image/png;base64,")) throw new Error("Embedded reviewed artwork is required to export.");
}

export async function rasterizePlayerCard(svg: SVGSVGElement, snapshot: FlowSnapshot, hero: PreparedHero, format: CardShareFormat): Promise<Blob> {
  assertCardExport(svg, snapshot, hero, format);
  const width = 1200, height = format === "social-square" ? 1200 : 1020;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", String(width)); copy.setAttribute("height", String(height)); copy.removeAttribute("class"); copy.removeAttribute("style");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PNG creation timed out. Please retry.")), 10000);
      const image = new Image(); image.onerror = () => { clearTimeout(timer); reject(new Error("PNG artwork could not be decoded.")); };
      image.onload = () => {
        try {
          assertCardExport(svg, snapshot, hero, format);
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
          context.drawImage(image, 0, 0);
          canvas.toBlob(blob => { clearTimeout(timer); try { assertCardExport(svg, snapshot, hero, format); if (!blob) throw new Error("PNG export failed."); resolve(blob); } catch (error) { reject(error); } }, "image/png");
        } catch (error) { clearTimeout(timer); reject(error); }
      }; image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
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
