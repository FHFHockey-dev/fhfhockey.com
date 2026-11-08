import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { assertCardExport, prepareHero, shareCardFile } from "./shareExport";
import { REVIEWED_HERO_SAMPLES } from "./reviewedHeroSamples";
import { displaySnapshot, flowSettings, INITIAL_FLOW } from "./interactionSnapshot";
import { adaptLocalSnapshot } from "./adapter";
import { buildInteractionFixture } from "./interactionFixtures";
import HeroPlayerCard from "../../components/player-cards/HeroPlayerCard";

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
  svg.querySelector("image")!.setAttribute("href", "https://example.invalid/image.png"); expect(() => assertCardExport(svg, snapshot, hero, "landscape")).toThrow("Embedded");
});
it("only permits the known local asset namespace before any artwork fetch", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(prepareHero({ ...REVIEWED_HERO_SAMPLES[0], localPath: "https://example.invalid/hero.png" })).rejects.toThrow("Reviewed local artwork"); expect(fetcher).not.toHaveBeenCalled();
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
