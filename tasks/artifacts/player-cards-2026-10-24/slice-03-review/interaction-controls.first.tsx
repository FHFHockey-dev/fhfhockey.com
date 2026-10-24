import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PlayerCardFlow, { type FixtureLoader } from "../../../../web/components/player-cards/PlayerCardFlow";
import { buildInteractionFixture } from "../../../../web/lib/player-cards/interactionFixtures";
import * as exportModule from "../../../../web/components/player-cards/PlayerCardPreview";
const ready = () => waitFor(() => expect(screen.getByText("Fixture snapshot ready.")).toBeTruthy());
afterEach(() => { cleanup(); window.history.replaceState(null,"","/"); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps the newest strength/window result after an interrupted success and rejection", async () => {
  const loads: Array<{ data: ReturnType<typeof buildInteractionFixture>; resolve: (v: any) => void; reject: (e: unknown) => void }> = [];
  const loader: FixtureLoader = (...args) => new Promise((resolve, reject) => loads.push({ data: buildInteractionFixture(...args), resolve, reject }));
  const {container} = render(<PlayerCardFlow loadFixture={loader} />);
  fireEvent.change(screen.getByLabelText("Appearances per player"), {target:{value:"5"}});
  fireEvent.change(screen.getByLabelText("Strength · synthetic coverage"), {target:{value:"pp"}});
  expect(loads).toHaveLength(3);
  await act(async () => loads[2].resolve(loads[2].data)); await ready();
  const latest = container.querySelector("svg")!.outerHTML;
  await act(async () => { loads[1].reject(new Error("OLD_FAILED_FIXTURE")); loads[0].resolve(loads[0].data); });
  expect(container.querySelector("svg")!.outerHTML).toBe(latest);
  expect(container.querySelector("svg")!.textContent).toContain("Own L5 appearances · Power play");
  expect(document.body.textContent).not.toContain("OLD_FAILED_FIXTURE");
});

it("applies only the latest queued history state after export failure and retries from that snapshot", async () => {
  let reject!: (e: unknown) => void;
  const raster = vi.spyOn(exportModule,"cardPng").mockImplementationOnce(() => new Promise((_resolve,no) => {reject=no;})).mockResolvedValue(new Blob(["mockPNG"],{type:"image/png"}));
  vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:review"),revokeObjectURL:vi.fn()});
  vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  const {container} = render(<PlayerCardFlow />); await ready();
  const before = container.querySelector("svg")!.getAttribute("data-snapshot-id");
  const button = screen.getByRole("button",{name:"Download synthetic PNG"});
  fireEvent.click(button); fireEvent.click(button); fireEvent.click(button);
  expect(raster).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.history.pushState(null,"","?n=5&strength=pp"); window.dispatchEvent(new PopStateEvent("popstate"));
    window.history.pushState(null,"","?player=1002&n=20&strength=5v5"); window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(container.querySelector("svg")!.getAttribute("data-snapshot-id")).toBe(before);
  expect((screen.getByLabelText("Appearances per player") as HTMLSelectElement).disabled).toBe(true);
  await act(async () => reject(new Error("Synthetic raster failure")));
  await waitFor(() => expect(container.querySelector("svg")!.textContent).toContain("Own L20 appearances · 5v5"));
  expect(container.querySelector("svg")!.textContent).toContain("Example ID 1002");
  fireEvent.click(screen.getByRole("button",{name:"Download synthetic PNG"}));
  await screen.findByText("Synthetic PNG downloaded from the displayed snapshot.");
  expect(raster).toHaveBeenCalledTimes(2);
  expect(raster.mock.calls[1][1].player.id).toBe("1002");
  expect(raster.mock.calls[1][1].settings.period).toEqual({mode:"appearances",count:20});
  expect(raster.mock.calls[1][1].settings.strength).toBe("5v5");
});

it("exposes unverified appearance history honestly in the SVG accessible name [PC-S03-01]", async () => {
  window.history.replaceState(null,"","?case=history-gap");
  const {container} = render(<PlayerCardFlow />);
  await screen.findByText("Complete appearance history through the common cutoff is unverified");
  const svg = container.querySelector("svg")!;
  expect(svg.textContent).toContain("GP unverified");
  expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
  expect(svg.getAttribute("aria-label")).toContain("GP unverified");
});

it("keeps the missing-input reason inside the exported card for a short partial sample [PC-S03-02]", async () => {
  window.history.replaceState(null,"","?player=1004&case=metric-gap");
  const {container} = render(<PlayerCardFlow />);
  await screen.findByText("Partial source: affected values and ranks are unavailable.");
  const svg = container.querySelector("svg")!;
  expect(svg.textContent).toContain("Known short season");
  // The PNG is a clone of this SVG; outside details cannot explain its missing value.
  expect(svg.textContent).toMatch(/missing|incomplete/i);
});
