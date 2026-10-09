import { describe, expect, it } from "vitest";
import { bindLineGame, sourceLocalDate } from "./binding";
import { adaptNhlGameState, chooseDefaultGame, stateAtRead } from "./gameState";
import { fixtureGame, fixtureNext, fixtureNow } from "./testFixtures";
import { instant } from "./types";

describe("game/time binding", () => {
  it("explicit references require team participation and matching opponent", () => {
    expect(bindLineGame({ teamId: 14, gameId: fixtureGame.id }, [fixtureGame]).status).toBe("bound");
    expect(bindLineGame({ teamId: 99, gameId: fixtureGame.id }, [fixtureGame]).status).toBe("unresolved");
    expect(bindLineGame({ teamId: 14, gameId: fixtureGame.id, opponentId: 99 }, [fixtureGame]).status).toBe("unresolved");
  });
  it("calendar recency and a processing date alone cannot bind a report", () => {
    expect(bindLineGame({ teamId: 14, date: fixtureGame.date }, [fixtureGame]).status).toBe("unresolved");
  });
  it("supports midnight and DST through the source timezone", () => {
    expect(sourceLocalDate("2026-10-02T01:00:00Z", "America/New_York")).toBe("2026-10-01");
    expect(sourceLocalDate("2026-11-01T05:30:00Z", "America/New_York")).toBe("2026-11-01");
    expect(sourceLocalDate("2026-11-01T06:30:00Z", "America/New_York")).toBe("2026-11-01");
    const yesterday = bindLineGame({ teamId: 14, relative: "yesterday", originalPublishedAt: "2026-10-02T13:00:00Z", timezone: "America/New_York" }, [fixtureGame]);
    expect(yesterday.gameId).toBe(fixtureGame.id);
    expect(bindLineGame({ teamId: 14, relative: "tomorrow", originalPublishedAt: "2026-10-02T13:00:00Z", timezone: "America/New_York" }, [fixtureNext]).gameId).toBe(fixtureNext.id);
  });
  it("missing offsets, unknown timezone and unresolved quote timing remain reviewable", () => {
    expect(instant("2026-10-01T18:34:00")).toBeNull();
    expect(bindLineGame({ teamId: 14, relative: "tonight", originalPublishedAt: fixtureNow }, [fixtureGame]).status).toBe("unresolved");
    expect(bindLineGame({ teamId: 14, gameId: fixtureGame.id, quotedTimeUnresolved: true }, [fixtureGame]).status).toBe("unresolved");
  });
  it("multiple games and contradictory dates require review", () => {
    expect(bindLineGame({ teamId: 14, date: fixtureGame.date, opponentId: 3 }, [fixtureGame, { ...fixtureGame, id: 22 }]).status).toBe("ambiguous");
    expect(bindLineGame({ teamId: 14, relative: "tomorrow", date: fixtureGame.date, originalPublishedAt: fixtureNow, timezone: "America/New_York" }, [fixtureGame]).status).toBe("ambiguous");
  });
});
describe("observed game state", () => {
  const payload = { id: fixtureGame.id, homeTeam: { id: 3 }, awayTeam: { id: 14 }, gameState: "LIVE", gameScheduleState: "OK", startTimeUTC: fixtureGame.scheduledStart };
  it("does not relabel scheduled start as puck drop", () => {
    const state = adaptNhlGameState(fixtureGame, payload, fixtureNow);
    expect(state.phase).toBe("live"); expect(state.actualStart).toBeNull();
  });
  it("live takes precedence over the next game; stale live never does", () => {
    expect(chooseDefaultGame([fixtureNext, fixtureGame], fixtureNow)?.id).toBe(fixtureGame.id);
    expect(chooseDefaultGame([{ ...fixtureGame, observedAt: "2026-10-01T23:00:00Z" }, fixtureNext], fixtureNow)?.id).toBe(fixtureNext.id);
    expect(stateAtRead({ ...fixtureGame, observedAt: null }, fixtureNow).phase).toBe("unknown");
  });
  it("postponement and reschedule change identity without manufacturing game phase", () => {
    const postponed = adaptNhlGameState(fixtureGame, { ...payload, gameScheduleState: "PPD" }, fixtureNow);
    expect(postponed.phase).toBe("postponed"); expect(postponed.scheduleIdentity).not.toBe(fixtureGame.scheduleIdentity);
    const rescheduled = adaptNhlGameState(fixtureGame, { ...payload, startTimeUTC: fixtureNext.scheduledStart, gameState: "FUT" }, fixtureNow);
    expect(rescheduled.phase).toBe("scheduled"); expect(rescheduled.scheduleIdentity).not.toBe(postponed.scheduleIdentity);
    expect(adaptNhlGameState(fixtureGame, { ...payload, id: 999 }, fixtureNow).phase).toBe("unknown");
  });
});
