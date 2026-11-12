import { describe, expect, it } from "vitest";

import { publishSeasonRun } from "./admin";
import {
  expandFantasyProjectionSummaryNullable,
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  fantasyProjectionTotalNullable,
  type FantasyProjectionCompactPlayersResponseV2,
} from "./contracts";
import { loadFantasyProjectionPlayers } from "./queries";
import { validateSeasonDraft } from "./validation";

// Stored joint quantiles (draw-based, rule 26): the derived ASSISTS and POINTS
// bands are narrower than sums of the component bands (22 ≠ 12 + 7,
// 39 ≠ 14 + 22), so a marginal rebuild is detectable.
const storedQuantiles = {
  p10: { GOALS: 14, PRIMARY_ASSISTS: 12, SECONDARY_ASSISTS: 7, ASSISTS: 22, POINTS: 39,
    SHOTS_ON_GOAL: 180, GAMES_PLAYED: 74, SHOOTING_PERCENTAGE: 0.08, POINTS_PER_GAME: 0.5 },
  p50: { GOALS: 20, PRIMARY_ASSISTS: 18, SECONDARY_ASSISTS: 12, ASSISTS: 30, POINTS: 50,
    SHOTS_ON_GOAL: 200, GAMES_PLAYED: 80, SHOOTING_PERCENTAGE: 0.1, POINTS_PER_GAME: 0.625 },
  p90: { GOALS: 26, PRIMARY_ASSISTS: 24, SECONDARY_ASSISTS: 17, ASSISTS: 38, POINTS: 61,
    SHOTS_ON_GOAL: 220, GAMES_PLAYED: 82, SHOOTING_PERCENTAGE: 0.12, POINTS_PER_GAME: 0.75 },
};

const aggregateRow = {
  run_id: "run-1",
  fhfh_player_id: 9,
  team_id: 1,
  player_name: "Joint Skater",
  position: "C",
  population: "forward",
  pool_status: "verified_active",
  roster_status: "active_nhl",
  roster_confidence: 0.9,
  source_fresh_at: null,
  rookie_profile: {},
  expected_games: 80,
  expected_starts: null,
  expected_toi: { total: 1200, evenStrength: null },
  ratings: {},
  deployment: {},
  model_means: { GOALS: 20, PRIMARY_ASSISTS: 18, SECONDARY_ASSISTS: 12, SHOTS_ON_GOAL: 200,
    GAMES_PLAYED: 80, TAKEAWAYS: null },
  ...storedQuantiles,
  component_manifest: [],
  fallback_flags: [],
  provenance: {},
};

function mockDb(tables: Record<string, any[]>, single: Record<string, unknown>) {
  const calls: Array<{ name: string; args: any }> = [];
  const client = {
    from(table: string) {
      const query: any = {};
      for (const method of ["select", "eq", "in", "order", "range", "limit"]) {
        query[method] = () => query;
      }
      query.maybeSingle = async () => ({ data: single[table] ?? null, error: null });
      query.then = (resolve: (value: unknown) => void) =>
        resolve({ data: tables[table] ?? [], error: null });
      return query;
    },
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      return { data: { ok: true }, error: null };
    },
  };
  return { client: client as never, calls };
}

async function publish(overrides: any[] = []) {
  const { client, calls } = mockDb(
    {
      player_forecast_season_player_aggregates: [aggregateRow],
      player_forecast_season_team_aggregates: [],
      player_forecast_season_overrides: overrides,
    },
    {
      player_forecast_season_runs: { id: "run-1", status: "validated", view_key: "current",
        validation_receipt: { valid: true } },
    },
  );
  await publishSeasonRun({ supabase: client, editorUserId: "editor", runId: "run-1",
    label: "Test", reason: "test" });
  return calls[0].args.p_player_rows[0];
}

const release = {
  id: "release-1", season_id: 20262027, view_key: "current", release_number: 1,
  release_label: "Test", beta: true, issued_at: "2026-10-01T00:00:00Z",
  cutoff_at: "2026-10-01T00:00:00Z", artifact_checksum: "a",
  contract_version: FANTASY_PROJECTION_CONTRACT_VERSION,
  contract_checksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  roster_revision_hash: "r", schedule_revision_hash: "s", source_high_watermark: "w",
  release_hash: "h",
};

async function serve(rows: any[], format: "summary" | "full") {
  const { client } = mockDb(
    { player_forecast_season_release_players: rows, teams: [{ id: 1, abbreviation: "TST" }] },
    {
      player_forecast_season_active_releases: { release_id: "release-1" },
      player_forecast_season_releases: release,
    },
  );
  return loadFantasyProjectionPlayers({ supabase: client, seasonId: 20262027,
    view: "current", format }) as Promise<any>;
}

describe("season publication carries joint quantiles (W3-5 PR1, rule 26)", () => {
  it("round-trips the stored joint bands unchanged when nothing is edited", async () => {
    const published = await publish();
    expect(published.p10).toEqual(storedQuantiles.p10);
    expect(published.p50).toEqual(storedQuantiles.p50);
    expect(published.p90).toEqual(storedQuantiles.p90);
    const served = await serve([{ ...published, id: "rp-1", release_id: "release-1" }], "full");
    expect(served.players[0].p10.POINTS).toBe(39);
    expect(served.players[0].p90.ASSISTS).toBe(38);
  });

  it("shifts sum bands with an edit and withholds ratio bands that depended on it", async () => {
    const published = await publish([{ id: "o-1", scope_type: "player", fhfh_player_id: 9,
      field_path: "stats.GOALS", override_value: 25, supersedes_id: null, expires_at: null }]);
    expect([published.p10.GOALS, published.p90.GOALS]).toEqual([19, 31]);
    expect([published.p10.POINTS, published.p50.POINTS, published.p90.POINTS]).toEqual([44, 55, 66]);
    expect([published.p10.ASSISTS, published.p90.ASSISTS]).toEqual([22, 38]);
    for (const ratio of ["SHOOTING_PERCENTAGE", "POINTS_PER_GAME"]) {
      expect(published.p10).not.toHaveProperty(ratio);
      expect(published.p90).not.toHaveProperty(ratio);
    }
    expect(published.published_values.SHOOTING_PERCENTAGE).toBeCloseTo(0.125);
    const issues = validateSeasonDraft({
      contractVersion: FANTASY_PROJECTION_CONTRACT_VERSION,
      contractChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
      scheduleGameCount: 1344,
      gamesPerTeam: {},
      rosterCounts: {},
      players: [{ fhfhPlayerId: 9, teamId: 1, population: "forward",
        expectedGames: published.expected_games, expectedStarts: null,
        modelValues: published.base_values, publishedValues: published.published_values,
        p10: published.p10, p50: published.p50, p90: published.p90, deployment: {} }],
    });
    expect(issues.filter((issue) => issue.code === "quantile_order_invalid")).toEqual([]);
  });
});

describe("season readers keep unknown values unknown (W3-5 F6/PR3)", () => {
  it("round-trips {TAKEAWAYS: null} as unknown through publish, both payloads and the total", async () => {
    const published = await publish();
    expect(published.published_values).not.toHaveProperty("TAKEAWAYS");
    expect(published.expected_toi).toEqual({ total: 1200 });
    const issued = { ...published, id: "rp-1", release_id: "release-1" };
    // An issued row may carry an explicit null; it must not become 0 either.
    const other = { ...issued, id: "rp-2", fhfh_player_id: 10, player_name: "Other",
      published_values: { GOALS: 5, TAKEAWAYS: null } };
    const scoring = { GOALS: 2, TAKEAWAYS: 1 };

    const summary = await serve([issued, other], "summary");
    expect(summary.encoding).toBe("player-summary-v2");
    const expanded = expandFantasyProjectionSummaryNullable(
      { success: true, ...summary } as FantasyProjectionCompactPlayersResponseV2,
    );
    for (const player of expanded.players) {
      expect(player.publishedValues.TAKEAWAYS).toBeNull();
      expect(fantasyProjectionTotalNullable(player.publishedValues, scoring)).toMatchObject({
        value: null,
        missingKeys: ["TAKEAWAYS"],
      });
    }

    const full = await serve([issued, other], "full");
    expect(full.players[1].publishedValues.TAKEAWAYS).toBeNull();
    expect(full.players[0].expectedToi).toEqual({ total: 1200 });
    expect(fantasyProjectionTotalNullable(full.players[0].publishedValues, scoring).value).toBeNull();
    expect(fantasyProjectionTotalNullable(full.players[0].publishedValues, { GOALS: 2 }).value).toBe(40);
  });
});
