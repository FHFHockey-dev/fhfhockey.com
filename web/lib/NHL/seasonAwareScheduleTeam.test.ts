import { describe, expect, it } from "vitest";

import {
  resolveCanonicalTeamIdentityForSource,
  resolveProjectionTeamIdentity,
  resolveScheduleGameTeamIdentity,
  resolveScheduleTeamSelection,
  validateProjectionTeamIdentity,
  validateProjectionTeamIdentityForSeason,
} from "./seasonAwareScheduleTeam";

describe("season-aware schedule team identity", () => {
  it.each([
    [20232024, 53, "ARI", "Arizona Coyotes"],
    [20242025, 59, "UTA", "Utah Hockey Club"],
    [20252026, 68, "UTA", "Utah Mammoth"],
  ])(
    "resolves canonical UTA/68 for season %i to source %i/%s",
    (seasonId, id, abbreviation, name) => {
      expect(resolveScheduleTeamSelection("UTA", 68, seasonId)).toEqual({
        source: { id, abbreviation, name },
      });
      expect(resolveScheduleGameTeamIdentity(id, seasonId)).toEqual({
        id,
        abbreviation,
        name,
      });
    },
  );

  it("preserves ordinary current-team identity", () => {
    expect(resolveScheduleTeamSelection("EDM", 22, 20242025)).toEqual({
      source: {
        id: 22,
        abbreviation: "EDM",
        name: "Edmonton Oilers",
      },
    });
    expect(resolveScheduleGameTeamIdentity(22, 20242025)).toEqual({
      id: 22,
      abbreviation: "EDM",
      name: "Edmonton Oilers",
    });
  });

  it.each([
    ["UTA", 53, 20232024],
    ["UTA", 59, 20242025],
    ["ARI", 53, 20232024],
    ["EDM", 6, 20242025],
  ])("rejects noncanonical caller pair %s/%i", (abbreviation, id, seasonId) => {
    expect(resolveScheduleTeamSelection(abbreviation, id, seasonId)).toBeNull();
  });

  it.each([
    [53, 20242025],
    [53, 20252026],
    [59, 20232024],
    [59, 20252026],
    [68, 20232024],
    [68, 20242025],
  ])("rejects Utah-lineage source %i outside season %i", (id, seasonId) => {
    expect(resolveScheduleGameTeamIdentity(id, seasonId)).toBeNull();
  });

  it.each([
    Number.NaN,
    20242025.5,
    Number.MAX_SAFE_INTEGER + 1,
    0,
    2024,
    20242026,
  ])("fails closed for invalid season %s", (seasonId) => {
    expect(resolveScheduleTeamSelection("EDM", 22, seasonId)).toBeNull();
    expect(resolveScheduleTeamSelection("UTA", 68, seasonId)).toBeNull();
    expect(resolveScheduleGameTeamIdentity(22, seasonId)).toBeNull();
  });

  it.each([
    [20232024, 53, "ARI", "Arizona Coyotes"],
    [20242025, 59, "UTA", "Utah Hockey Club"],
    [20252026, 68, "UTA", "Utah Mammoth"],
  ])(
    "preserves the %i persisted source while mapping to canonical UTA/68",
    (seasonId, id, abbreviation, name) => {
      expect(
        resolveProjectionTeamIdentity(id, { id, abbreviation, name }, seasonId),
      ).toEqual({
        source: { id, abbreviation, name },
        canonical: {
          id: 68,
          abbreviation: "UTA",
          name: "Utah Mammoth",
        },
      });
    },
  );

  it("validates ordinary persisted projection identity", () => {
    expect(
      resolveProjectionTeamIdentity(
        22,
        { id: 22, abbreviation: "EDM", name: "Edmonton Oilers" },
        20242025,
      ),
    ).toEqual({
      source: {
        id: 22,
        abbreviation: "EDM",
        name: "Edmonton Oilers",
      },
      canonical: {
        id: 22,
        abbreviation: "EDM",
        name: "Edmonton Oilers",
      },
    });
  });

  it.each([
    [53, { id: 53, abbreviation: "UTA", name: "Arizona Coyotes" }, 20232024],
    [53, { id: 59, abbreviation: "ARI", name: "Arizona Coyotes" }, 20232024],
    [53, { id: 53, abbreviation: "ARI", name: "Utah Hockey Club" }, 20232024],
    [53, { id: 53, abbreviation: "ARI", name: "Arizona Coyotes" }, 20242025],
    [999, { id: 999, abbreviation: "XXX", name: "Unknown" }, 20252026],
    [null, { id: 53, abbreviation: "ARI", name: "Arizona Coyotes" }, 20232024],
    [53, null, 20232024],
  ])(
    "fails closed for invalid persisted projection identity %#",
    (id, team, seasonId) => {
      expect(resolveProjectionTeamIdentity(id, team, seasonId)).toBeNull();
    },
  );

  it("rejects a historical Utah source paired with another valid canonical team", () => {
    expect(
      validateProjectionTeamIdentity({
        source: {
          id: 53,
          abbreviation: "ARI",
          name: "Arizona Coyotes",
        },
        canonical: {
          id: 1,
          abbreviation: "NJD",
          name: "New Jersey Devils",
        },
      }),
    ).toBeNull();
  });

  it("resolves canonical lineage from a source identity without a joined row", () => {
    expect(
      resolveCanonicalTeamIdentityForSource({
        id: 53,
        abbreviation: "ARI",
        name: "Arizona Coyotes",
      }),
    ).toEqual({
      id: 68,
      abbreviation: "UTA",
      name: "Utah Mammoth",
    });
  });

  it("validates a projection source only for its exact persisted season", () => {
    const identity = {
      source: {
        id: 53,
        abbreviation: "ARI",
        name: "Arizona Coyotes",
      },
      canonical: {
        id: 68,
        abbreviation: "UTA",
        name: "Utah Mammoth",
      },
    };

    expect(validateProjectionTeamIdentityForSeason(identity, 20232024)).toEqual(
      identity,
    );
    expect(
      validateProjectionTeamIdentityForSeason(identity, 20242025),
    ).toBeNull();
  });
});
