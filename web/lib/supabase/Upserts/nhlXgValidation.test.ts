import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import {
  compareLegacyAndNhlParitySample,
  compareLegacyAndNhlParitySamples,
  summarizeNormalizedEventValidationResults,
  summarizeParitySampleComparisons,
  validateNormalizedEventBatchAgainstRawPayloads,
  validateNormalizedEventsAgainstRawPlayByPlay,
} from "./nhlXgValidation";

function createRawPayload(plays: Record<string, unknown>[]) {
  return {
    id: 2025020418,
    season: 20252026,
    gameDate: "2026-03-30",
    homeTeam: { id: 10, abbrev: "TOR" },
    awayTeam: { id: 20, abbrev: "NYR" },
    plays,
  };
}

function parseEvents(plays: Record<string, unknown>[]) {
  return parseNhlPlayByPlayEvents(createRawPayload(plays) as any, {
    sourcePlayByPlayHash: "validation-hash",
    now: "2026-03-30T12:00:00.000Z",
  });
}

describe("nhlXgValidation", () => {
  it("passes when normalized events match raw play-by-play counts, ids, and type totals", () => {
    const plays = [
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 21,
          zoneCode: "O",
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 75,
          yCoord: 8,
          zoneCode: "O",
        },
      },
      {
        eventId: 102,
        sortOrder: 102,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:12",
        timeRemaining: "19:48",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          goalieInNetId: 31,
          xCoord: 82,
          yCoord: -1,
          zoneCode: "O",
        },
      },
    ];

    const normalizedEvents = parseEvents(plays);
    const result = validateNormalizedEventsAgainstRawPlayByPlay(
      createRawPayload(plays),
      normalizedEvents
    );

    expect(result).toMatchObject({
      gameId: 2025020418,
      rawEventCount: 3,
      normalizedEventCount: 3,
      matchingEventIdCount: 3,
      missingNormalizedEventIds: [],
      extraNormalizedEventIds: [],
      duplicateNormalizedEventIds: [],
      duplicateNormalizedSortOrders: [],
      typeCountMismatches: [],
      passed: true,
    });
    expect(result.rawTypeCounts).toEqual({
      faceoff: 1,
      "shot-on-goal": 1,
      goal: 1,
    });
    expect(result.normalizedTypeCounts).toEqual({
      faceoff: 1,
      "shot-on-goal": 1,
      goal: 1,
    });
  });

  it("reports missing, extra, duplicate, and type-count mismatches for a failed normalized game", () => {
    const plays = [
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:00",
        timeRemaining: "19:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 524,
        typeDescKey: "giveaway",
        details: {
          eventOwnerTeamId: 20,
          playerId: 21,
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:05",
        timeRemaining: "18:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 68,
          yCoord: 7,
          zoneCode: "O",
        },
      },
    ];

    const normalizedEvents = parseEvents(plays);
    const brokenEvents = [
      normalizedEvents[0],
      {
        ...normalizedEvents[0],
        event_id: 999,
        sort_order: normalizedEvents[0].sort_order,
        type_desc_key: "shot-on-goal",
      },
    ];

    const result = validateNormalizedEventsAgainstRawPlayByPlay(
      createRawPayload(plays),
      brokenEvents as any
    );

    expect(result).toMatchObject({
      rawEventCount: 2,
      normalizedEventCount: 2,
      matchingEventIdCount: 1,
      missingNormalizedEventIds: [201],
      extraNormalizedEventIds: [999],
      duplicateNormalizedEventIds: [],
      duplicateNormalizedSortOrders: [200],
      passed: false,
    });
    expect(result.typeCountMismatches).toEqual([
      {
        typeDescKey: "missed-shot",
        rawCount: 1,
        normalizedCount: 0,
      },
      {
        typeDescKey: "shot-on-goal",
        rawCount: 0,
        normalizedCount: 1,
      },
    ]);
  });

  it("summarizes batch validation results across multiple games", () => {
    const passPlays = [
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "02:00",
        timeRemaining: "18:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
    ];
    const failPlays = [
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "03:00",
        timeRemaining: "17:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 503,
        typeDescKey: "hit",
        details: {
          eventOwnerTeamId: 10,
          hittingPlayerId: 91,
          hitteePlayerId: 21,
        },
      },
    ];

    const summary = validateNormalizedEventBatchAgainstRawPayloads([
      {
        rawPayload: createRawPayload(passPlays),
        normalizedEvents: parseEvents(passPlays),
      },
      {
        rawPayload: { ...createRawPayload(failPlays), id: 2025020419 },
        normalizedEvents: [],
      },
    ]);

    expect(summary).toMatchObject({
      totalGames: 2,
      passedGames: 1,
      failedGames: 1,
      failedGameIds: [2025020419],
    });

    const mirroredSummary = summarizeNormalizedEventValidationResults(
      summary.results
    );
    expect(mirroredSummary).toMatchObject({
      totalGames: 2,
      passedGames: 1,
      failedGames: 1,
      failedGameIds: [2025020419],
    });
  });

  it("fails exact parity metrics and warns on approximate parity drift", () => {
    const result = compareLegacyAndNhlParitySample({
      family: "nst_gamelog_as_counts",
      entityType: "skater",
      entityId: 91,
      sampleKey: "2026-03-30",
      legacyRow: {
        player_id: 91,
        season: 20252026,
        date_scraped: "2026-03-30",
        goals: 1,
        shots: 3,
        ixg: 0.44,
        rush_attempts: 2,
      },
      newRow: {
        player_id: 91,
        season: 20252026,
        date_scraped: "2026-03-30",
        goals: 2,
        shots: 3,
        ixg: 0.57,
        rush_attempts: 4,
      },
    });

    expect(result.sampleKey).toBe("nst_gamelog_as_counts:skater:91:2026-03-30");
    expect(result.comparedMetrics).toEqual(["goals", "ixg", "rush_attempts", "shots"]);
    expect(result.passed).toBe(false);
    expect(result.hasWarnings).toBe(true);
    expect(result.mismatches).toEqual([
      {
        metric: "goals",
        classification: "exact",
        severity: "error",
        legacyValue: 1,
        newValue: 2,
        absDiff: 1,
        tolerance: 0.000001,
        reason: "value-drift",
      },
      {
        metric: "rush_attempts",
        classification: "close approximation",
        severity: "warning",
        legacyValue: 2,
        newValue: 4,
        absDiff: 2,
        tolerance: 1,
        reason: "value-drift",
      },
    ]);
  });

  it("flags missing parity metrics as errors and summarizes mixed sample results", () => {
    const passed = compareLegacyAndNhlParitySample({
      family: "nst_gamelog_goalie_all_counts",
      entityType: "goalie",
      entityId: 31,
      sampleKey: "2026-03-30",
      legacyRow: {
        player_id: 31,
        season: 20252026,
        date_scraped: "2026-03-30",
        shots_against: 28,
        saves: 26,
        goals_against: 2,
      },
      newRow: {
        player_id: 31,
        season: 20252026,
        date_scraped: "2026-03-30",
        shots_against: 28,
        saves: 26,
        goals_against: 2,
      },
    });

    const failed = compareLegacyAndNhlParitySample({
      family: "nst_gamelog_as_rates_oi",
      entityType: "skater",
      entityId: 91,
      sampleKey: "2026-03-30",
      legacyRow: {
        player_id: 91,
        season: 20252026,
        date_scraped: "2026-03-30",
        cf_per_60: 61.2,
        xgf_per_60: 2.1,
      },
      newRow: {
        player_id: 91,
        season: 20252026,
        date_scraped: "2026-03-30",
        xgf_per_60: 2.35,
      },
    });

    expect(passed.passed).toBe(true);
    expect(passed.hasWarnings).toBe(false);
    expect(failed.passed).toBe(false);
    expect(failed.hasWarnings).toBe(false);
    expect(failed.mismatches).toEqual([
      {
        metric: "cf_per_60",
        classification: "exact",
        severity: "error",
        legacyValue: 61.2,
        newValue: null,
        absDiff: null,
        tolerance: null,
        reason: "missing-in-new",
      },
    ]);

    const summary = compareLegacyAndNhlParitySamples([
      {
        family: passed.family,
        entityType: passed.entityType,
        entityId: passed.entityId,
        sampleKey: "2026-03-30",
        legacyRow: {
          player_id: 31,
          season: 20252026,
          date_scraped: "2026-03-30",
          shots_against: 28,
          saves: 26,
          goals_against: 2,
        },
        newRow: {
          player_id: 31,
          season: 20252026,
          date_scraped: "2026-03-30",
          shots_against: 28,
          saves: 26,
          goals_against: 2,
        },
      },
      {
        family: failed.family,
        entityType: failed.entityType,
        entityId: failed.entityId,
        sampleKey: "2026-03-30",
        legacyRow: {
          player_id: 91,
          season: 20252026,
          date_scraped: "2026-03-30",
          cf_per_60: 61.2,
          xgf_per_60: 2.1,
        },
        newRow: {
          player_id: 91,
          season: 20252026,
          date_scraped: "2026-03-30",
          xgf_per_60: 2.35,
        },
      },
    ]);

    expect(summary).toMatchObject({
      totalSamples: 2,
      passedSamples: 1,
      failedSamples: 1,
      warningSamples: 0,
      failedSampleKeys: ["nst_gamelog_as_rates_oi:skater:91:2026-03-30"],
    });

    const mirrored = summarizeParitySampleComparisons(summary.results);
    expect(mirrored).toMatchObject({
      totalSamples: 2,
      passedSamples: 1,
      failedSamples: 1,
      warningSamples: 0,
      failedSampleKeys: ["nst_gamelog_as_rates_oi:skater:91:2026-03-30"],
    });
  });
});
