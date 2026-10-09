// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeTeamGameFacts } from "./teamGameNormalization";
type NstTeamGamelogRow = Parameters<typeof normalizeTeamGameFacts>[0]["rows"][number];
function createNstTeamGamelogRow(args: {
  teamAbbreviation: string;
  date: string;
  seasonId?: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  sf: number;
  sa: number;
  points: number;
}): NstTeamGamelogRow {
  return {
    season_id: args.seasonId ?? 20252026,
    team_abbreviation: args.teamAbbreviation,
    date: args.date,
    phase: 2,
    strength: "all",
    available_at: `${args.date}T23:50:00Z`,
    availability_basis: "original_source",
    gp: 1,
    wins: args.points === 2 ? 1 : 0,
    losses: args.points === 0 ? 1 : 0,
    otl: args.points === 1 ? 1 : 0,
    points: args.points,
    point_pct: args.points / 2,
    gf: args.gf,
    ga: args.ga,
    gf_pct: (args.gf / (args.gf + args.ga)) * 100,
    xgf: args.xgf,
    xga: args.xga,
    xgf_pct: (args.xgf / (args.xgf + args.xga)) * 100,
    xga_per_60: args.xga,
    toi_seconds: 3600,
    sf: args.sf,
    sa: args.sa,
    sf_pct: (args.sf / (args.sf + args.sa)) * 100,
    ff: args.sf - 4,
    fa: args.sa - 4,
    ff_pct: ((args.sf - 4) / (args.sf + args.sa - 8)) * 100,
    cf: args.sf + 10,
    ca: args.sa + 10,
    cf_pct: ((args.sf + 10) / (args.sf + args.sa + 20)) * 100,
  };
}

function createInputs(overrides: { nstTeamGamelogRows: NstTeamGamelogRow[] }) {
  const homeTeam = { id: 1, abbreviation: "BOS", name: "Boston Bruins" };
  const awayTeam = { id: 2, abbreviation: "MTL", name: "Montreal Canadiens" };
  const teamGameRecords = overrides.nstTeamGamelogRows.map((row, index) => {
    const teamId = row.team_abbreviation === "BOS" ? 1 : 2;
    return { id: index + 1, date: row.date, startTime: `${row.date}T20:00:00Z`,
      completed_at: `${row.date}T23:00:00Z`, seasonId: row.season_id!,
      homeTeamId: teamId, awayTeamId: teamId === 1 ? 3 : 4, type: 2 };
  });
  return { homeTeam, awayTeam, teamGameRecords };
}
describe("canonical team-game facts", () => {
  const row = (overrides: Partial<NstTeamGamelogRow> = {}) => ({ ...createNstTeamGamelogRow({
    teamAbbreviation: "BOS", date: "2026-01-09", gf: 4, ga: 2, xgf: 3, xga: 2, sf: 30, sa: 20, points: 2,
  }), ...overrides });
  const normalize = (rows: NstTeamGamelogRow[], overrides: Partial<Parameters<typeof normalizeTeamGameFacts>[0]> = {}) => {
    const inputs = createInputs({ nstTeamGamelogRows: [row()] });
    return normalizeTeamGameFacts({ rows, games: inputs.teamGameRecords!, teams: [inputs.homeTeam, inputs.awayTeam],
      cutoffAt: "2026-01-10T18:00:00-05:00", phase: 2, ...overrides });
  };
  it("preserves legacy totals and distinct corrected exposures", () => {
    expect(normalize([row(), row({ gp: 40, gf: 120, ga: 100 })])).toMatchObject({
      legacyTotals: { gp: 41, gf: 124, ga: 102 }, correctedTotals: { gp: 1, gf: 4, ga: 2 },
      exclusions: [{ rowIndex: 1, reason: "cumulative_or_invalid_gp" }],
    });
  });
  it.each([
    [{ phase: 3 }, "unknown_or_mismatched_phase"],
    [{ strength: "5v5" }, "unknown_or_mismatched_strength"],
    [{ season_id: 20242025 }, "ambiguous_or_missing_game"],
    [{ availability_basis: "ingestion_only" }, "unknown_original_availability"],
    [{ available_at: "2026-01-10T18:00:00-05:00" }, "future_or_invalid_availability"],
    [{ available_at: "2026-01-11T00:00:00Z" }, "future_or_invalid_availability"],
    [{ correction_of_available_at: "2026-01-10T00:00:00Z" }, "invalid_correction"],
    [{ gf: -1 }, "invalid_counts"],
    [{ available_at: undefined }, "unknown_original_availability"],
    [{ available_at: "2026-01-09T23:50:00" }, "unknown_original_availability"],
    [{ phase: undefined }, "unknown_or_mismatched_phase"],
    [{ strength: undefined }, "unknown_or_mismatched_strength"],
  ] as Array<[Partial<NstTeamGamelogRow>, string]>)("excludes unsupported metadata %j", (overrides, reason) => {
    expect(normalize([row(overrides)]).exclusions).toEqual([{ rowIndex: 0, reason }]);
  });
  it("deduplicates identical verified revisions and rejects conflicts without doubling exposure", () => {
    const first = row();
    const laterReceipt = row({ available_at: "2026-01-10T11:40:00Z", availability_basis: "retained_capture" });
    const deduplicated = normalize([laterReceipt, first, row()]);
    expect(deduplicated.facts).toHaveLength(1);
    expect(deduplicated.facts[0]?.available_at).toBe(first.available_at);
    expect(deduplicated).toMatchObject({ legacyTotals: { gp: 3, gf: 12, ga: 6 }, correctedTotals: { gp: 1, gf: 4, ga: 2 } });
    expect(deduplicated.exclusions).toEqual([{ rowIndex: 2, reason: "duplicate_identical_game" }, { rowIndex: 0, reason: "duplicate_identical_game" }]);
    const conflict = normalize([row(), row({ gf: 5 })]);
    expect(conflict.facts).toEqual([]);
    expect(conflict.exclusions.every(exclusion => exclusion.reason === "duplicate_or_conflicting_game")).toBe(true);
    const inputs = createInputs({ nstTeamGamelogRows: [row()] });
    const game = inputs.teamGameRecords![0]!;
    expect(normalize([row()], { games: [game, { ...game, id: 99 }] }).exclusions[0]?.reason).toBe("ambiguous_or_missing_game");
  });
  it("requires completed game evidence before original availability", () => {
    const game = createInputs({ nstTeamGamelogRows: [row()] }).teamGameRecords![0]!;
    expect(normalize([row()], { games: [{ ...game, completed_at: undefined }] }).facts).toEqual([]);
    expect(normalize([row()], { games: [{ ...game, completed_at: "2026-01-11T00:00:00Z" }] }).facts).toEqual([]);
    expect(normalize([row({ available_at: "2026-01-09T18:01:00-05:00" })]).facts).toHaveLength(1);
  });
  it("accepts proved retained receipts only at their actual pre-cutoff timestamps", () => {
    expect(normalize([row({ availability_basis: "retained_capture" })]).facts).toHaveLength(1);
    expect(normalize([row({ availability_basis: "retained_capture", available_at: "2026-01-11T00:00:00Z" })]).facts).toEqual([]);
  });
  it("differences only one verified completed game with matching stat definitions", () => {
    const previous = row({ date: "2026-01-08", available_at: "2026-01-08T23:50:00Z", gp: 2, gf: 8, ga: 4,
      observation_kind: "cumulative", stat_definition: "all_v1" });
    const current = row({ gp: 3, gf: 12, ga: 6, observation_kind: "cumulative", stat_definition: "all_v1" });
    const result = normalize([previous, current]);
    expect(result.facts).toMatchObject([{ gp: 1, gf: 4, ga: 2, derivation: "cumulative_difference" }]);
    expect(normalize([previous, { ...previous }, current]).facts).toMatchObject([{ gp: 1, gf: 4, ga: 2, derivation: "cumulative_difference" }]);
    expect(normalize([previous, { ...previous, gf: 7 }, current]).facts).toEqual([]);
    expect(normalize([previous, { ...current, stat_definition: "all_v2" }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, gp: 4 }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, gf: 7 }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, correction_of_available_at: previous.available_at }]).facts).toEqual([]);
    const game = createInputs({ nstTeamGamelogRows: [row()] }).teamGameRecords![0]!;
    expect(normalize([previous, current], { games: [game, { ...game, id: 9 }] }).facts).toEqual([]);
  });
});
