import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeCtpi,
  computeTrendMetrics,
  isOneGameTeamRow,
  isTrustedRecentTeamFormPayload,
  RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
  RECENT_TEAM_FORM_FORMULA_VERSION,
  RECENT_TEAM_FORM_INPUT_VERSION,
  RECENT_TEAM_FORM_LEGACY_PUBLICATION_STATUS,
  type TeamGameRow,
} from "./ctpi";
import {
  computeRecentTeamFormCandidateMetrics,
  computeRecentTeamFormCandidateV2,
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
} from "./recentTeamFormV2";
import {
  buildRecentTeamFormCandidateSnapshot,
  planRecentTeamFormCandidateReplay,
  type RecentTeamFormSourceRow,
} from "./recentTeamFormV2Provenance";
import {
  materializeRecentTeamFormCandidateSnapshot,
  RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
  RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION,
} from "./recentTeamFormV2Materialization";

function teamGame(
  team: string,
  gameNumber: number,
  overrides: Partial<TeamGameRow> = {},
): TeamGameRow {
  return {
    team,
    date: `2026-01-${String(gameNumber).padStart(2, "0")}`,
    gp: 1,
    xgf_per_60: 3,
    hdcf_per_60: 11,
    gf_per_60: 3,
    xga_per_60: 2.5,
    hdca_per_60: 9,
    ca_per_60: 50,
    pp_xgf: 0.5,
    powerPlayToi: 300,
    pk_xga: 0.25,
    toi_shorthanded: 300,
    goals_against: 2,
    xga: 2.5,
    toi_all_seconds: 3600,
    pdo: 100,
    ...overrides,
  };
}

function teamGames(
  team: string,
  overrides: Partial<TeamGameRow> = {},
  count = 10,
): TeamGameRow[] {
  return Array.from({ length: count }, (_, index) =>
    teamGame(team, index + 1, overrides),
  );
}

describe("Recent Team Form source grain", () => {
  it("accepts only one-team-game rows and excludes cumulative snapshots", () => {
    const exactGame: TeamGameRow = {
      team: "MTL",
      date: "2026-02-01",
      gp: 1,
      xgf_per_60: 2.5,
      hdcf_per_60: 10,
      gf_per_60: 3,
      xga_per_60: 2,
      hdca_per_60: 9,
      ca_per_60: 50,
      pp_xgf: 0.5,
      powerPlayToi: 300,
      pk_xga: 0.25,
      toi_shorthanded: 300,
      goals_against: 2,
      xga: 3,
      toi_all_seconds: 3600,
      pdo: 1,
    };
    const mislabeledAggregate: TeamGameRow = {
      ...exactGame,
      date: "2026-02-02",
      gp: 42,
      xgf_per_60: 99,
      goals_against: 99,
      xga: 0,
    };

    expect(isOneGameTeamRow(exactGame)).toBe(true);
    expect(isOneGameTeamRow(mislabeledAggregate)).toBe(false);
    expect(isOneGameTeamRow({ gp: null })).toBe(false);

    const metrics = computeTrendMetrics([exactGame, mislabeledAggregate]);
    expect(metrics.team).toBe("MTL");
    expect(metrics.xgf_per_60).toBe(2.5);
    expect(metrics.gsax_per_60_season).toBe(1);
    expect(metrics.gsax_per_60_last10).toBe(1);
  });

  it("requires explicit formula publication approval before a row is trusted", () => {
    const [legacyScore] = computeCtpi([computeTrendMetrics(teamGames("MTL"))]);

    expect(legacyScore.publicationStatus).toBe(
      RECENT_TEAM_FORM_LEGACY_PUBLICATION_STATUS,
    );
    expect(isTrustedRecentTeamFormPayload(legacyScore)).toBe(false);
    expect(
      isTrustedRecentTeamFormPayload({
        publicationStatus: RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
        formulaVersion: RECENT_TEAM_FORM_FORMULA_VERSION,
        inputVersion: RECENT_TEAM_FORM_INPUT_VERSION,
        sourceGameCount: 10,
      }),
    ).toBe(true);
  });
});

describe("Recent Team Form v2 candidate", () => {
  it("preserves missing inputs and reports rejected aggregate rows", () => {
    const metrics = computeRecentTeamFormCandidateMetrics([
      ...teamGames("MTL", { pp_xgf: null, powerPlayToi: null }),
      teamGame("MTL", 11, { gp: 82, xgf_per_60: 99 }),
    ]);

    expect(metrics).toMatchObject({
      team: "MTL",
      sourceGameCount: 10,
      recentGameCount: 10,
      rejectedSourceRows: 1,
      sourceThroughDate: "2026-01-10",
    });
    expect(metrics.values.xgf_per_60).toBe(3);
    expect(metrics.values.pp_xgf_per_60).toBeNull();
    expect(metrics.observationCounts.pp_xgf_per_60).toBe(0);
    expect(metrics.values.gsax_per_60_season).toBe(0.5);
    expect(metrics.effectiveRecentGames).toBeCloseTo(7.857, 3);
  });

  it("keeps PDO outside the score while exposing it as context", () => {
    const metrics = [
      computeRecentTeamFormCandidateMetrics(teamGames("LOW", { pdo: 90 })),
      computeRecentTeamFormCandidateMetrics(teamGames("AVG", { pdo: 100 })),
      computeRecentTeamFormCandidateMetrics(teamGames("HIGH", { pdo: 110 })),
    ];
    const scores = computeRecentTeamFormCandidateV2(metrics);

    expect(scores.map((score) => score.ctpi_0_to_100)).toEqual([50, 50, 50]);
    expect(scores.map((score) => score.pdoContext.signal)).toEqual([
      "low",
      "neutral",
      "high",
    ]);
    expect(
      scores.every((score) => score.pdoContext.includedInScore === false),
    ).toBe(true);
  });

  it("renormalizes documented available components without coercing missing special teams to zero", () => {
    const metrics = [
      computeRecentTeamFormCandidateMetrics(
        teamGames("PARTIAL", {
          pp_xgf: null,
          powerPlayToi: null,
          pk_xga: null,
          toi_shorthanded: null,
        }),
      ),
      computeRecentTeamFormCandidateMetrics(
        teamGames("LOW", {
          xgf_per_60: 2,
          hdcf_per_60: 8,
          gf_per_60: 2,
          xga_per_60: 3.5,
          hdca_per_60: 12,
          ca_per_60: 58,
        }),
      ),
      computeRecentTeamFormCandidateMetrics(
        teamGames("HIGH", {
          xgf_per_60: 4,
          hdcf_per_60: 14,
          gf_per_60: 4,
          xga_per_60: 2,
          hdca_per_60: 7,
          ca_per_60: 44,
        }),
      ),
    ];
    const score = computeRecentTeamFormCandidateV2(metrics).find(
      (row) => row.team === "PARTIAL",
    );

    expect(score).toMatchObject({
      formulaVersion: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
      inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
      status: "partial",
      components: { specialTeams: null },
      componentCoverage: { specialTeams: 0 },
      missingComponents: ["specialTeams"],
    });
    expect(score?.confidence.metricWeightCoverage).toBeCloseTo(0.85);
    expect(score?.confidence.componentWeightCoverage).toBeCloseTo(0.85);
    expect(score?.confidence.tier).toBe("medium");
    expect(score?.ctpi_raw).not.toBeNull();
    expect(score?.ctpi_0_to_100).toBeGreaterThan(0);
    expect(score?.ctpi_0_to_100).toBeLessThan(100);
    expect(score?.missingMetrics).toEqual(["pp_xgf_per_60", "pk_xga_per_60"]);
  });

  it("withholds a score until the minimum recent-game sample exists", () => {
    const scores = computeRecentTeamFormCandidateV2([
      computeRecentTeamFormCandidateMetrics(teamGames("A", {}, 4)),
      computeRecentTeamFormCandidateMetrics(
        teamGames("B", { xgf_per_60: 2 }, 4),
      ),
    ]);

    expect(scores).toHaveLength(2);
    expect(scores.every((score) => score.status === "unavailable")).toBe(true);
    expect(scores.every((score) => score.ctpi_raw == null)).toBe(true);
    expect(scores.every((score) => score.ctpi_0_to_100 == null)).toBe(true);
    expect(
      scores.every((score) =>
        score.warnings.includes("insufficient_recent_games"),
      ),
    ).toBe(true);
  });

  it("distinguishes an insufficient league comparison from missing source data", () => {
    const [score] = computeRecentTeamFormCandidateV2([
      computeRecentTeamFormCandidateMetrics(teamGames("ONLY")),
    ]);

    expect(score.status).toBe("unavailable");
    expect(score.ctpi_0_to_100).toBeNull();
    expect(score.missingMetrics).toEqual([]);
    expect(score.unavailableLeagueMetrics).toHaveLength(10);
    expect(score.warnings).toContain("insufficient_league_comparison");
    expect(score.warnings).not.toContain("missing_source_metrics");
  });

  it("guarantees a finite open 0-to-100 display range", () => {
    const metrics = [
      computeRecentTeamFormCandidateMetrics(
        teamGames("LOW", {
          xgf_per_60: 0,
          hdcf_per_60: 0,
          gf_per_60: 0,
          xga_per_60: 10,
          hdca_per_60: 30,
          ca_per_60: 100,
          goals_against: 10,
          xga: 0,
        }),
      ),
      computeRecentTeamFormCandidateMetrics(teamGames("AVG")),
      computeRecentTeamFormCandidateMetrics(
        teamGames("HIGH", {
          xgf_per_60: 10,
          hdcf_per_60: 30,
          gf_per_60: 10,
          xga_per_60: 0,
          hdca_per_60: 0,
          ca_per_60: 0,
          goals_against: 0,
          xga: 10,
        }),
      ),
    ];
    const scores = computeRecentTeamFormCandidateV2(metrics);
    const displayScores = scores.map((score) => score.ctpi_0_to_100);

    expect(displayScores.every((score) => score != null && score > 0)).toBe(
      true,
    );
    expect(displayScores.every((score) => score != null && score < 100)).toBe(
      true,
    );
    expect(displayScores[0]).toBeLessThan(displayScores[1] as number);
    expect(displayScores[1]).toBeLessThan(displayScores[2] as number);
  });
});

describe("Recent Team Form v2 provenance and replay", () => {
  function sourceRows(): RecentTeamFormSourceRow[] {
    return [
      ...teamGames("A", { xgf_per_60: 2 }),
      ...teamGames("B", { xgf_per_60: 4 }),
    ].map((row, index) => ({
      ...row,
      sourceUpdatedAt: `2026-02-${String((index % 20) + 1).padStart(2, "0")}T12:00:00.000Z`,
    }));
  }

  it("enforces a strict pregame cutoff in the shared snapshot boundary", () => {
    const baseRows = sourceRows();
    const sameDayRows: RecentTeamFormSourceRow[] = [
      teamGame("A", 11, { date: "2026-01-11", xgf_per_60: 99 }),
      teamGame("B", 11, { date: "2026-01-11", xgf_per_60: 0 }),
    ];
    const withoutSameDay = buildRecentTeamFormCandidateSnapshot(
      baseRows,
      "2026-01-11",
    );
    const withSameDay = buildRecentTeamFormCandidateSnapshot(
      [...baseRows, ...sameDayRows],
      "2026-01-11",
    );

    expect(withSameDay.provenance).toMatchObject({
      sourceCutoffExclusive: "2026-01-11",
      sourceThroughDate: "2026-01-10",
      sourceGameRows: 20,
      teamCount: 2,
    });
    expect(withSameDay.provenance.sourceFingerprint).toBe(
      withoutSameDay.provenance.sourceFingerprint,
    );
    expect(withSameDay.scores).toEqual(withoutSameDay.scores);
  });

  it("produces an order-independent fingerprint and detects a late correction", () => {
    const rows = sourceRows();
    const original = buildRecentTeamFormCandidateSnapshot(rows, "2026-01-11");
    const reordered = buildRecentTeamFormCandidateSnapshot(
      [...rows].reverse(),
      "2026-01-11",
    );
    const corrected = buildRecentTeamFormCandidateSnapshot(
      rows.map((row, index) =>
        index === 0
          ? {
              ...row,
              xgf_per_60: 2.25,
              sourceUpdatedAt: "2026-03-01T12:00:00.000Z",
            }
          : row,
      ),
      "2026-01-11",
    );

    expect(original.provenance.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered.provenance.sourceFingerprint).toBe(
      original.provenance.sourceFingerprint,
    );
    expect(corrected.provenance.sourceFingerprint).not.toBe(
      original.provenance.sourceFingerprint,
    );
    expect(corrected.provenance.sourceUpdatedThrough).toBe(
      "2026-03-01T12:00:00.000Z",
    );
  });

  it("plans only missing, version-changed, or source-changed snapshots for replay", () => {
    const rows = sourceRows();
    const original = buildRecentTeamFormCandidateSnapshot(rows, "2026-01-11");
    const persisted = {
      date: original.date,
      formulaVersion: original.formulaVersion,
      inputVersion: original.inputVersion,
      sourceCutoffExclusive: original.provenance.sourceCutoffExclusive,
      sourceFingerprint: original.provenance.sourceFingerprint,
      sourceUpdatedThrough: original.provenance.sourceUpdatedThrough,
    };
    const unchanged = planRecentTeamFormCandidateReplay({
      sourceRows: rows,
      consumerDates: ["2026-01-11"],
      persisted: [persisted],
    });
    const correctedRows = rows.map((row, index) =>
      index === 0
        ? {
            ...row,
            xgf_per_60: 2.25,
            sourceUpdatedAt: "2026-03-01T12:00:00.000Z",
          }
        : row,
    );
    const changed = planRecentTeamFormCandidateReplay({
      sourceRows: correctedRows,
      consumerDates: ["2026-01-11", "2026-01-12"],
      persisted: [persisted],
    });

    expect(unchanged).toEqual({ replay: [], unchangedDates: ["2026-01-11"] });
    expect(
      changed.replay.map(({ date, reasons }) => ({ date, reasons })),
    ).toEqual([
      {
        date: "2026-01-11",
        reasons: ["source_fingerprint_changed", "source_watermark_advanced"],
      },
      { date: "2026-01-12", reasons: ["missing_persisted_snapshot"] },
    ]);
    expect(changed.unchangedDates).toEqual([]);
  });
});

describe("Recent Team Form v2 materialization contract", () => {
  it("preserves partial-component nulls and omits unavailable scores", () => {
    const snapshot = buildRecentTeamFormCandidateSnapshot(
      [
        ...teamGames("PARTIAL", {
          pp_xgf: null,
          powerPlayToi: null,
          pk_xga: null,
          toi_shorthanded: null,
        }),
        ...teamGames("LOW", {
          xgf_per_60: 2,
          hdcf_per_60: 8,
          gf_per_60: 2,
          xga_per_60: 3.5,
          hdca_per_60: 12,
          ca_per_60: 58,
        }),
        ...teamGames("HIGH", {
          xgf_per_60: 4,
          hdcf_per_60: 14,
          gf_per_60: 4,
          xga_per_60: 2,
          hdca_per_60: 7,
          ca_per_60: 44,
        }),
        ...teamGames("SHORT", {}, 4),
      ],
      "2026-01-11",
    );
    const materialized = materializeRecentTeamFormCandidateSnapshot({
      snapshot,
      seasonId: 20252026,
      computedAt: "2026-02-05T12:34:56-05:00",
    });
    const persistedShape = JSON.parse(
      JSON.stringify(materialized.rows),
    ) as typeof materialized.rows;
    const partial = persistedShape.find((row) => row.team === "PARTIAL");

    expect(materialized.coverage).toEqual({
      snapshotTeams: 4,
      materializedRows: 3,
      omittedRows: 1,
      readyRows: 2,
      partialRows: 1,
      rowsWithPdoContext: 3,
      nullComponents: {
        offense: 0,
        defense: 0,
        goaltending: 0,
        specialTeams: 1,
        luck: 3,
      },
    });
    expect(materialized.omitted).toEqual([
      {
        team: "SHORT",
        status: "unavailable",
        reasonCodes: expect.arrayContaining([
          "insufficient_recent_games",
          "score_unavailable",
        ]),
      },
    ]);
    expect(partial).toMatchObject({
      season_id: 20252026,
      date: "2026-01-11",
      computed_at: "2026-02-05T17:34:56.000Z",
      special_teams: null,
      luck: null,
      payload: {
        publicationStatus: RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
        materializationContractVersion:
          RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION,
        status: "partial",
        sourceCutoffExclusive: "2026-01-11",
        snapshotSourceThroughDate: "2026-01-10",
        components: { specialTeams: null },
        pdoContext: { includedInScore: false },
      },
    });
    expect(partial?.ctpi_raw).toBeTypeOf("number");
    expect(partial?.ctpi_0_to_100).toBeTypeOf("number");
    expect(isTrustedRecentTeamFormPayload(partial?.payload)).toBe(false);
  });

  it("stages nullable components without weakening required score columns", () => {
    const migrationSql = readFileSync(
      path.resolve(
        process.cwd(),
        "../supabase/migrations/20260828142331_recent_team_form_nullable_components.sql",
      ),
      "utf8",
    );

    for (const column of [
      "offense",
      "defense",
      "goaltending",
      "special_teams",
      "luck",
    ]) {
      expect(migrationSql).toContain(`alter column ${column} drop not null`);
    }
    expect(migrationSql).not.toContain("alter column ctpi_raw drop not null");
    expect(migrationSql).not.toContain(
      "alter column ctpi_0_to_100 drop not null",
    );
  });

  it("rejects non-finite payload values instead of serializing them as null", () => {
    const snapshot = buildRecentTeamFormCandidateSnapshot(
      [
        ...teamGames("LOW", { xgf_per_60: 2 }),
        ...teamGames("HIGH", { xgf_per_60: 4 }),
      ],
      "2026-01-11",
    );
    snapshot.scores[0].components.offense = Number.NaN;

    expect(() =>
      materializeRecentTeamFormCandidateSnapshot({
        snapshot,
        seasonId: 20252026,
        computedAt: "2026-02-05T12:00:00.000Z",
      }),
    ).toThrow("is not finite");
  });
});
