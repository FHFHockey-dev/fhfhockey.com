import { toBlob } from "html-to-image";
import type { ShareTrendKind, SocialShareSnapshot } from "./types";

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

/** Owned team logo, downscaled once to a small data URL so grid exports embed ~32 tiny images, not 768px files. */
export async function teamLogoDataUrl(abbreviation: string, size = 96): Promise<string> {
  if (!/^[A-Z]{3}$/.test(abbreviation)) throw new Error("Invalid team abbreviation.");
  const image = new Image();
  image.src = `/teamLogos/${abbreviation}.png`;
  await bounded(image.decode(), "Team logo unavailable", 5000);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Team logo unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/png");
}

/** `trend` gates one Tuesday section; `token` must still match the node's data-export-token at capture (lane TT). */
/**
 * Neon outline (TT-5): the offline-traced white outline (public/teamLogos/outline, from committed logos) tinted to one
 * colour on a canvas and returned as a data URL, the same way team logos are inlined, so html-to-image draws it as-is.
 */
export async function teamOutlineDataUrl(abbreviation: string, color: string, size = 112): Promise<string> {
  if (!/^[A-Z]{3}$/.test(abbreviation) || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Invalid outline request.");
  const image = new Image();
  image.src = `/teamLogos/outline/${abbreviation}.png`;
  await bounded(image.decode(), "Team outline unavailable", 5000);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Team outline unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size, size);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, size, size);
  return canvas.toDataURL("image/png");
}

export type ShareExportOptions = { opponents?: boolean; players?: boolean; trend?: ShareTrendKind; card?: string; token?: string };

export function assertExportable(snapshot: SocialShareSnapshot, options: ShareExportOptions = {}) {
  if (snapshot.state !== "ready" || snapshot.source.state !== "ready") throw new Error("A complete, fresh schedule is required to download.");
  if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= Date.now()) throw new Error("This edition expired. Refresh the schedule before downloading.");
  if (!snapshot.selectedDates.length || !snapshot.rows.some(row => row.remainingGames > 0)) throw new Error("Select dates with remaining games before downloading.");
  if (options.opponents && snapshot.opponents?.state !== "ready") throw new Error("Current, complete opponent team ratings are required to download this card.");
  if (options.players && snapshot.players?.state !== "ready") throw new Error("Current player ownership and season totals are required to download this card.");
  if (options.trend && (snapshot.trends?.version !== 2 || snapshot.trends.sections[options.trend].state !== "ready")) throw new Error(options.trend === "movers" ? "Current Yahoo ownership is required to download this card." : "Current rolling game metrics are required to download this card.");
}

/** The preview must still show the edition and card that were clicked (no swap between click and capture). */
export function assertToken(node: HTMLElement, options: ShareExportOptions) {
  if (options.token !== undefined && node.getAttribute("data-export-token") !== options.token) throw new Error("The preview changed after Download was clicked. Download again.");
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

export async function downloadSharePng(node: HTMLElement, snapshot: SocialShareSnapshot, options: ShareExportOptions = {}) {
  assertExportable(snapshot, options);
  assertToken(node, options);
  await readyShareFonts();
  await Promise.all(Array.from(node.querySelectorAll("img")).map(async image => {
    await bounded(image.decode(), "Brand image could not be decoded. Retry preview preparation.");
    if (!image.naturalWidth) throw new Error("Brand image unavailable.");
  }));
  const fontEmbedCSS = await bounded(embeddedFonts(), "Font embedding timed out.");
  assertExportable(snapshot, options);
  assertToken(node, options);
  const blob = await bounded(toBlob(node, {
    width: SHARE_SIZE, height: SHARE_SIZE, canvasWidth: SHARE_SIZE, canvasHeight: SHARE_SIZE,
    pixelRatio: 1, fontEmbedCSS, style: { transform: "none", transformOrigin: "top left" },
  }), "PNG creation timed out. Retry with the same edition.", 20000);
  if (!blob) throw new Error("PNG could not be created.");
  assertExportable(snapshot, options);
  assertToken(node, options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fhfh-${snapshot.format}${options.card ? `-${options.card.replace(/[^a-z0-9-]/g, "")}` : ""}-${snapshot.weekStart}-${snapshot.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20)}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
