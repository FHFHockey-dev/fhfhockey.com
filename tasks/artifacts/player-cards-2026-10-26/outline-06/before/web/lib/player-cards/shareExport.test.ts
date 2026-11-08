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
it("falls back to a local PNG download when file sharing is unsupported", async () => {
  vi.stubGlobal("navigator", {}); vi.stubGlobal("URL", { createObjectURL: () => "blob:fixture", revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  expect(await shareCardFile(new File(["png"], "card.png", { type: "image/png" }))).toBe("downloaded"); expect(click).toHaveBeenCalledOnce();
});
