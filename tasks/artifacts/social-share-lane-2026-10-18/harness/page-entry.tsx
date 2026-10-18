// Browser entry: mounts the real share studio component without Next.js.
import { createRoot } from "react-dom/client";
import { toBlob } from "html-to-image";
import SocialShare from "components/SocialShare/SocialShare";
import { SHARE_SIZE } from "lib/socialShare/export";
import type { SocialShareFormat } from "lib/socialShare/types";

const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  <SocialShare format={params.get("format") as SocialShareFormat} asOf={params.get("asOf")!} />
);

const files = [
  ["Share Roboto Condensed", "RobotoCondensed-Variable.ttf", "100 900"],
  ["Share Train One", "TrainOne-Regular.ttf", "400"],
  ["Share Martian Mono", "MartianMono-Variable.ttf", "100 800"],
];
async function fontEmbedCSS() {
  return (await Promise.all(files.map(async ([family, file, weight]) => {
    const blob = await (await fetch(`/fonts/social-share/${file}`)).blob();
    const data = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
    return `@font-face{font-family:'${family}';src:url('${data}') format('truetype');font-weight:${weight};font-style:normal;font-display:block;}`;
  }))).join("\n");
}

// Same toBlob options as downloadSharePng, minus its export gate, so blocked,
// partial and expired editions can be documented. Never a release path.
(window as unknown as { __capture: () => Promise<string> }).__capture = async () => {
  const node = document.querySelector<HTMLElement>("[data-testid=share-square]")!;
  const blob = await toBlob(node, {
    width: SHARE_SIZE, height: SHARE_SIZE, canvasWidth: SHARE_SIZE, canvasHeight: SHARE_SIZE,
    pixelRatio: 1, fontEmbedCSS: await fontEmbedCSS(), style: { transform: "none", transformOrigin: "top left" },
  });
  return new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob!); });
};
