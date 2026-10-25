// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ASSIST_EXPORT_SCOPE, captureAssistExportStdin, runAssistExportValidation, validateAssistExport, validateAssistExportStream } from "./forge-assist-export";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const source = { id: 1, playerId: 10, season: 20262027, date: "2026-10-10", gp: 1, toiSeconds: 600 };
  const individual = { ...source, goals: 1 as number | null, assists: 1 as number | null, points: 2 as number | null };
  const onIce = { ...source, goalsFor: 3 as number | null };
  return {
    schema: ASSIST_EXPORT_SCOPE.schema, projectRef: "synthetic", season: ASSIST_EXPORT_SCOPE.season,
    fromInclusive: ASSIST_EXPORT_SCOPE.fromInclusive, toExclusive: ASSIST_EXPORT_SCOPE.toExclusive,
    rowLimit: ASSIST_EXPORT_SCOPE.rowLimit, exportedAt: "2026-10-22T12:00:00+00:00", evidence: "synthetic",
    canonicalRowCount: 1, truncated: false,
    rows: [{ wgoId: 1, playerId: 10, gameId: 2026020001, date: "2026-10-10", season: 20262027,
      position: "D", gamesPlayed: 1, canonicalDate: "2026-10-10", canonicalSeason: 20262027, gameType: 2,
      gameStart: "2026-10-10T23:00:00Z", ES: { individual: [{ ...individual }], onIce: [{ ...onIce }] },
      PP: { individual: [{ ...individual, toiSeconds: 60 }], onIce: [{ ...onIce, toiSeconds: 60 }] } }],
  };
}

describe("bounded task3 local export validator", () => {
  it("extracts paired ES/PP histories with conservative acquisition availability and descriptive IPP", () => {
    const result = validateAssistExport(fixture());
    expect(result).toMatchObject({ canonicalRows: 1, expectedStrengthRows: 2, acceptedStrengthRows: 2, excluded: {},
      historicalAsOfQualified: false, coefficientsFitted: false, releaseQualified: false, evidence: "synthetic" });
    expect(result.normalized[0]).toMatchObject({ goals: 1, assists: 1, onIceGoals: 3, toiSeconds: 600, shots: null,
      availableAt: "2026-10-22T12:00:00.000Z", playedAt: "2026-10-10T23:00:00Z", position: "D", strength: "ES" });
    const ipp = result.descriptivePriors.find((prior) => prior.scope.position === "D" && prior.scope.strength === "ES" && prior.scope.metric === "pointsPerOnIceGoal")!;
    expect(ipp.mean).toBeCloseTo(2 / 3);
    expect(result.descriptivePriors.find((prior) => prior.scope.position === "F")!.mean).toBeNull();
  });

  it("distinguishes missing counts with positive exposure from an observed zero", () => {
    const missing = fixture(); missing.rows[0].ES.individual[0].assists = null;
    expect(validateAssistExport(missing)).toMatchObject({ acceptedStrengthRows: 1, excluded: { missing_or_invalid_count_exposure: 1 } });
    const zero = fixture(); Object.assign(zero.rows[0].ES.individual[0], { assists: 0, points: 1 });
    expect(validateAssistExport(zero).normalized[0].assists).toBe(0);
  });

  it.each([
    ["strength_exposure_mismatch", (f: ReturnType<typeof fixture>) => { f.rows[0].ES.onIce[0].toiSeconds = 601; }],
    ["inconsistent_point_accounting", (f: ReturnType<typeof fixture>) => { f.rows[0].ES.onIce[0].goalsFor = 1; }],
    ["missing_or_invalid_count_exposure", (f: ReturnType<typeof fixture>) => { f.rows[0].ES.onIce[0].goalsFor = 2.5; }],
    ["non_single_game_source", (f: ReturnType<typeof fixture>) => { f.rows[0].ES.individual[0].gp = 3; }],
    ["mismatched_source_identity", (f: ReturnType<typeof fixture>) => { f.rows[0].ES.onIce[0].date = "2026-10-09"; }],
  ] as const)("excludes %s without correcting or fabricating source counts", (reason, change) => {
    const input = fixture(); change(input);
    expect(validateAssistExport(input)).toMatchObject({ acceptedStrengthRows: 1, excluded: { [reason]: 1 } });
  });

  it("reports absent/ambiguous source pairs and rejects duplicated canonical identities", () => {
    const input = fixture(); input.rows[0].ES.individual.push({ ...input.rows[0].ES.individual[0], id: 2 });
    input.rows[0].PP.onIce = [];
    expect(validateAssistExport(input)).toMatchObject({ acceptedStrengthRows: 0, excluded: { ambiguous_source_pair: 1, missing_source_pair: 1 } });
    const duplicate = fixture(); duplicate.rows.push({ ...duplicate.rows[0], wgoId: 2 }); duplicate.canonicalRowCount = 2;
    expect(() => validateAssistExport(duplicate)).toThrow("Duplicate player-game");
  });

  it("fails closed on a truncated/mis-scoped/mislabeled export or extra private fields", () => {
    expect(() => validateAssistExport({ ...fixture(), truncated: true })).toThrow("Truncated");
    expect(() => validateAssistExport({ ...fixture(), canonicalRowCount: 2 })).toThrow("row count");
    expect(() => validateAssistExport({ ...fixture(), fromInclusive: "2023-10-10" })).toThrow("scope");
    expect(() => validateAssistExport({ ...fixture(), evidence: "historical_asof" })).toThrow("evidence");
    expect(() => validateAssistExport({ ...fixture(), projectRef: ASSIST_EXPORT_SCOPE.projectRef })).toThrow("target");
    const privateField = fixture(); Object.assign(privateField.rows[0].ES.individual[0], { email: "excluded@example.invalid" });
    expect(() => validateAssistExport(privateField)).toThrow("fields");
  });

  it("excludes noncanonical and nonregular events rather than forcing a source-date join", () => {
    const input = fixture(); input.rows[0].canonicalDate = "2026-10-11";
    expect(validateAssistExport(input)).toMatchObject({ acceptedStrengthRows: 0, excluded: { unmatched_canonical_game: 2 } });
    const playoff = fixture(); playoff.rows[0].gameType = 3;
    expect(validateAssistExport(playoff)).toMatchObject({ acceptedStrengthRows: 0, excluded: { not_regular_season: 2 } });
  });

  it("runs from a local JSON file, hashes exact bytes and refuses evidence replacement", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-assist-export-")); dirs.push(directory);
    const input = join(directory, "synthetic.json"), output = join(directory, "validated.json");
    writeFileSync(input, JSON.stringify(fixture()));
    const result = runAssistExportValidation(["--input", input, "--output", output]);
    expect(result.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(readFileSync(output, "utf8")).acceptedStrengthRows).toBe(2);
    expect(() => runAssistExportValidation(["--input", input, "--output", output])).toThrow("EEXIST");
    expect(() => runAssistExportValidation(["--input", input, "--output", input])).toThrow("overwrite");
  });

  it("accepts bounded chunked JSON and writes exclusive output through the stdin receiver", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(fixture()));
    async function* chunks() { yield bytes.slice(0, 25); yield bytes.slice(25); }
    const directory = mkdtempSync(join(tmpdir(), "forge-assist-stdin-")); dirs.push(directory);
    const output = join(directory, "validated.json");
    const result = await captureAssistExportStdin(["--stdin", "--output", output], chunks());
    expect(result.acceptedStrengthRows).toBe(2);
    expect(JSON.parse(readFileSync(output, "utf8")).inputSha256).toBe(result.inputSha256);
    await expect(captureAssistExportStdin(["--stdin", "--output", output], chunks())).rejects.toThrow("existing evidence");
  });

  it("stops an oversized stream before parsing or consuming more chunks", async () => {
    let consumedTail = false, closed = false;
    async function* oversized() {
      try {
        yield new Uint8Array(ASSIST_EXPORT_SCOPE.maxBytes + 1);
        consumedTail = true;
        yield new TextEncoder().encode("this must never be parsed");
      } finally { closed = true; }
    }
    await expect(validateAssistExportStream(oversized())).rejects.toThrow("Export exceeds 16 MiB");
    expect(consumedTail).toBe(false); expect(closed).toBe(true);
    async function* exactInvalid() { yield new Uint8Array(ASSIST_EXPORT_SCOPE.maxBytes); }
    await expect(validateAssistExportStream(exactInvalid())).rejects.not.toThrow("Export exceeds 16 MiB");
  });
});
