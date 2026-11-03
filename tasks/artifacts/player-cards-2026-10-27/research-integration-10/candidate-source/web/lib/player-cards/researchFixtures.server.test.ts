// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { RESEARCH_EXAMPLES, RESEARCH_MANIFEST_SHA256 } from "./researchExamples";
import { loadResearchFixtureText } from "./researchFixtures.server";
const root = fileURLToPath(new URL("./research-fixtures/", import.meta.url));
it("reads only exact manifest and selected fixture, refusing paths/dates and changed input bytes", async () => {
  const example = RESEARCH_EXAMPLES[6], read = vi.fn((file: string) => readFile(file)), result = await loadResearchFixtureText(example, read, root);
  expect(result.manifestSha256).toBe(RESEARCH_MANIFEST_SHA256); expect(JSON.parse(result.fixtureText).playerId).toBe(example.playerId); expect(read).toHaveBeenCalledTimes(2);
  await expect(loadResearchFixtureText({ ...example, file: "../MANIFEST.json" }, read, root)).rejects.toThrow("Unknown"); expect(read).toHaveBeenCalledTimes(2);
  await expect(loadResearchFixtureText({ ...example, eventThroughDate: "2026-10-24" }, read, root)).rejects.toThrow("Unknown");
  const changed = vi.fn(async () => Buffer.from("{}"));
  await expect(loadResearchFixtureText(example, changed, root)).rejects.toThrow("manifest changed");
  let calls = 0;
  const wrongFixture = vi.fn(async (file: string) => ++calls === 1 ? readFile(file) : Buffer.from("{}"));
  await expect(loadResearchFixtureText(example, wrongFixture, root)).rejects.toThrow("fixture changed");
});
it("API refuses nonGET, unknown files and mismatched anchors before any fixture read", async () => {
  const { default: handler } = await import("../../pages/api/v1/player-cards/research");
  const source = await import("./researchFixtures.server"), spy = vi.spyOn(source, "loadResearchFixtureText").mockResolvedValue({ fixtureText: "pinned raw fixture", manifestSha256: RESEARCH_MANIFEST_SHA256 });
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  try {
    await handler({ method: "POST", query: {} } as never, res as never); expect(res.status).toHaveBeenLastCalledWith(405);
    await handler({ method: "GET", query: { fixture: "../MANIFEST.json" } } as never, res as never); expect(res.status).toHaveBeenLastCalledWith(400);
    const example = RESEARCH_EXAMPLES[6];
    await handler({ method: "GET", query: { fixture: example.file, playerId: "8476453", eventThroughDate: example.eventThroughDate } } as never, res as never); expect(spy).not.toHaveBeenCalled();
    await handler({ method: "GET", query: { fixture: example.file, playerId: String(example.playerId), eventThroughDate: example.eventThroughDate } } as never, res as never); expect(spy).toHaveBeenCalledOnce(); expect(res.status).toHaveBeenLastCalledWith(200); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  } finally { spy.mockRestore(); }
});
