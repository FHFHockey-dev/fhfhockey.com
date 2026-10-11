import { toBlob } from "html-to-image";
import type { SocialShareSnapshot } from "./types";

export const SHARE_SIZE = 1080;
const fonts = [
  { family: "Share Roboto Condensed", file: "RobotoCondensed-Variable.ttf", weight: "100 900", sample: "700 48px" },
  { family: "Share Train One", file: "TrainOne-Regular.ttf", weight: "400", sample: "400 36px" },
  { family: "Share Martian Mono", file: "MartianMono-Variable.ttf", weight: "100 800", sample: "500 32px" },
];

export function bounded<T>(promise: Promise<T>, message: string, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export async function readyShareFonts() {
  for (const font of fonts) {
    const query = `${font.sample} "${font.family}"`;
    const loaded = await bounded(document.fonts.load(query), "Local fonts did not load. Retry preview preparation.");
    if (!loaded.length || !document.fonts.check(query)) throw new Error(`Required font unavailable: ${font.family}`);
  }
}

export function assertExportable(snapshot: SocialShareSnapshot) {
  if (snapshot.state !== "ready" || snapshot.source.state !== "ready") throw new Error("A complete, fresh schedule is required to download.");
  if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= Date.now()) throw new Error("This edition expired. Refresh the schedule before downloading.");
  if (!snapshot.selectedDates.length || !snapshot.rows.some(row => row.remainingGames > 0)) throw new Error("Select dates with remaining games before downloading.");
}

async function embeddedFonts() {
  return (await Promise.all(fonts.map(async font => {
    const response = await bounded(fetch(`/fonts/social-share/${font.file}`), "Local font download timed out.");
    if (!response.ok) throw new Error("Local font file unavailable.");
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to embed local font."));
      reader.readAsDataURL(blob);
    });
    return `@font-face{font-family:'${font.family}';src:url('${data}') format('truetype');font-weight:${font.weight};font-style:normal;font-display:block;}`;
  }))).join("\n");
}

export async function downloadSharePng(node: HTMLElement, snapshot: SocialShareSnapshot) {
  assertExportable(snapshot);
  await readyShareFonts();
  await Promise.all(Array.from(node.querySelectorAll("img")).map(async image => {
    await bounded(image.decode(), "Brand image could not be decoded. Retry preview preparation.");
    if (!image.naturalWidth) throw new Error("Brand image unavailable.");
  }));
  const fontEmbedCSS = await bounded(embeddedFonts(), "Font embedding timed out.");
  assertExportable(snapshot);
  const blob = await bounded(toBlob(node, {
    width: SHARE_SIZE, height: SHARE_SIZE, canvasWidth: SHARE_SIZE, canvasHeight: SHARE_SIZE,
    pixelRatio: 1, fontEmbedCSS, style: { transform: "none", transformOrigin: "top left" },
  }), "PNG creation timed out. Retry with the same edition.", 20000);
  if (!blob) throw new Error("PNG could not be created.");
  assertExportable(snapshot);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fhfh-${snapshot.format}-${snapshot.weekStart}-${snapshot.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20)}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
