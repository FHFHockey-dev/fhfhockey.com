/**
 * Decision 101, end to end: an unapproved (shadow) artifact's scores are
 * stored as unapproved, never reach an aggregate, and never reach a served
 * reader (Metrics Timeline route, homepage analytics, xG Lab API), while the
 * approved model's scores do. Shadow success never promotes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

/** In-memory PostgREST-like client covering the query methods the readers use. */
function fakeClient() {
  return {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let limitCount: number | null = null;
      let range: [number, number] | null = null;
      let head = false;
      const query: any = {
        select: (_columns?: string, options?: { head?: boolean }) => {
          head = options?.head === true;
          return query;
        },
        eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
        neq: (column: string, value: unknown) => (filters.push((row) => row[column] !== value), query),
        in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
        is: (column: string, value: unknown) => (filters.push((row) => (row[column] ?? null) === value), query),
        gte: (column: string, value: any) => (filters.push((row) => row[column] >= value), query),
        lte: (column: string, value: any) => (filters.push((row) => row[column] <= value), query),
        lt: (column: string, value: any) => (filters.push((row) => row[column] < value), query),
        gt: (column: string, value: any) => (filters.push((row) => row[column] > value), query),
        not: () => query,
        or: (expression: string) => {
          const clauses = expression.split(",").map((clause) => clause.split("."));
          filters.push((row) => clauses.some(([column, op, value]) => op === "eq" && String(row[column!]) === value));
          return query;
        },
        order: () => query,
        limit: (count: number) => ((limitCount = count), query),
        range: (from: number, to: number) => ((range = [from, to]), query),
        maybeSingle: () => run().then((result: any) => ({ ...result, data: result.data?.[0] ?? null })),
        single: () => run().then((result: any) => ({ ...result, data: result.data?.[0] ?? null })),
        then: (resolve: (value: unknown) => void, reject?: (error: unknown) => void) => run().then(resolve, reject),
      };
      const run = () => {
        let rows = (db.tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        const count = rows.length;
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (limitCount != null) rows = rows.slice(0, limitCount);
        return Promise.resolve({ data: head ? null : rows, error: null, count });
      };
      return query;
    },
    rpc: () => Promise.resolve({ data: null, error: { message: "not in fixture" } }),
  };
}

vi.mock("lib/supabase/server", () => ({ default: fakeClient(), getServiceRoleClient: () => fakeClient() }));

import { buildXgAggregates, type XgAggregatePredictionRow } from "lib/xg/aggregates";
import { XG_APPROVAL_GATE_VERSION } from "lib/xg/approvalGate";
import { buildCreatedXgAggregates } from "lib/xg/createdXg";
import { buildXgModelRegistryRow } from "lib/xg/modelRegistry";
import { resolveXgScoringMode } from "lib/xg/shadowScoring";
import { buildShotAssistCandidateRows } from "lib/xg/shotAssists";
import { buildPredictionDbRow, type PersistedXgModelArtifact } from "lib/xg/shotFeaturePersistence";
import { enrichHomepageGames } from "lib/homepageGameAnalytics";
import teamTimelineHandler from "pages/api/v1/xg/team-timeline";
import xgLabHandler from "pages/api/v1/underlying-stats/xg";

const APPROVED = "cfg-approved";
const SHADOW = "cfg-shadow";
const GAME = 2025020001;
const SEASON = 20252026;

const approval = {
  gateVersion: XG_APPROVAL_GATE_VERSION,
  isEligible: true,
  blockingReasons: [],
  evidence: {
    testExampleCount: 20000,
    relativeStandardError: 0.03,
    checks: Object.fromEntries(
      [
        "holdoutPresent", "chronologicalUntouchedTest", "sufficientEvidence", "beatsBaseRateLogLoss",
        "beatsBaseRateBrier", "calibrationInTheLarge", "spiegelhalter", "subgroupCalibration",
        "noOutcomeLeakage", "calibrationAppliedFromValidation", "featureCoverage",
      ].map((key) => [key, true])
    ),
  },
};

function artifact(tag: string, approved: boolean): PersistedXgModelArtifact {
  return {
    artifactKind: "nhl_xg_model",
    artifactTag: tag,
    family: "logistic_l2",
    featureVersion: 2,
    predictionType: "shot_goal",
    approvalGradeEligibility: approved ? approval : { isEligible: false, blockingReasons: ["no decision-88 evidence"] },
    selectedFeatures: { numeric: ["shotDistanceFeet"], boolean: [], categorical: [] },
    featureKeys: ["shotDistanceFeet"],
    model: { featureCount: 1, weights: [0], bias: 0 },
  } as unknown as PersistedXgModelArtifact;
}

function feature(eventId: number, ownerTeamId: number) {
  return {
    feature_version: 2, game_id: GAME, event_id: eventId, season_id: SEASON, game_date: "2025-10-07",
    event_owner_team_id: ownerTeamId, shooter_player_id: ownerTeamId === 10 ? 91 : 191,
    goalie_in_net_id: ownerTeamId === 10 ? 41 : 31, shot_event_type: "shot-on-goal",
    is_goal: false, creates_rebound: false, feature_payload: { shotDistanceFeet: 20 },
  } as any;
}

/** Stored prediction rows: the approved model and a shadow model score the same shots. */
function storedPredictions() {
  const shots = [feature(101, 10), feature(102, 10), feature(103, 20)];
  const score = (tag: string, approved: boolean, xg: number) =>
    shots.map((shot) =>
      buildPredictionDbRow({
        feature: shot,
        artifact: artifact(tag, approved),
        modelArtifactPath: `/artifacts/${tag}.json`,
        artifactChecksum: `sha-${tag}`,
        predictionType: "shot_goal",
        rawProbability: xg,
        calibratedProbability: null,
        xg,
      })
    );
  return [...score(APPROVED, true, 0.1), ...score(SHADOW, false, 0.9)];
}

function asAggregateInput(rows: Row[]): XgAggregatePredictionRow[] {
  return rows.map((row) => ({ ...row, flurry_sequence_id: null, flurry_shot_index: null })) as XgAggregatePredictionRow[];
}

function response() {
  const res: any = { statusCode: 0, body: undefined, headers: {} };
  res.setHeader = (key: string, value: unknown) => { res.headers[key] = value; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

beforeEach(() => {
  const predictions = storedPredictions();
  const games = [{ id: GAME, seasonId: SEASON, date: "2025-10-07", homeTeamId: 10, awayTeamId: 20 }];
  const aggregates = buildXgAggregates(asAggregateInput(predictions), games, {
    generatedAt: "2026-11-11T00:00:00.000Z",
    rollingWindows: [10],
    coveredGameKeys: new Set([`${APPROVED}:2:${GAME}`, `${SHADOW}:2:${GAME}`]),
  });
  db.tables = {
    nhl_xg_shot_predictions: predictions,
    nhl_xg_team_game_aggregates: aggregates.teamGameRows,
    nhl_xg_team_rolling_aggregates: aggregates.teamRollingRows,
    nhl_xg_player_game_aggregates: aggregates.playerGameRows,
    nhl_xg_goalie_game_aggregates: aggregates.goalieGameRows,
    nhl_xg_model_registry: [
      buildXgModelRegistryRow({ artifact: artifact(APPROVED, true), artifactChecksum: "sha-a", isActive: true, isChampion: true, promotionConfirmed: true }),
      buildXgModelRegistryRow({ artifact: artifact(SHADOW, false), artifactChecksum: "sha-s" }),
    ],
  };
});

describe("shadow scoring (decision 101)", () => {
  it("persists shadow output as unapproved and labelled, with model version and provenance", () => {
    const shadowRows = db.tables.nhl_xg_shot_predictions!.filter((row) => row.model_version === SHADOW);
    expect(shadowRows).toHaveLength(3);
    for (const row of shadowRows) {
      expect(row.model_approved).toBe(false);
      expect(row.provenance).toMatchObject({
        approved: false,
        scoringMode: "shadow_unapproved",
        modelVersion: SHADOW,
        artifactChecksum: `sha-${SHADOW}`,
      });
      expect(row.model_artifact_path).toBe(`/artifacts/${SHADOW}.json`);
    }
    expect(db.tables.nhl_xg_shot_predictions!.find((row) => row.model_version === APPROVED)?.provenance.scoringMode).toBe("approved");
  });

  it("restricts the operation: no flag is refused, the cron secret is refused, a signed-in admin may run it", () => {
    expect(resolveXgScoringMode({ modelApproved: false, allowUnapproved: false, invokedByCron: false })).toMatchObject({ allowed: false, status: 409 });
    expect(resolveXgScoringMode({ modelApproved: false, allowUnapproved: true, invokedByCron: true })).toMatchObject({ allowed: false, status: 403 });
    expect(resolveXgScoringMode({ modelApproved: false, allowUnapproved: true, invokedByCron: false })).toEqual({ allowed: true, mode: "shadow_unapproved" });
    expect(resolveXgScoringMode({ modelApproved: true, allowUnapproved: false, invokedByCron: true })).toEqual({ allowed: true, mode: "approved" });
  });

  it("keeps shadow rows out of every aggregate builder", () => {
    const tables = [
      db.tables.nhl_xg_team_game_aggregates, db.tables.nhl_xg_team_rolling_aggregates,
      db.tables.nhl_xg_player_game_aggregates, db.tables.nhl_xg_goalie_game_aggregates,
    ];
    for (const rows of tables) {
      expect(rows!.length).toBeGreaterThan(0);
      expect(rows!.every((row) => row.model_version === APPROVED)).toBe(true);
    }
    expect(db.tables.nhl_xg_team_game_aggregates!.find((row) => row.team_id === 10)?.xg_for).toBeCloseTo(0.2, 9);

    const predictions = db.tables.nhl_xg_shot_predictions!;
    const assists = buildShotAssistCandidateRows({
      features: [{
        feature_version: 2, game_id: GAME, event_id: 102, season_id: SEASON, game_date: "2025-10-07",
        event_owner_team_id: 10, shooter_player_id: 91, shot_event_type: "shot-on-goal",
        is_unblocked_shot_attempt: true, is_rebound_shot: false, is_penalty_shot_event: false, is_shootout_event: false,
        previous_event_id: 50, previous_event_type_desc_key: "takeaway", previous_event_team_id: 10,
        previous_event_same_team: true, time_since_previous_event_seconds: 2, distance_from_previous_event: 10,
      }],
      predictions: predictions.map((row) => ({ ...row })) as never,
      priorEvents: [{
        game_id: GAME, event_id: 50, type_desc_key: "takeaway", event_owner_team_id: 10, player_id: 92,
        shooting_player_id: null, scoring_player_id: null, winning_player_id: null, hitting_player_id: null,
        blocking_player_id: null, zone_code: "N",
      }],
      generatedAt: "2026-11-11T00:00:00.000Z",
    });
    expect(assists.length).toBeGreaterThan(0);
    expect(assists.every((row) => row.model_version === APPROVED)).toBe(true);

    const created = buildCreatedXgAggregates({
      shotAssistRows: [{ ...assists[0]!, model_version: SHADOW } as never],
      transitionRows: [],
      shotIdentityRows: [],
      shotXgRows: predictions.map((row) => ({
        model_version: row.model_version, feature_version: row.feature_version, game_id: row.game_id,
        event_id: row.event_id, xg: row.xg, model_approved: row.model_approved,
      })),
    });
    expect(created.playerGameRows).toEqual([]);
    expect(created.reconciliation.creditCap.creditsWithoutShotXg).toBe(1);
  });

  it("serves only the approved model from the Metrics Timeline route", async () => {
    const res = response();
    await teamTimelineHandler({ method: "GET", query: { teamId: "10", seasonId: String(SEASON) } } as any, res);
    expect(res.body.model).toMatchObject({ modelVersion: APPROVED });
    expect(res.body.rows.map((row: Row) => [row.model_version, row.xg_for])).toEqual([[APPROVED, 0.2]]);
  });

  it("serves only the approved model on the homepage", async () => {
    const [game] = (await enrichHomepageGames({
      supabase: fakeClient() as any,
      games: [{ id: GAME, homeTeam: { id: 10 }, awayTeam: { id: 20 } }],
      date: "2025-10-07",
    })) as Array<{ analytics?: Record<string, unknown> }>;
    expect(game!.analytics).toMatchObject({ homeXg: 0.2, awayXg: 0.1 });
  });

  it("never serves the shadow model from the xG Lab API, even when asked for it by name", async () => {
    // Per-team xG for/against as each model scored the stored shots.
    const teamTotals = (model: string) => {
      const totals = new Map<number, { xgFor: number; xgAgainst: number }>();
      for (const row of db.tables.nhl_xg_shot_predictions!.filter((prediction) => prediction.model_version === model)) {
        const owner = row.event_owner_team_id as number;
        const opponent = owner === 10 ? 20 : 10;
        const forTeam = totals.get(owner) ?? { xgFor: 0, xgAgainst: 0 };
        const againstTeam = totals.get(opponent) ?? { xgFor: 0, xgAgainst: 0 };
        forTeam.xgFor += row.xg;
        againstTeam.xgAgainst += row.xg;
        totals.set(owner, forTeam);
        totals.set(opponent, againstTeam);
      }
      return totals;
    };
    const approvedTotals = teamTotals(APPROVED);
    const shadowTotals = teamTotals(SHADOW);

    for (const query of [{ modelVersion: SHADOW }, {}]) {
      const res = response();
      await xgLabHandler(
        { method: "GET", query: { scope: "teams", seasonId: String(SEASON), featureVersion: "2", windowGames: "10", ...query } } as any,
        res
      );
      expect(res.statusCode).toBe(200);
      // L2 serves the registry pin whatever model the request names.
      expect(res.body.modelVersion).toBe(APPROVED);
      expect(JSON.stringify(res.body)).not.toContain(SHADOW);
      expect(res.body.rows.length).toBe(2);
      for (const row of res.body.rows) {
        const shadow = shadowTotals.get(row.id)!;
        const approved = approvedTotals.get(row.id)!;
        // A shadow-scored value in any xG column fails the case.
        expect(row.xgFor).not.toBeCloseTo(shadow.xgFor, 9);
        expect(row.xgAgainst).not.toBeCloseTo(shadow.xgAgainst, 9);
        expect(row.xgFor).toBeCloseTo(approved.xgFor, 9);
        expect(row.xgAgainst).toBeCloseTo(approved.xgAgainst, 9);
      }
    }
  });

  it("never promotes a shadow model: its registry row is a candidate and cannot be activated", () => {
    expect(db.tables.nhl_xg_model_registry!.find((row) => row.model_version === SHADOW)).toMatchObject({
      approval_status: "candidate",
      model_approved: false,
      is_active: false,
    });
    expect(() =>
      buildXgModelRegistryRow({ artifact: artifact(SHADOW, false), isActive: true, promotionConfirmed: true })
    ).toThrow("Only an approved artifact can be activated or promoted.");
  });
});
