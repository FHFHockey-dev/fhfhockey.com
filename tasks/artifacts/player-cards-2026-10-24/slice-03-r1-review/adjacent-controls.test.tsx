import React from "react";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {afterEach, expect, it} from "vitest";
import PlayerCardFlow from "../../../../web/components/player-cards/PlayerCardFlow";
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});

it("[independent S03-R1] keeps a full-N policy exclusion distinct from missing source",async()=>{
  window.history.replaceState(null,"","?player=1004&n=10&full=1");
  const {container}=render(<PlayerCardFlow/>);
  await screen.findByText("Known short season sample excluded by the proposed full-N policy");
  const svg=container.querySelector("svg")!;
  expect(svg.textContent).toContain("Undefined · full-N policy");
  expect(svg.textContent).not.toContain("Missing source");
  expect(svg.getAttribute("aria-label")).toContain("3 actual appearances");
  expect(svg.getAttribute("aria-label")).not.toContain("GP unverified");
  expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
});

it("[independent S03-R1] keeps a verified zero-appearance calendar distinct from unknown GP",async()=>{
  window.history.replaceState(null,"","?mode=calendar&start=2026-09-01&end=2026-09-02");
  const {container}=render(<PlayerCardFlow/>);
  await waitFor(()=>expect(container.querySelector("svg")?.textContent).toContain("0 GP"));
  const svg=container.querySelector("svg")!;
  expect(svg.textContent).toContain("Undefined · no appearances");
  expect(svg.textContent).not.toContain("Missing source");
  expect(svg.getAttribute("aria-label")).toContain("0 actual appearances");
  expect(svg.getAttribute("aria-label")).not.toContain("GP unverified");
  expect((screen.getByRole("button",{name:"Download synthetic PNG"}) as HTMLButtonElement).disabled).toBe(true);
});
