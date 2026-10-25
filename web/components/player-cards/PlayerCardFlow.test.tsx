import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerCardFlow, { type FixtureLoader } from "./PlayerCardFlow";
import { buildInteractionFixture } from "../../lib/player-cards/interactionFixtures";
import type { LocalCardInput } from "../../lib/player-cards/adapter";
import * as frozenExport from "./PlayerCardPreview";

afterEach(() => { cleanup(); window.history.replaceState(null,"","/"); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const ready = () => waitFor(() => expect(screen.getByText("Fixture snapshot ready.")).toBeTruthy());

describe("free fixture selection / period / snapshot flow", () => {
  it("recomputes ownL5/L10/L20 and inclusive calendar context from game records", async () => {
    const {container} = render(<PlayerCardFlow />); await ready();
    const old = container.querySelector("svg")!.textContent;
    fireEvent.change(screen.getByLabelText("Appearances per player"),{target:{value:"5"}}); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("Own L5 appearances");
    expect(container.querySelector("svg")!.textContent).not.toBe(old);
    fireEvent.change(screen.getByLabelText("Appearances per player"),{target:{value:"20"}}); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("20 of 20 GP");
    fireEvent.change(screen.getByLabelText("Period mode"),{target:{value:"calendar"}}); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("2026-10-10 to 2026-10-23 · UTC");
    expect(container.querySelector("svg")!.textContent).toContain("Shared calendar dates · actual GP can differ");
  });
  it("disambiguates duplicate names by stable example identity and keeps short samples explicit", async () => {
    const {container} = render(<PlayerCardFlow />); await ready();
    fireEvent.change(screen.getByLabelText("Search example skaters"),{target:{value:"Alex Morgan"}});
    fireEvent.click(screen.getByRole("button",{name:"Alex Morgan · Summit · C · ID 1002"})); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("Summit · example · C · Example ID 1002");
    fireEvent.change(screen.getByLabelText("Search example skaters"),{target:{value:"Jamie"}});
    fireEvent.click(screen.getByRole("button",{name:"Jamie Chen · Harbour · LW · ID 1004"})); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("3 of 10 GP");
    fireEvent.change(screen.getByLabelText("Short season policy · proposed"),{target:{value:"full"}});
    await waitFor(() => expect(screen.getByText("Known short season sample excluded by the proposed full-N policy")).toBeTruthy());
    expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows metric gaps and unavailable source/history without exporting stale values", async () => {
    const {container} = render(<PlayerCardFlow />); await ready();
    fireEvent.change(screen.getByLabelText("Source scenario · synthetic"),{target:{value:"metric-gap"}});
    await waitFor(() => expect(screen.getByText("Partial source: affected values and ranks are unavailable.")).toBeTruthy());
    expect(container.querySelector("svg")!.textContent).toContain("—");
    fireEvent.change(screen.getByLabelText("Source scenario · synthetic"),{target:{value:"history-gap"}});
    await waitFor(() => expect(screen.getByText("Complete appearance history through the common cutoff is unverified")).toBeTruthy());
    expect(container.querySelector("svg")!.textContent).toContain("TOI unavailable");
    expect(container.querySelector("svg")!.textContent).toContain("GP unverified");
    expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
  });
  it("rejects invalid ranges and retries a failed local load", async () => {
    let fail = true;
    const loader: FixtureLoader = async (...args) => { if (fail) throw new Error("Example local read failed"); return buildInteractionFixture(...args); };
    render(<PlayerCardFlow loadFixture={loader} />);
    await screen.findByText("Example local read failed"); fail = false;
    fireEvent.click(screen.getByRole("button",{name:"Retry local fixture"})); await ready();
    fireEvent.change(screen.getByLabelText("Period mode"),{target:{value:"calendar"}}); await ready();
    fireEvent.change(screen.getByLabelText("Start date · inclusive UTC"),{target:{value:"2026-10-30"}});
    await screen.findByText("Invalid inclusive UTC calendar range");
    expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
  });
  it("ignores interrupted older loads when a newer period finishes first", async () => {
    const pending: {resolve:(data:LocalCardInput)=>void;data:LocalCardInput}[]=[];
    const loader: FixtureLoader = (...args) => new Promise(resolve => pending.push({resolve,data:buildInteractionFixture(...args)}));
    const {container}=render(<PlayerCardFlow loadFixture={loader} />);
    fireEvent.change(screen.getByLabelText("Appearances per player"),{target:{value:"5"}});
    await act(async () => pending[1].resolve(pending[1].data)); await ready();
    await act(async () => pending[0].resolve(pending[0].data));
    expect(container.querySelector("svg")!.textContent).toContain("Own L5 appearances");
    expect(container.querySelector("svg")!.textContent).not.toContain("Own L10 appearances");
  });
  it("restores a compatible state on Back/Forward popstate", async () => {
    const {container}=render(<PlayerCardFlow />); await ready();
    await act(async () => { window.history.pushState(null,"","?player=1002&mode=appearances&n=5"); window.dispatchEvent(new PopStateEvent("popstate")); }); await ready();
    expect(container.querySelector("svg")!.textContent).toContain("Own L5 appearances");
    expect(container.querySelector("svg")!.textContent).toContain("Example ID 1002");
  });
  it("freezes the exported snapshot, ignores repeated clicks and queues history changes until export finishes", async () => {
    let finish!: (blob:Blob)=>void;
    const raster = vi.spyOn(frozenExport,"cardPng").mockImplementation(() => new Promise(resolve => {finish=resolve;}));
    vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:synthetic"),revokeObjectURL:vi.fn()});
    vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    const {container}=render(<PlayerCardFlow />); await ready();
    fireEvent.click(screen.getByRole("button",{name:"Download synthetic PNG"}));
    fireEvent.click(screen.getByRole("button",{name:"Creating PNG…"}));
    expect(raster).toHaveBeenCalledTimes(1);
    expect(raster.mock.calls[0][1].settings.period).toEqual({mode:"appearances",count:10});
    expect((screen.getByLabelText("Appearances per player") as HTMLSelectElement).disabled).toBe(true);
    await act(async () => {window.history.pushState(null,"","?n=5");window.dispatchEvent(new PopStateEvent("popstate"));});
    expect(container.querySelector("svg")!.textContent).toContain("Own L10 appearances");
    await act(async () => finish(new Blob(["example PNG"],{type:"image/png"})));
    await waitFor(()=>expect(container.querySelector("svg")!.textContent).toContain("Own L5 appearances"));
  });
  it("keeps short-sample and missing-input explanations inside the standalone SVG", async () => {
    window.history.replaceState(null,"","?player=1004&case=metric-gap");
    const {container}=render(<PlayerCardFlow />);
    await screen.findByText("Partial source: affected values and ranks are unavailable.");
    const svg=container.querySelector("svg")!;
    expect(svg.textContent).toContain("Known short season · proposed policy · Missing source");
    expect(svg.textContent).toContain("Missing source · incomplete inputs");
  });
  it("labels complete zero-exposure metrics as undefined in the banner and SVG", async () => {
    window.history.replaceState(null,"","?mode=calendar&start=2026-10-01&end=2026-10-01&strength=pp");
    const {container}=render(<PlayerCardFlow />);
    await screen.findByText("Some metrics undefined: zero denominator or selected period policy.");
    const svg=container.querySelector("svg")!;
    expect(svg.textContent).toContain("1 GP · 0.0 min TOI");
    expect(svg.textContent).toContain("Undefined · zero denominator");
    expect(svg.textContent).not.toContain("Missing source");
    expect(screen.getByRole("status").textContent).not.toContain("Partial source");
  });
  it("announces unverified GP without a null-valued appearance count", async () => {
    window.history.replaceState(null,"","?case=history-gap");
    const {container}=render(<PlayerCardFlow />);
    await screen.findByText("Complete appearance history through the common cutoff is unverified");
    const label=container.querySelector("svg")!.getAttribute("aria-label");
    expect(label).toContain("GP unverified");expect(label).not.toContain("null actual appearances");
  });
});
