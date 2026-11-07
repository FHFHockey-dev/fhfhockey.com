import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PlayerCardShareStudio from "./PlayerCardShareStudio";
import { REVIEWED_HERO_SAMPLES } from "../../lib/player-cards/reviewedHeroSamples";
import type { HeroSample, PreparedHero } from "./HeroPlayerCard";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const loaded = async (sample: HeroSample): Promise<PreparedHero> => ({ ...sample, dataUrl: "data:image/png;base64,AA==" });
const ready = () => waitFor(() => expect(screen.getByRole("button", { name: "Social Share" }).hasAttribute("disabled")).toBe(false));

it("shows actual photo identity, explicit fictional statistics and same-snapshot landscape/square compositions", async () => {
  const { container } = render(<PlayerCardShareStudio loadArtwork={loaded} />); await ready();
  const first = container.querySelector("svg")!;
  expect(first.getAttribute("aria-label")).toContain("not this player's actual results");
  expect(first.textContent).toContain("AUSTON"); expect(first.textContent).toContain("MATTHEWS");
  const id = first.dataset.snapshotId;
  fireEvent.change(screen.getByLabelText("Image format"), { target: { value: "social-square" } });
  expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 1200 1200");
  expect(container.querySelector("svg")!.dataset.snapshotId).toBe(id);
});
it("ignores an older artwork load that resolves after a new player selection", async () => {
  const pending: { sample: HeroSample; resolve: (hero: PreparedHero) => void }[] = [];
  const loader = (sample: HeroSample) => new Promise<PreparedHero>(resolve => pending.push({ sample, resolve }));
  const { container } = render(<PlayerCardShareStudio loadArtwork={loader} />);
  fireEvent.change(screen.getByLabelText("Reviewed artwork"), { target: { value: REVIEWED_HERO_SAMPLES[1].id } });
  await act(async () => pending[1].resolve(await loaded(pending[1].sample))); await ready();
  await act(async () => pending[0].resolve(await loaded(pending[0].sample)));
  expect(container.querySelector("svg")!.textContent).toContain("KAPRIZOV");
  expect(container.querySelector("svg")!.dataset.artworkHash).toBe(REVIEWED_HERO_SAMPLES[1].alphaSha256);
});
it("blocks missing artwork, retries it, and keeps verified partial/unknown-stat states honest", async () => {
  let fail = true;
  const loader = async (sample: HeroSample) => { if (fail) throw new Error("Artwork unavailable"); return loaded(sample); };
  const { container } = render(<PlayerCardShareStudio loadArtwork={loader} />);
  await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "Download PNG" }).hasAttribute("disabled")).toBe(true);
  fail = false; fireEvent.click(screen.getByRole("button", { name: "Retry artwork" })); await ready();
  fireEvent.change(screen.getByLabelText("Statistics preview"), { target: { value: "metric-gap" } });
  expect(container.querySelector('[data-metric-id="ixg60"] [data-unavailable]')!.textContent).toContain("Missing source");
  fireEvent.change(screen.getByLabelText("Statistics preview"), { target: { value: "history-gap" } });
  expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("GP unverified");
  expect(screen.getByRole("button", { name: "Download PNG" }).hasAttribute("disabled")).toBe(true);
});
it("freezes selection during preparation, suppresses repeated clicks and invalidates a prepared file after changes", async () => {
  let finish!: (blob: Blob) => void;
  const rasterize = vi.fn(() => new Promise<Blob>(resolve => { finish = resolve; }));
  render(<PlayerCardShareStudio loadArtwork={loaded} rasterize={rasterize} />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Social Share" })); fireEvent.click(screen.getByRole("button", { name: "Social Share" }));
  expect(rasterize).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Reviewed artwork").hasAttribute("disabled")).toBe(true);
  await act(async () => finish(new Blob(["png"], { type: "image/png" })));
  expect(screen.getByRole("button", { name: "Share prepared image" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Image format"), { target: { value: "social-square" } });
  expect(screen.queryByRole("button", { name: "Share prepared image" })).toBeNull();
});
