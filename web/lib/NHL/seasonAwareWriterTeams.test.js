import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import writerTeamAuthority from "./seasonAwareWriterTeams.cjs";

const { createSeasonAwareWriterTeams } = writerTeamAuthority;

const wgoSource = readFileSync(
  resolve(process.cwd(), "lib/supabase/Upserts/fetchWGOdata.js"),
  "utf8",
);
const powerSource = readFileSync(
  resolve(process.cwd(), "lib/supabase/Upserts/fetchPowerRankings.js"),
  "utf8",
);

function expectCompleteUniqueCatalog(teams) {
  const teamRows = Object.values(teams);

  expect(Object.keys(teams)).toHaveLength(32);
  expect(new Set(teamRows.map((team) => team.id)).size).toBe(32);
  expect(new Set(teamRows.map((team) => team.franchiseId)).size).toBe(32);
  expect(teams.BOS).toEqual({
    name: "Boston Bruins",
    franchiseId: 6,
    id: 6,
  });
}

describe("createSeasonAwareWriterTeams", () => {
  it.each([20232024, "20232024"])(
    "uses historical Arizona identity for 2023-24 input %s",
    (seasonId) => {
      const teams = createSeasonAwareWriterTeams(seasonId);

      expect(teams.ARI).toEqual({
        name: "Arizona Coyotes",
        franchiseId: 28,
        id: 53,
      });
      expect(teams).not.toHaveProperty("UTA");
      expectCompleteUniqueCatalog(teams);
    },
  );

  it.each([20242025, "20242025"])(
    "uses inaugural Utah identity for 2024-25 input %s",
    (seasonId) => {
      const teams = createSeasonAwareWriterTeams(seasonId);

      expect(teams.UTA).toEqual({
        name: "Utah Hockey Club",
        franchiseId: 40,
        id: 59,
      });
      expect(teams).not.toHaveProperty("ARI");
      expectCompleteUniqueCatalog(teams);
    },
  );

  it.each([20252026, "20252026", 20262027])(
    "uses current Utah identity for 2025-26+ input %s",
    (seasonId) => {
      const teams = createSeasonAwareWriterTeams(seasonId);

      expect(teams.UTA).toEqual({
        name: "Utah Mammoth",
        franchiseId: 40,
        id: 68,
      });
      expect(teams).not.toHaveProperty("ARI");
      expectCompleteUniqueCatalog(teams);
    },
  );

  it.each([
    undefined,
    null,
    "",
    " 20252026",
    "20252026 ",
    "2024202",
    "202420250",
    "20242026",
    "00010002",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2024202,
    202420250,
    20242026,
    Number.MAX_SAFE_INTEGER + 1,
    {},
    [],
    20252026n,
  ])("rejects invalid season identity %s", (seasonId) => {
    expect(() => createSeasonAwareWriterTeams(seasonId)).toThrow(
      /seasonId must/,
    );
  });

  it("returns fresh immutable catalogs and team rows", () => {
    const first = createSeasonAwareWriterTeams(20252026);
    const second = createSeasonAwareWriterTeams(20252026);

    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.values(first).every(Object.isFrozen)).toBe(true);
    expect(first).not.toBe(second);
    expect(first.BOS).not.toBe(second.BOS);
    expect(first.UTA).not.toBe(second.UTA);
    expect(Reflect.set(first.UTA, "name", "Changed")).toBe(false);
    expect(Reflect.deleteProperty(first, "UTA")).toBe(false);
    expect(second.UTA).toEqual({
      name: "Utah Mammoth",
      franchiseId: 40,
      id: 68,
    });
  });
});

describe("season-aware writer consumers", () => {
  it("resolves WGO identity per processed season before source work", () => {
    const functionStart = wgoSource.indexOf("async function fetchNHLData");
    const authorityUse = wgoSource.indexOf(
      "createSeasonAwareWriterTeams(seasonId)",
      functionStart,
    );
    const firstDatabaseRead = wgoSource.indexOf(
      '.from("wgo_team_stats")',
      functionStart,
    );

    expect(functionStart).toBeGreaterThan(-1);
    expect(authorityUse).toBeGreaterThan(functionStart);
    expect(firstDatabaseRead).toBeGreaterThan(authorityUse);
    expect(wgoSource).not.toMatch(/const teamsInfo = \{/);
  });

  it("resolves the quarantined power loader from its selected season", () => {
    const seasonResolution = powerSource.indexOf(
      "createSeasonAwareWriterTeams(currentSeason.id)",
    );
    const firstWriterCall = powerSource.indexOf(
      "fetchDailyStandingsDelta(currentSeason, teamsInfo)",
    );

    expect(seasonResolution).toBeGreaterThan(-1);
    expect(firstWriterCall).toBeGreaterThan(seasonResolution);
    expect(powerSource).not.toMatch(/const teamsInfo = \{/);
  });
});
