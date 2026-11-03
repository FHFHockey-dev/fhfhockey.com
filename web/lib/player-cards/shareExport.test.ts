import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { assertCardExport, prepareHero, shareCardFile } from "./shareExport";
import { REVIEWED_HERO_SAMPLES } from "./reviewedHeroSamples";
import { displaySnapshot, flowSettings, INITIAL_FLOW } from "./interactionSnapshot";
import { adaptLocalSnapshot } from "./adapter";
import { buildInteractionFixture } from "./interactionFixtures";
import HeroPlayerCard from "../../components/player-cards/HeroPlayerCard";
import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import { PORTRAIT_VERSION, COMPOSITION_VERSION } from "./portraitTreatment";
import { OUTLINE_VERSION, outlineInks } from "./alphaOutline";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function card() {
  const sample = REVIEWED_HERO_SAMPLES[0], hero = { ...sample, dataUrl: "data:image/png;base64,AA==" };
  const result = adaptLocalSnapshot(buildInteractionFixture(flowSettings(INITIAL_FLOW), "complete", 1001), 1001);
  if (result.state === "rejected") throw new Error(result.reason);
  const snapshot = { ...displaySnapshot(result), player: { id: String(sample.id), name: sample.name, position: sample.position, team: sample.team } };
  const { container } = render(React.createElement(HeroPlayerCard, { snapshot, hero, format: "landscape" }));
  return { svg: container.querySelector("svg")!, snapshot, hero };
}
it("blocks changed snapshot, artwork identity, external images and unverified GP before export", () => {
  const { svg, snapshot, hero } = card(); expect(() => assertCardExport(svg, snapshot, hero, "landscape")).not.toThrow();
  expect(() => assertCardExport(svg, { ...snapshot, id: "changed" }, hero, "landscape")).toThrow("changed");
  expect(() => assertCardExport(svg, snapshot, { ...hero, id: 4 }, "landscape")).toThrow("changed");
  expect(() => assertCardExport(svg, { ...snapshot, sample: { ...snapshot.sample, gp: null } }, hero, "landscape")).toThrow("sample context");
  svg.dataset.portraitKey = "stale-treatment";
  expect(() => assertCardExport(svg, snapshot, hero, "landscape")).toThrow("changed");
  svg.dataset.portraitKey = `original:fhfh-portrait-v1:${hero.alphaSha256}`;
  svg.querySelector("image")!.setAttribute("href", "https://example.invalid/image.png"); expect(() => assertCardExport(svg, snapshot, hero, "landscape")).toThrow("Embedded");
});
it("only permits the known local asset namespace before any artwork fetch", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(prepareHero({ ...REVIEWED_HERO_SAMPLES[0], localPath: "https://example.invalid/hero.png" })).rejects.toThrow("Reviewed local artwork"); expect(fetcher).not.toHaveBeenCalled();
});
it("exports only the matching pinned embedded logo behind a combined portrait, with the left-quarter fade", () => {
  const { snapshot, hero } = card();
  const combined: PreparedHero = { ...hero, teamLogo: { team: "TOR", dataUrl: "data:image/png;base64,logo", sha256: "b88d6edb92e4bcca291f7d3a37c1265fee39e1f5ef41650aaa19d8a39ad7e01d", localPath: "/teamLogos/TOR.png" }, treatment: { style: "posterized-team-colors", version: PORTRAIT_VERSION, sourceAlphaSha256: hero.alphaSha256, renderedSha256: "a".repeat(64), width: hero.sourceWidth, height: hero.sourceHeight, composition: { version: COMPOSITION_VERSION, order: ["posterized", "team-colors"], firstStagePreset: "five-tone", firstPixelSha256: "b".repeat(64), finalPixelSha256: "c".repeat(64) } } };
  const { container } = render(React.createElement(HeroPlayerCard, { snapshot, hero: combined, format: "landscape" }));
  const svg = container.querySelector("svg")!;
  expect(() => assertCardExport(svg, snapshot, combined, "landscape")).not.toThrow();
  expect([...svg.querySelectorAll("image")].map(n => n.dataset)).toMatchObject([{ teamLogo: "true" }, { heroImage: "true" }]);
  expect([...svg.querySelectorAll('linearGradient[id$="logo-fade"] stop')].map(n => [n.getAttribute("offset"), n.getAttribute("stop-opacity")])).toEqual([["0", "0"], [".25", null], ["1", null]]);
  const logo = svg.querySelector('[data-team-logo="true"]')!;
  const player = svg.querySelector('[data-hero-image="true"]')!;
  expect(["x", "y", "width", "height", "preserveAspectRatio"].map(key => player.getAttribute(key))).toEqual(["600", "4", "600", "337.5", "xMidYMin meet"]);
  expect(logo.getAttribute("data-logo-anchor")).toBe("right-edge");
  expect(Number(logo.getAttribute("x")) + Number(logo.getAttribute("width")) - 1200).toBe(120);
  expect(Number(logo.getAttribute("y"))).toBeLessThan(0);
  expect(Number(logo.getAttribute("y")) + Number(logo.getAttribute("height"))).toBeGreaterThan(338);
  const pipelineKey = svg.dataset.pipelineKey;
  svg.dataset.pipelineKey = "stale-order"; expect(() => assertCardExport(svg, snapshot, combined, "landscape")).toThrow("pipeline");
  svg.dataset.pipelineKey = pipelineKey;
  svg.dataset.teamLogoHash = "changed"; expect(() => assertCardExport(svg, snapshot, combined, "landscape")).toThrow("logo");
  svg.dataset.teamLogoHash = combined.teamLogo!.sha256;
  logo.setAttribute("href", "https://example.invalid/logo.png"); expect(() => assertCardExport(svg, snapshot, combined, "landscape")).toThrow("logo");
  expect(() => assertCardExport(svg, snapshot, { ...combined, teamLogo: { ...combined.teamLogo!, team: "MIN" } }, "landscape")).toThrow("logo");
});
it("opens only a supported native share and treats cancellation as cancellation without downloading", async () => {
  const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
  vi.stubGlobal("navigator", { canShare: () => true, share });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const file = new File(["png"], "card.png", { type: "image/png" });
  expect(await shareCardFile(file)).toBe("cancelled"); expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] })); expect(click).not.toHaveBeenCalled();
});
it("binds the genuine padded 5px alpha ring behind the unchanged player in preview/export", () => {
  const { snapshot, hero } = card();
  const outlined: PreparedHero = { ...hero, outline: { version: OUTLINE_VERSION, thickness: 5, scale: 2, padding: 11, width: 1222, height: 697, sourceAlphaSha256: hero.alphaSha256, sha256: "d".repeat(64), dataUrl: "data:image/png;base64,outline", ink: "white", color: "#FFFFFF" } };
  const { container } = render(React.createElement(HeroPlayerCard, { snapshot, hero: outlined, format: "landscape" })); const svg = container.querySelector("svg")!;
  expect(() => assertCardExport(svg, snapshot, outlined, "landscape")).not.toThrow();
  expect([...svg.querySelectorAll("image")].map(node => node.hasAttribute("data-player-outline") ? "outline" : "hero")).toEqual(["outline", "hero"]);
  const ring = svg.querySelector('[data-player-outline="true"]')!;
  expect(["x", "y", "width", "height"].map(key => ring.getAttribute(key))).toEqual(["594.5", "-1.5", "611", "348.5"]);
  expect(svg.querySelector("filter")).toBeNull(); expect(svg.innerHTML).not.toContain("drop-shadow");
  svg.dataset.outlineKey = "stale"; expect(() => assertCardExport(svg, snapshot, outlined, "landscape")).toThrow("outline");
});
it("binds one three-band asset with exact5px widths and15px padded geometry", () => {
  const { snapshot, hero } = card(), option = outlineInks(hero.team).find(option => option.id === "stacked")!;
  const stacked: PreparedHero = { ...hero, outline: { version: OUTLINE_VERSION, thickness: 15, bandWidth: 5, bands: option.bands!, scale: 2, padding: 31, width: 1262, height: 737, sourceAlphaSha256: hero.alphaSha256, sha256: "e".repeat(64), dataUrl: "data:image/png;base64,stacked", ink: "stacked", color: option.color } };
  const { container } = render(React.createElement(HeroPlayerCard, { snapshot, hero: stacked, format: "landscape" })); const svg = container.querySelector("svg")!, ring = svg.querySelector('[data-player-outline="true"]')!;
  expect(svg.querySelectorAll('[data-player-outline="true"]').length).toBe(1); expect(() => assertCardExport(svg, snapshot, stacked, "landscape")).not.toThrow();
  expect(["x", "y", "width", "height", "data-outline-width", "data-outline-band-width"].map(key => ring.getAttribute(key))).toEqual(["584.5", "-11.5", "631", "368.5", "15", "5"]);
  expect(ring.getAttribute("data-outline-band-colors")).toBe(option.bands!.join(">"));
  ring.setAttribute("data-outline-band-width", "4"); expect(() => assertCardExport(svg, snapshot, stacked, "landscape")).toThrow("outline");
});
it("falls back to a local PNG download when file sharing is unsupported", async () => {
  vi.stubGlobal("navigator", {}); vi.stubGlobal("URL", { createObjectURL: () => "blob:fixture", revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  expect(await shareCardFile(new File(["png"], "card.png", { type: "image/png" }))).toBe("downloaded"); expect(click).toHaveBeenCalledOnce();
});
it("binds custom variable widths/colors and empty recipes to the displayed export", () => {
  const { snapshot, hero } = card(), rings = [{ color: "#123456", width: 2 }, { color: "#A6192E", width: 7.5 }], thickness = 9.5, padding = 20;
  const custom: PreparedHero = { ...hero, outlineSettings: rings, outline: { version: OUTLINE_VERSION, thickness, scale: 2, padding, width: 1240, height: 715, sourceAlphaSha256: hero.alphaSha256, sha256: "e".repeat(64), dataUrl: "data:image/png;base64,custom", ink: "custom", color: rings[0].color, rings } };
  const { container } = render(React.createElement(HeroPlayerCard, { snapshot, hero: custom, format: "landscape" })); const svg = container.querySelector("svg")!, ring = svg.querySelector('[data-player-outline]')!;
  expect(() => assertCardExport(svg, snapshot, custom, "landscape")).not.toThrow();
  expect(ring.getAttribute("data-outline-band-widths")).toBe("2>7.5");
  ring.setAttribute("data-outline-band-widths", "7.5>2"); expect(() => assertCardExport(svg, snapshot, custom, "landscape")).toThrow("outline");
  const empty: PreparedHero = { ...hero, outlineSettings: [] }, node = render(React.createElement(HeroPlayerCard, { snapshot, hero: empty, format: "landscape" })).container.querySelector("svg")!;
  expect(() => assertCardExport(node, snapshot, empty, "landscape")).not.toThrow();
  node.dataset.outlineSettings = "stale"; expect(() => assertCardExport(node, snapshot, empty, "landscape")).toThrow("settings");
});
