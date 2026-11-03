import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { RESEARCH_MANIFEST_SHA256, researchExample } from "./researchExamples";
/** Fixed repository fixtures only. No database, current feed, model or remote request. */
export async function loadResearchFixtureText(selection: { file: string; playerId: number; eventThroughDate: string }, read: (file: string) => Promise<Buffer> = readFile, root = path.join(process.cwd(), "lib/player-cards/research-fixtures")) {
  const expected = researchExample(selection.file);
  if (!expected || expected.playerId !== selection.playerId || expected.eventThroughDate !== selection.eventThroughDate) throw new Error("Unknown research example.");
  const manifestBytes = await read(path.join(root, "MANIFEST.json"));
  if (createHash("sha256").update(manifestBytes).digest("hex") !== RESEARCH_MANIFEST_SHA256) throw new Error("Research manifest changed.");
  const manifest = JSON.parse(manifestBytes.toString("utf8")), entry = manifest.fixtures.find((row: { file: string }) => row.file === expected.file);
  if (manifest.fixtures.length !== 15 || manifest.fixtureBytes !== 494014 || entry?.sha256 !== expected.sha256 || entry.playerId !== expected.playerId || entry.eventThroughDate !== expected.eventThroughDate || entry.kind !== expected.kind) throw new Error("Research manifest scope changed.");
  const bytes = await read(path.join(root, expected.file));
  if (bytes.length > 128 * 1024 || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Research fixture changed.");
  return { fixtureText: bytes.toString("utf8"), manifestSha256: RESEARCH_MANIFEST_SHA256 };
}
