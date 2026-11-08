import React from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ResearchPlayerCardStudio from "./ResearchPlayerCardStudio";
import ResearchPlayerCard from "./ResearchPlayerCard";
import ResearchCardEvidence from "./ResearchCardEvidence";
import { RESEARCH_EXAMPLES, RESEARCH_MANIFEST_SHA256, type ResearchExample } from "../../lib/player-cards/researchExamples";
import { readResearchFixture, withPlayerResearchSnapshot, type ResearchHost } from "../../lib/player-cards/researchSnapshot";
import { assertResearchExport } from "../../lib/player-cards/researchExport";
const root = path.join(process.cwd(), "lib/player-cards/research-fixtures");
const load = async (example: ResearchExample) => ({ fixtureText: await readFile(path.join(root, example.file), "utf8"), manifestSha256: RESEARCH_MANIFEST_SHA256 });
beforeEach(() => vi.stubGlobal("crypto", webcrypto));afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("loads only by explicit selection and shows independent missing/sparse/BLSH/issuance evidence", async () => {
  const loader = vi.fn(load); render(<ResearchPlayerCardStudio load={loader} />); expect(loader).not.toHaveBeenCalled(); expect(screen.queryByRole("img")).toBeNull();
  fireEvent.change(screen.getByLabelText("Historical example"), { target: { value: "luke_hughes_sparse_streak_oct31.json" } });
  await screen.findByRole("img"); expect(loader).toHaveBeenCalledTimes(1); expect(screen.getAllByText(/2\/50 reference slots/).length).toBeGreaterThan(0); expect(screen.getByRole("img").textContent).toContain("-73.80"); expect(screen.getByRole("img").textContent).toContain("Trusted: false");
  expect(screen.getByText(/Value per game is the last recorded game value/)).toBeTruthy(); expect(screen.getByText(/Source availability, retrieval and issuance time: unknown/)).toBeTruthy();
});
it("ignores a late historical response after changing or clearing selection", async () => {
  const pending: { example: ResearchExample; resolve: (value: Awaited<ReturnType<typeof load>>) => void }[] = [];
  const loader = (example: ResearchExample) => new Promise<Awaited<ReturnType<typeof load>>>(resolve => pending.push({ example, resolve })); render(<ResearchPlayerCardStudio load={loader} />);
  fireEvent.change(screen.getByLabelText("Historical example"), { target: { value: RESEARCH_EXAMPLES[0].file } });
  fireEvent.change(screen.getByLabelText("Historical example"), { target: { value: RESEARCH_EXAMPLES[6].file } });
  await act(async () => pending[1].resolve(await load(pending[1].example))); await screen.findByRole("img");
  await act(async () => pending[0].resolve(await load(pending[0].example))); expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Luke Hughes");
  fireEvent.change(screen.getByLabelText("Historical example"), { target: { value: "" } }); expect(screen.queryByRole("img")).toBeNull();
});
it("keeps absent research distinct from zero and rejects changed export context/provenance", async () => {
  render(<ResearchCardEvidence card={{ player: { id: 8476453 }, eventThroughDate: "2026-10-24" }} />); expect(screen.getByText(/Streak research unavailable: no manifest/)).toBeTruthy(); expect(screen.getByText(/BLSH research unavailable: not evaluated/)).toBeTruthy();
  const example = RESEARCH_EXAMPLES[0], raw = await load(example), snapshot = await readResearchFixture(raw.fixtureText, example, raw.manifestSha256), card: ResearchHost = withPlayerResearchSnapshot({ player: { id: example.playerId, name: example.name }, eventThroughDate: example.eventThroughDate }, snapshot);
  const { container } = render(<ResearchPlayerCard card={card} />), svg = container.querySelector("svg")!; expect(() => assertResearchExport(svg, card)).not.toThrow();
  expect(() => assertResearchExport(svg, { ...card, eventThroughDate: "2026-10-24" })).toThrow("manifest-bound");
  svg.dataset.researchFixture = "wrong"; expect(() => assertResearchExport(svg, card)).toThrow("manifest-bound");
});
