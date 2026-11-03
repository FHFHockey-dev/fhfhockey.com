// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { expect, it } from "vitest";
import { RESEARCH_EXAMPLES, RESEARCH_MANIFEST_SHA256 } from "./researchExamples";
import { readResearchFixture, withPlayerResearchSnapshot, researchBinding, researchCardKey, streakTrackView, blshDiagnostics } from "./researchSnapshot";
import type { PlayerResearchSnapshotV1, StreakTrack } from "./researchSnapshot.types";
const root = fileURLToPath(new URL("./research-fixtures/", import.meta.url));
const text = (file: string) => readFile(path.join(root, file), "utf8");
it.each(RESEARCH_EXAMPLES)("binds exact approved bytes without changing any existing card fields: $file", async example => {
  const raw = await text(example.file), snapshot = await readResearchFixture(raw, example, RESEARCH_MANIFEST_SHA256), original = { player: { id: example.playerId, name: example.name }, eventThroughDate: example.eventThroughDate, values: { knownZero: 0 }, source: "retained historical example" };
  const card = withPlayerResearchSnapshot(original, snapshot);
  expect(card.values).toBe(original.values); expect(card.source).toBe(original.source); expect(original).not.toHaveProperty("playerResearchSnapshot");
  expect(snapshot).toEqual(JSON.parse(raw)); expect(Object.isFrozen(snapshot.streak.tracks.composite)).toBe(true);
  expect(researchBinding(card)).toMatchObject({ fixtureSha256: example.sha256, manifestSha256: RESEARCH_MANIFEST_SHA256, playerId: example.playerId, eventThroughDate: example.eventThroughDate });
  expect(snapshot.usage).toEqual({ researchOnly: true, productionDetectorSelected: false, trustedForActivation: false }); expect(snapshot.asOf.issuedAtUTC).toBeNull(); expect(snapshot.blshResearch.trustedForActivation).toBe(false);
});
it("rejects changed manifest, hash, schema/version bytes, player/date and unregistered casts", async () => {
  const example = RESEARCH_EXAMPLES[0], raw = await text(example.file);
  await expect(readResearchFixture(raw, example, "0".repeat(64))).rejects.toThrow("manifest");
  await expect(readResearchFixture(raw + " ", example, RESEARCH_MANIFEST_SHA256)).rejects.toThrow("hash");
  await expect(readResearchFixture(raw.replace("blsh-overnight-three-track-v2", "unapproved-version"), example, RESEARCH_MANIFEST_SHA256)).rejects.toThrow("hash");
  await expect(readResearchFixture(raw, { ...example, playerId: 8476453 }, RESEARCH_MANIFEST_SHA256)).rejects.toThrow("player/date");
  const snapshot = await readResearchFixture(raw, example, RESEARCH_MANIFEST_SHA256);
  expect(() => withPlayerResearchSnapshot({ player: { id: example.playerId }, eventThroughDate: "2026-10-24" }, snapshot)).toThrow("exact game-date");
  expect(() => withPlayerResearchSnapshot({ player: { id: 8476453 }, eventThroughDate: example.eventThroughDate }, snapshot)).toThrow("player");
  expect(() => researchCardKey({ player: { id: example.playerId }, eventThroughDate: example.eventThroughDate, playerResearchSnapshot: JSON.parse(raw) as PlayerResearchSnapshotV1 })).toThrow("Manifest-bound");
});
it("preserves sparse-reference and measured BLSH independence, imputation/cohort/freshness cautions", async () => {
  const load = async (file: string) => { const example = RESEARCH_EXAMPLES.find(v => v.file === file)!; return readResearchFixture(await text(file), example, RESEARCH_MANIFEST_SHA256); };
  const luke = await load("luke_hughes_sparse_streak_oct31.json");
  expect(streakTrackView(luke.streak.tracks.composite, luke.asOf.eventThroughDate).reference).toContain("2/50"); expect(luke.blshResearch.productionP).toBeCloseTo(-74.538861); expect(luke.blshResearch.supportDiscrepancy).toBeCloseTo(-73.798334);
  const diagnostics = blshDiagnostics(luke).join(" "); expect(diagnostics).toContain("Personal n 5"); expect(diagnostics).toContain("25.3%"); expect(diagnostics).toContain("not calibrated confidence");
  expect(blshDiagnostics(await load("necas_cohort_process_apr18.json")).join(" ")).toContain("cohort reference");
  expect(blshDiagnostics(await load("gallagher_imputed_process_apr18.json")).join(" ")).toContain("Estimated current components: 2");
  expect((await load("zero_shots_broad_profile_retained.json")).blshResearch.productionP).toBe(10);
});
it("labels the latest game value and confirmation transition without leaking future markers or inventing exiting onset", async () => {
  const e = RESEARCH_EXAMPLES[1], s = await readResearchFixture(await text(e.file), e, RESEARCH_MANIFEST_SHA256), original = s.streak.tracks.composite;
  const exiting: StreakTrack = { ...original, status: "exiting_hot", episode: { ...original.episode!, exitConfirmedOn: "2024-02-01" }, lastTransition: { kind: "confirmation", eventOn: "2023-12-27", knownOn: "2023-12-27" } };
  const view = streakTrackView(exiting, "2024-01-01"); expect(view.transition).toContain("confirmation"); expect(view.transition).not.toContain("exiting since"); expect(view.exitConfirmedOn).toBeNull(); expect(view.lastValue).toBe(original.signal.valuePerGame!.toFixed(2));
  expect(streakTrackView({ ...exiting, lastTransition: { kind: "exit_confirmed", eventOn: "2024-01-16", knownOn: "2024-01-16" } }, "2024-01-01").transition).toBe("No known transition");
  expect(streakTrackView({ ...exiting, lastTransition: { kind: "context_censor", eventOn: "2023-12-27", knownOn: "2024-01-01" } }, "2024-01-01").transition).toContain("known 2024-01-01 · event 2023-12-27");
});
