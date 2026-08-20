import fs from "fs";
import { describe, expect, it, vi } from "vitest";

import {
  aggregateSeasonGames,
  evaluatePortableSeasonGame,
  mergeAdvancedSeasonArtifact,
  type AdvancedSeasonArtifact,
  type PortableSeasonArtifact,
} from "./evaluator";
import {
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  FANTASY_PROJECTION_SUMMARY_ENCODING,
  FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V4_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  expandFantasyProjectionSummary,
  fantasyProjectionTotal,
  reconcileProjectionQuantiles,
  reconcileProjectionValues,
  SKATER_PRIMITIVE_TARGETS,
} from "./contracts";
import { validateSeasonDraft } from "./validation";
import {
  allocateSeasonTotalAdjustment,
  scoreSeasonPrimitive,
} from "./settlement";
import {
  parseOfficialNhlPlayerEvidence,
  planSeasonIdentityResolution,
  persistSeasonIdentityResolution,
  searchSeasonIdentityCandidates,
} from "./identityResolution";
import { activePendingPlayerPoolReviews } from "./admin";
import { releaseMatchesPublicContract } from "./queries";
import { resolveSeasonRosterConsensus } from "./rosterIntegrity";
import {
  findOfficialRosterAuditEvidence,
  parseOfficialNhlArticleCapture,
} from "./transactionAudit";
import { playerForecastEditorConfiguration } from "../../utils/playerForecastSeasonEditorOnlyMiddleware";

describe("fantasy projection contracts", () => {
  it("keeps superseded contract releases out of the current public release list", () => {
    expect(releaseMatchesPublicContract({
      contract_version: FANTASY_PROJECTION_CONTRACT_VERSION,
      contract_checksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
    })).toBe(true);
    expect(releaseMatchesPublicContract({
      contract_version: FANTASY_PROJECTION_CONTRACT_VERSION,
      contract_checksum: "superseded-checksum",
    })).toBe(false);
    expect(releaseMatchesPublicContract({
      contract_version: FANTASY_PROJECTION_V4_CONTRACT_VERSION,
      contract_checksum: FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
    })).toBe(true);
  });

  it("automatically resolves only approved two-source roster consensus", () => {
    const automatic = resolveSeasonRosterConsensus({
      currentOrganizationTeamId: 14,
      observations: [
        {
          id: "landing",
          observationKind: "player_landing",
          organizationTeamId: 2,
          rosterStatus: "active_nhl",
          availableAt: "2026-08-18T10:00:00Z",
          confidence: 1,
        },
        {
          id: "transaction",
          observationKind: "official_transaction",
          organizationTeamId: 2,
          rosterStatus: "active_nhl",
          availableAt: "2026-08-18T11:00:00Z",
          confidence: 0.99,
        },
      ],
    });
    expect(automatic).toMatchObject({
      resolution: "automatic",
      organizationTeamId: 2,
      rosterStatus: "active_nhl",
      observationIds: ["landing", "transaction"],
    });

    const singleSource = resolveSeasonRosterConsensus({
      currentOrganizationTeamId: 14,
      observations: [{
        id: "landing-only",
        observationKind: "player_landing",
        organizationTeamId: 2,
        rosterStatus: "active_nhl",
        availableAt: "2026-08-18T10:00:00Z",
        confidence: 1,
      }],
    });
    expect(singleSource).toMatchObject({
      resolution: "review_required",
      organizationTeamId: 14,
      conflictType: "single_source",
    });
  });

  it("does not treat an offseason roster omission as release evidence", () => {
    const consensus = resolveSeasonRosterConsensus({
      currentOrganizationTeamId: 24,
      currentRosterStatus: "prospect_reserve",
      observations: [],
    });
    expect(consensus).toMatchObject({
      resolution: "review_required",
      organizationTeamId: 24,
      rosterStatus: "prospect_reserve",
    });
  });

  it("separates offseason organization consensus from active-roster status", () => {
    const consensus = resolveSeasonRosterConsensus({
      currentOrganizationTeamId: 24,
      currentRosterStatus: "prospect_reserve",
      observations: [
        {
          id: "organization-roster",
          observationKind: "official_roster",
          organizationTeamId: 24,
          rosterStatus: "unresolved",
          availableAt: "2026-08-19T10:00:00Z",
          confidence: 1,
        },
        {
          id: "player-landing",
          observationKind: "player_landing",
          organizationTeamId: 24,
          rosterStatus: "unresolved",
          availableAt: "2026-08-19T10:01:00Z",
          confidence: 1,
        },
      ],
    });
    expect(consensus).toMatchObject({
      resolution: "automatic",
      organizationTeamId: 24,
      rosterStatus: "prospect_reserve",
      conflictType: null,
    });
  });

  it("holds an organization match when official roster statuses conflict", () => {
    const consensus = resolveSeasonRosterConsensus({
      currentOrganizationTeamId: 24,
      currentRosterStatus: "prospect_reserve",
      observations: [
        {
          id: "landing",
          observationKind: "player_landing",
          organizationTeamId: 24,
          rosterStatus: "active_nhl",
          availableAt: "2026-08-19T10:00:00Z",
          confidence: 1,
        },
        {
          id: "transaction",
          observationKind: "official_transaction",
          organizationTeamId: 24,
          rosterStatus: "affiliate",
          availableAt: "2026-08-19T10:01:00Z",
          confidence: 1,
        },
      ],
    });
    expect(consensus).toMatchObject({
      resolution: "review_required",
      organizationTeamId: 24,
      rosterStatus: "prospect_reserve",
      conflictType: "status_disagreement",
    });
  });

  it("matches roster conflicts only to corroborating official NHL tracker evidence", () => {
    const capture = parseOfficialNhlArticleCapture(
      '<script type="application/ld&#x2B;json">' +
        JSON.stringify({
          articleBody:
            "## WASHINGTON CAPITALS Group 3 Unrestricted Free Agents: Jonny Brodzinski (signed: WSH). " +
            "**JUNE 29:** Utah Mammoth acquire forward Joshua Roy from the Montreal Canadiens.",
          datePublished: "2026-08-19T16:20:00Z",
        }) +
        "</script>",
      "https://www.nhl.com/news/topic/free-agency/free-agency-signings-nhl-2026-27",
    );
    expect(findOfficialRosterAuditEvidence({
      playerName: "Jonny Brodzinski",
      teamName: "Washington Capitals",
      teamAbbreviation: "WSH",
      captures: [capture],
    })).toMatchObject({ eventType: "signing" });
    expect(findOfficialRosterAuditEvidence({
      playerName: "Jonny Brodzinski",
      teamName: "New York Rangers",
      teamAbbreviation: "NYR",
      captures: [capture],
    })).toBeNull();
  });

  it("decodes the compact all-player payload without losing sortable metrics", () => {
    const result = expandFantasyProjectionSummary({
      success: true,
      betaLabel: "beta",
      release: { id: "release-1" } as any,
      encoding: FANTASY_PROJECTION_SUMMARY_ENCODING,
      metricKeys: ["GAMES_PLAYED", "POINTS", "SHOTS"],
      players: [[
        10, 21, "COL", "Nathan MacKinnon", "C", "forward",
        "verified_active", "active_nhl", 1, "2026-08-18T12:00:00Z",
        0, 100, 0.9, [1, null, 1, null, null], 0, [], [81.9, 132.8, 409],
      ]],
    });
    expect(result.players[0]).toMatchObject({
      fhfhPlayerId: 10,
      expectedGames: 81.9,
      publishedValues: { GAMES_PLAYED: 81.9, POINTS: 132.8, SHOTS: 409 },
      deployment: { mostLikelyRole: { forwardLine: 1, powerPlayUnit: 1 } },
    });
  });

  it("merges checksum-verified v5 rates into the portable v4 runtime", () => {
    const base = {
      schemaVersion: "player-forecast-season-artifact-v1",
      seasonId: 20262027,
      contractVersion: FANTASY_PROJECTION_V4_CONTRACT_VERSION,
      contractChecksum: FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
      artifactVersion: "v4-test",
      featureSchemaVersion: "v4-test",
      trainingCutoffAt: "2026-04-16T23:59:59Z",
      codeVersion: "test",
      players: {
        "10": {
          fhfhPlayerId: 10,
          population: "forward",
          position: "C",
          teamId: 1,
          playProbability: 0.8,
          conditionalRates: { GAMES_PLAYED: 1, PRIMARY_ASSISTS: 0.5 },
          baselineConditionalRates: { GAMES_PLAYED: 1, PRIMARY_ASSISTS: 0.4 },
          conditionalVariances: { GAMES_PLAYED: 0, PRIMARY_ASSISTS: 0.2 },
          ratings: {},
          deployment: {},
          primitiveTargets: ["GAMES_PLAYED", "PRIMARY_ASSISTS"],
        },
      },
      teams: {
        "1": { teamId: 1, offenseMultiplier: 1, defenseMultiplier: 1, paceMultiplier: 1, ratings: {} },
        "2": { teamId: 2, offenseMultiplier: 1, defenseMultiplier: 1, paceMultiplier: 1, ratings: {} },
      },
    } satisfies PortableSeasonArtifact;
    const advanced = {
      schemaVersion: "player-forecast-season-advanced-artifact-v1",
      seasonId: 20262027,
      contractVersion: FANTASY_PROJECTION_V5_CONTRACT_VERSION,
      contractChecksum: FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
      artifactVersion: "v5-test",
      featureSchemaVersion: "v5-test",
      trainingCutoffAt: "2026-04-16T23:59:59Z",
      codeVersion: "test",
      baseV4ArtifactChecksum: "a".repeat(64),
      players: { "10": { fhfhPlayerId: 10, population: "forward", rates: { SHOT_ATTEMPTS: 4 } } },
      teams: { "1": { teamId: 1, rates: { TEAM_PACE: 61 } }, "2": { teamId: 2, rates: {} } },
      targetPolicies: {
        forward: {
          SHOT_ATTEMPTS: { baselineRate: 3, residual80PerGame: 2 },
          EXPECTED_PRIMARY_ASSISTS: { fallback: true },
        },
      },
    } satisfies AdvancedSeasonArtifact;
    const merged = mergeAdvancedSeasonArtifact(base, advanced);
    const result = evaluatePortableSeasonGame(merged, 10, {
      gameId: 1,
      scheduledStartAt: "2026-10-01T00:00:00Z",
      teamId: 1,
      opponentTeamId: 2,
      isHome: true,
    });
    expect(result.conditionalMeans.SHOT_ATTEMPTS).toBe(4);
    expect(result.unconditionalMeans.SHOT_ATTEMPTS).toBe(3.2);
    expect(result.conditionalMeans.EXPECTED_PRIMARY_ASSISTS).toBe(0.5);
    expect(merged.teams["1"].advancedRates?.TEAM_PACE).toBe(61);
  });

  it("uses cross-bound interval arithmetic for rate metrics", () => {
    const quantiles = reconcileProjectionQuantiles({
      p10: { GAMES_PLAYED: 60, TOTAL_TOI: 900 },
      p50: { GAMES_PLAYED: 75, TOTAL_TOI: 1350 },
      p90: { GAMES_PLAYED: 84, TOTAL_TOI: 1764 },
    }, "forward");
    expect(quantiles.p10.TOI_PER_GAME).toBeLessThanOrEqual(quantiles.p50.TOI_PER_GAME);
    expect(quantiles.p50.TOI_PER_GAME).toBeLessThanOrEqual(quantiles.p90.TOI_PER_GAME);
    expect(quantiles.p50.TOI_PER_GAME).toBe(18);
  });

  it("coalesces repeated roster changes by player and view", () => {
    const migration = fs.readFileSync(
      "../supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql",
      "utf8",
    );
    expect(migration).toContain(":view:current:roster:player:");
    expect(migration).toContain(":view:ros:roster:player:");
    expect(migration).not.toContain(":departure:");
  });

  it("compacts covered season jobs without deleting their audit history", () => {
    const migration = fs.readFileSync(
      "../supabase/migrations/20260820014700_player_forecast_season_queue_compaction.sql",
      "utf8",
    );
    expect(migration).toContain("compact_player_forecast_season_queue");
    expect(migration).toContain("max(queue.source_high_watermark)");
    expect(migration).toContain("status = 'cancelled'");
    expect(migration).toContain("'allLeague', true");
    expect(migration).not.toMatch(/delete\s+from\s+public\.player_forecast_season_queue/i);
  });

  it("keeps raw hockey identities independent of fantasy scoring", () => {
    const values = reconcileProjectionValues(
      { GOALS: 20, PRIMARY_ASSISTS: 24, SECONDARY_ASSISTS: 16, PP_GOALS: 5, PP_ASSISTS: 9 },
      "forward",
    );
    expect(values.ASSISTS).toBe(40);
    expect(values.POINTS).toBe(60);
    expect(values.PP_POINTS).toBe(14);
    expect(fantasyProjectionTotal(values, { GOALS: 3, ASSISTS: 2 })).toBe(140);
  });

  it("requires exactly one editor UUID in production", () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    expect(playerForecastEditorConfiguration({ NODE_ENV: "production", PLAYER_FORECAST_EDITOR_USER_IDS: first }).valid).toBe(true);
    expect(playerForecastEditorConfiguration({ NODE_ENV: "production", PLAYER_FORECAST_EDITOR_USER_IDS: `${first},${second}` }).valid).toBe(false);
    expect(playerForecastEditorConfiguration({ NODE_ENV: "production" }).valid).toBe(false);
  });

  it("scores model and baseline losses and preserves aggregate editorial deltas", () => {
    const score = scoreSeasonPrimitive({
      actual: 1,
      forecast: 0.8,
      baselineForecast: 0.5,
      p10: 0,
      p90: 1,
      probability: true,
    });
    expect(score).toMatchObject({
      baselineAbsoluteError: 0.5,
      interval80Covered: true,
      skillIndex: 80,
    });
    expect(score.absoluteError).toBeCloseTo(0.2);
    expect(score.brier).toBeCloseTo(0.04);
    const adjusted = [1, 2, 3].map((modelGameForecast) =>
      allocateSeasonTotalAdjustment({
        modelGameForecast,
        modelRemainingTotal: 6,
        adjustmentDelta: 3,
        remainingGames: 3,
      }),
    );
    expect(adjusted.reduce((total, value) => total + value, 0)).toBe(9);
  });

  it("validates nested deployment probability families and their sums", () => {
    const gamesPerTeam = Object.fromEntries(
      Array.from({ length: 32 }, (_, index) => [String(index + 1), 84]),
    );
    const rosterCounts = Object.fromEntries(
      Object.keys(gamesPerTeam).map((teamId) => [
        teamId,
        { forwards: 12, defensemen: 6, goalies: 2 },
      ]),
    );
    const primitives = Object.fromEntries(
      SKATER_PRIMITIVE_TARGETS.map((target) => [target, 0]),
    );
    const values = reconcileProjectionValues(primitives, "forward");
    const base = {
      contractVersion: FANTASY_PROJECTION_CONTRACT_VERSION,
      contractChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
      scheduleGameCount: 1344,
      gamesPerTeam,
      rosterCounts,
      players: [{
        fhfhPlayerId: 1,
        teamId: 1,
        population: "forward" as const,
        expectedGames: 0,
        expectedStarts: null,
        modelValues: values,
        publishedValues: values,
        p10: values,
        p50: values,
        p90: values,
        deployment: {
          roleProbabilities: {
            forwardLine: { F1: 0.7, other: 0.3 },
            powerPlayUnit: { PP1: 0.6, other: 0.4 },
          },
        },
      }],
    };
    expect(validateSeasonDraft(base)).toEqual([]);
    const invalid = structuredClone(base);
    invalid.players[0].deployment.roleProbabilities.forwardLine = {
      F1: 0.7,
      other: 0.4,
    };
    expect(validateSeasonDraft(invalid)).toContainEqual(
      expect.objectContaining({ code: "role_probability_sum_invalid" }),
    );
  });

  it("normalizes checksum-bound official NHL evidence without fabricated fields", () => {
    const evidence = parseOfficialNhlPlayerEvidence(
      {
        playerId: 8481538,
        firstName: { default: "Judd" },
        lastName: { default: "Caulfield" },
        position: "R",
        birthDate: "2001-03-19",
        birthCity: { default: "Grand Forks" },
        birthCountry: "USA",
        heightInCentimeters: 191,
        weightInKilograms: 100,
        currentTeamId: 24,
        fullTeamName: { default: "Anaheim Ducks" },
        sweaterNumber: 36,
        headshot: "https://assets.nhle.com/player.png",
      },
      8481538,
      "2026-08-13T15:00:00.000Z",
    );
    expect(evidence).toMatchObject({
      nhlPlayerId: 8481538,
      firstName: "Judd",
      lastName: "Caulfield",
      currentTeamId: 24,
      birthDate: "2001-03-19",
    });
    expect(evidence.sourcePayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      parseOfficialNhlPlayerEvidence(
        { ...evidence, playerId: 1 },
        8481538,
      ),
    ).toThrow("incomplete or mismatched");
  });

  it("deduplicates exact-ID and fuzzy identity candidates and blocks conflicting NHL IDs", async () => {
    const rpc = vi.fn(async (_name: string, params: { p_query: string }) => ({
      data:
        params.p_query === "8481538"
          ? [{
              player_id: 10,
              canonical_name: "Judd Caulfield",
              birth_year: 2001,
              canonical_position: "R",
              current_organization_name: "Anaheim Ducks",
              current_organization_type: "nhl",
              lifecycle_status: "active_nhl",
              headshot_url: null,
              nhl_player_id: 8481538,
              match_kind: "external_id_exact",
              similarity_score: 1,
            }]
          : [
              {
                player_id: 10,
                canonical_name: "Judd Caulfield",
                birth_year: 2001,
                canonical_position: "R",
                current_organization_name: "Anaheim Ducks",
                current_organization_type: "nhl",
                lifecycle_status: "active_nhl",
                headshot_url: null,
                nhl_player_id: 8481538,
                match_kind: "canonical_exact",
                similarity_score: 1,
              },
              {
                player_id: 11,
                canonical_name: "Cole Caufield",
                birth_year: 2001,
                canonical_position: "R",
                current_organization_name: "Montreal Canadiens",
                current_organization_type: "nhl",
                lifecycle_status: "active_nhl",
                headshot_url: null,
                nhl_player_id: 8481600,
                match_kind: "fuzzy",
                similarity_score: 0.58,
              },
            ],
      error: null,
    }));
    const candidates = await searchSeasonIdentityCandidates({
      supabase: { rpc } as any,
      query: "Judd Caulfield",
      reviewNhlPlayerId: 8481538,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      fhfhPlayerId: 10,
      matchKind: "external_id_exact",
      mappingAllowed: true,
    });
    expect(candidates[1]).toMatchObject({
      fhfhPlayerId: 11,
      mappingAllowed: false,
    });
  });

  it("persists identity decisions only through the atomic service RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { reviewId: "resolved", resolutionStatus: "excluded" },
      error: null,
    });
    const result = await persistSeasonIdentityResolution({
      supabase: { rpc } as any,
      editorUserId: "11111111-1111-4111-8111-111111111111",
      reviewId: "22222222-2222-4222-8222-222222222222",
      action: "exclude",
      reason: "Official roster evidence was superseded.",
    });
    expect(result).toMatchObject({ resolutionStatus: "excluded" });
    expect(rpc).toHaveBeenCalledWith(
      "resolve_player_forecast_season_identity",
      expect.objectContaining({
        p_resolution_action: "exclude",
        p_official_player: null,
      }),
    );
  });

  it("plans conservative automatic identity resolutions from exact official evidence", () => {
    const review = {
      id: "review-1",
      seasonId: 20262027,
      nhlPlayerId: 8481538,
      rawPlayerName: "Judd Caulfield",
      teamId: 24,
      position: "R",
      issueCode: "official_roster_identity_unmapped",
    };
    const officialPlayer = {
      nhlPlayerId: 8481538,
      firstName: "Judd",
      lastName: "Caulfield",
      position: "R" as const,
      birthDate: "2001-03-19",
      birthCity: null,
      birthCountry: "USA",
      heightInCentimeters: 191,
      weightInKilograms: 93,
      currentTeamId: 24,
      teamName: "Anaheim Ducks",
      sweaterNumber: null,
      headshotUrl: null,
      sourceUrl: "https://api-web.nhle.com/v1/player/8481538/landing",
      observedAt: "2026-08-19T12:00:00Z",
      sourcePayloadHash: "a".repeat(64),
    };

    expect(planSeasonIdentityResolution({
      review,
      officialPlayer,
      identities: [],
    })).toMatchObject({
      action: "create_new",
      lifecycleStatus: "active_prospect",
    });
    expect(planSeasonIdentityResolution({
      review,
      officialPlayer,
      identities: [{
        fhfhPlayerId: 101,
        nhlPlayerId: null,
        canonicalName: "Judd Caulfield",
        birthDate: "2001-03-19",
        position: "R",
        verificationStatus: "provisional",
        mergedIntoId: null,
      }],
    })).toMatchObject({
      action: "map_existing",
      fhfhPlayerId: 101,
    });
    expect(planSeasonIdentityResolution({
      review: { ...review, teamId: 2 },
      officialPlayer,
      identities: [],
    })).toMatchObject({ action: "manual_review" });
  });

  it("removes superseded identity reviews from the unresolved editor list", () => {
    const pending = {
      id: "pending-judd",
      resolution_status: "pending",
      supersedes_id: null,
    };
    const mapped = {
      id: "mapped-judd",
      resolution_status: "mapped",
      supersedes_id: pending.id,
    };
    expect(activePendingPlayerPoolReviews([pending, mapped])).toEqual([]);
    expect(activePendingPlayerPoolReviews([pending])).toEqual([pending]);
  });
});

describe("portable season evaluator", () => {
  it("does not multiply player-specific rates by own-team offense twice", () => {
    const zeroRates = Object.fromEntries(
      SKATER_PRIMITIVE_TARGETS.map((target) => [target, 0]),
    );
    const artifact = {
      schemaVersion: "player-forecast-season-artifact-v1",
      seasonId: 20262027,
      contractVersion: FANTASY_PROJECTION_CONTRACT_VERSION,
      contractChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
      artifactVersion: "test",
      featureSchemaVersion: "test",
      trainingCutoffAt: "2026-04-16T23:59:59Z",
      codeVersion: "test",
      players: {
        "10": {
          fhfhPlayerId: 10,
          population: "forward",
          position: "C",
          teamId: 1,
          playProbability: 1,
          conditionalRates: { ...zeroRates, GOALS: 0.5 },
          conditionalVariances: zeroRates,
          ratings: {},
          deployment: {},
        },
      },
      teams: {
        "1": {
          teamId: 1,
          offenseMultiplier: 1.3,
          defenseMultiplier: 1,
          paceMultiplier: 1,
          ratings: {},
        },
        "2": {
          teamId: 2,
          offenseMultiplier: 1,
          defenseMultiplier: 1,
          paceMultiplier: 1,
          ratings: {},
        },
      },
    } satisfies PortableSeasonArtifact;
    const result = evaluatePortableSeasonGame(artifact, 10, {
      gameId: 2026020001,
      scheduledStartAt: "2026-10-01T23:00:00Z",
      teamId: 1,
      opponentTeamId: 2,
      isHome: true,
    });
    expect(result.conditionalMeans.GOALS).toBe(0.5);
    expect(result.quantiles.p90.GAMES_PLAYED).toBeLessThanOrEqual(1);
  });

  const artifactPath = process.env.PLAYER_FORECAST_SEASON_GOLDEN_ARTIFACT;
  const golden = artifactPath ? it : it.skip;

  golden("matches Python golden vectors byte-for-byte", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath!, "utf8")) as PortableSeasonArtifact;
    expect(artifact.goldenVectors).toHaveLength(3);
    for (const vector of artifact.goldenVectors ?? []) {
      const actual = evaluatePortableSeasonGame(artifact, vector.fhfhPlayerId, vector.game);
      expect({ ...actual, componentHash: vector.expected.componentHash }).toEqual(
        vector.expected,
      );
      expect(actual.componentHash).toBe(vector.expected.componentHash);
    }
    const evaluations = (artifact.goldenVectors ?? []).map((vector) =>
      evaluatePortableSeasonGame(artifact, vector.fhfhPlayerId, vector.game),
    );
    const otherPopulation = evaluations[0].population === "goalie" ? "forward" : "goalie";
    expect(() => aggregateSeasonGames([
      evaluations[0],
      { ...evaluations[1], population: otherPopulation },
    ])).toThrow(
      "PLAYER_FORECAST_SEASON_POPULATION_MISMATCH",
    );
  });
});
