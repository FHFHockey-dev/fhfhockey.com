import { describe, expect, it } from "vitest";

import {
  GAME_FINALITY_CONTRACT_VERSION,
  normalizeNhlGameScheduleState,
  normalizeNhlGameState,
  resolveGameFinality,
} from "./gameFinality";

// A 22:00 ET game on ET date 2026-04-02 starts at 02:00 UTC on 2026-04-03.
const lateStart = "2026-04-03T02:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("resolveGameFinality (contract nhl-game-state-v1)", () => {
  it("names its contract version", () => {
    expect(GAME_FINALITY_CONTRACT_VERSION).toBe("nhl-game-state-v1");
  });

  it("treats a stored FINAL or OFF state as final, even within 8 h of the start", () => {
    for (const state of ["FINAL", "OFF"]) {
      expect(
        resolveGameFinality(
          { startTime: lateStart, game_state: state, game_schedule_state: "OK",
            game_state_observed_at: "2026-04-03T04:40:00.000Z" },
          at("2026-04-03T04:45:00.000Z")
        )
      ).toEqual({ isFinal: true, basis: "game_state", reason: "final_state" });
    }
  });

  it("keeps a live game unfinished mid-game (the stored state wins over the UTC date)", () => {
    expect(
      resolveGameFinality(
        { startTime: lateStart, game_state: "LIVE", game_schedule_state: "OK",
          game_state_observed_at: "2026-04-03T03:00:00.000Z" },
        at("2026-04-03T03:30:00.000Z")
      )
    ).toEqual({ isFinal: false, basis: "game_state", reason: "non_final_state" });
  });

  it("never treats a postponed, suspended or cancelled game as final", () => {
    for (const scheduleState of ["PPD", "SUSP", "CNCL"]) {
      expect(
        resolveGameFinality(
          { startTime: lateStart, game_state: "OFF", game_schedule_state: scheduleState,
            game_state_observed_at: "2026-04-04T03:00:00.000Z" },
          at("2026-04-05T00:00:00.000Z")
        )
      ).toEqual({ isFinal: false, basis: "game_state", reason: "not_played_schedule_state" });
    }
  });

  it("trusts a non-final state observed after start + 8 h", () => {
    expect(
      resolveGameFinality(
        { startTime: lateStart, game_state: "CRIT", game_schedule_state: "OK",
          game_state_observed_at: "2026-04-03T10:30:00.000Z" },
        at("2026-04-03T12:00:00.000Z")
      )
    ).toEqual({ isFinal: false, basis: "game_state", reason: "non_final_state" });
  });

  it("labels a stale non-final state as the heuristic fallback once start + 8 h has passed", () => {
    const stale = { startTime: lateStart, game_state: "PRE", game_schedule_state: "OK",
      game_state_observed_at: "2026-04-03T01:50:00.000Z" };
    expect(resolveGameFinality(stale, at("2026-04-03T09:59:59.000Z"))).toEqual({
      isFinal: false, basis: "game_state", reason: "non_final_state",
    });
    expect(resolveGameFinality(stale, at("2026-04-03T10:00:00.000Z"))).toEqual({
      isFinal: true, basis: "schedule_heuristic_fallback", reason: "stale_non_final_state",
    });
  });

  it("falls back, labelled, to start + 8 h when no state is stored (no UTC-date shortcut)", () => {
    const unknown = { startTime: lateStart, game_state: null, game_schedule_state: null,
      game_state_observed_at: null };
    // 00:30 UTC on 2026-04-03 is a later UTC date than the game's ET date, before puck drop.
    expect(resolveGameFinality(unknown, at("2026-04-03T00:30:00.000Z"))).toEqual({
      isFinal: false, basis: "schedule_heuristic_fallback", reason: "state_unknown",
    });
    expect(resolveGameFinality(unknown, at("2026-04-03T10:00:00.000Z"))).toEqual({
      isFinal: true, basis: "schedule_heuristic_fallback", reason: "state_unknown",
    });
    expect(resolveGameFinality({ startTime: null }, at("2030-01-01T00:00:00.000Z")).isFinal).toBe(false);
  });

  it("treats a state without an observation time, or an unknown NHL value, as unknown", () => {
    expect(resolveGameFinality({ startTime: lateStart, game_state: "FINAL" },
      at("2026-04-03T04:00:00.000Z"))).toMatchObject({ isFinal: false, reason: "state_unknown" });
    expect(resolveGameFinality({ startTime: lateStart, game_state: "FINAL_OT",
      game_state_observed_at: "2026-04-03T04:00:00.000Z" },
      at("2026-04-03T04:05:00.000Z"))).toMatchObject({ isFinal: false, reason: "state_unknown" });
  });

  it("reads Date objects from direct pg reads", () => {
    expect(resolveGameFinality(
      { startTime: new Date(lateStart) as unknown as string, game_state: "OFF",
        game_state_observed_at: new Date("2026-04-03T05:00:00.000Z") as unknown as string },
      at("2026-04-03T05:01:00.000Z")
    )).toMatchObject({ isFinal: true, basis: "game_state" });
  });

  it("normalizes only the known NHL vocabularies", () => {
    expect(normalizeNhlGameState("OFF")).toBe("OFF");
    expect(normalizeNhlGameState("off")).toBeNull();
    expect(normalizeNhlGameState(7)).toBeNull();
    expect(normalizeNhlGameScheduleState("PPD")).toBe("PPD");
    expect(normalizeNhlGameScheduleState("POSTPONED")).toBeNull();
  });
});
