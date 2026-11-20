import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GameLineSnapshots from "components/LineCombinations/GameLineSnapshots";
import { readGameLines } from "./service";
import { officialPowerPlayEvents } from "./officialPowerPlay";
import { persistLineReconciliation } from "./storage";
import { reconcileEntry } from "./reconcile";
import { lineTestDatabase } from "./testDatabase";
import { fixtureClaim, fixtureUnit } from "./testFixtures";
import type { LineGame } from "./types";
import type { TweetUnit } from "lib/sources/tweetInterpretation";
import receipt from "../../../tasks/artifacts/same-day-news-lines-2026-11-18/OTT-PHI-2026020348-LIVE-PP.json";
import raw from "./fixtures/ott-phi-2026020348.json";

const first = receipt.productionReads.ottgame,
  second = receipt.productionReads.ottrefresh;
const game: LineGame = {
  id: receipt.gameId,
  date: raw.pbp.gameDate,
  homeTeamId: 9,
  awayTeamId: 4,
  homeAbbreviation: "OTT",
  awayAbbreviation: "PHI",
  scheduledStart: first.scheduledStart,
  actualStart: null,
  observedAt: first.at,
  phase: "live",
  stateSource: "NHL",
  scheduleIdentity: receipt.gameId + ":" + first.scheduledStart + ":OK",
  replacesGameId: null,
};
const next = {
  ...game,
  id: 2026020366,
  date: "2026-11-21",
  phase: "scheduled" as const,
  awayTeamId: 26,
  awayAbbreviation: "LAK",
  scheduledStart: receipt.productionReads.ottnext.scheduledStart,
  scheduleIdentity: "next:OK",
};
const source = first.entryUnits[0]!.source;
const entryClaims = first.entryUnits.map((row, index) => {
  const unit = { ...fixtureUnit([], row.situation as TweetUnit["situation"], row.number), players: row.skaters };
  const claim = fixtureClaim(raw.pregame.claimIds[index]!, {
    captureId: raw.pregame.captureId,
    version: raw.pregame.version,
    teamId: 9,
    gameId: game.id,
    unit,
    originalIdentity: source,
    sourceUrl: source,
    author: "SunGarrioch",
    originalAuthor: "SunGarrioch",
    binding: { ...fixtureClaim().binding, scheduleIdentity: game.scheduleIdentity },
  });
  return {
    ...claim,
    time: {
      ...claim.time,
      originalPublishedAt: row.originalPublishedAt,
      effectiveAt: row.originalPublishedAt,
      ingestedAt: raw.pregame.ingestedAt,
      interpretedAt: raw.pregame.interpretedAt,
    },
  };
});
function database() {
  const expected = reconcileEntry({
    game: { ...game, phase: "pregame" },
    teamId: 9,
    claims: entryClaims,
    previous: null,
    now: first.at,
  });
  // Reconstruct the retained pregame facts with the actual stored revision identity.
  const stored = receipt.boundedStorage.initial.find((s) => s.team === 9)!.entry;
  Object.assign(expected, { id: stored.id, revision: stored.revision });
  return lineTestDatabase({
    games: [game, next].map((g) => ({
      ...g,
      startTime: g.scheduledStart,
      home: { abbreviation: g.homeAbbreviation },
      away: { abbreviation: g.awayAbbreviation },
    })),
    line_game_state_observations: [game, next].map((g) => ({ game_id: g.id, observed_at: g.observedAt, payload: g })),
    line_entry_revisions: [{ game_id: game.id, team_id: 9, revision: expected.revision, payload: expected }],
    line_claim_revisions: entryClaims.map((c) => ({
      team_id: 9,
      game_id: game.id,
      claim_id: c.id,
      interpreted_at: c.time.interpretedAt,
      payload: c,
    })),
  });
}
const html = raw.header + "<table>" + raw.rows.join("") + "</table>";
beforeEach(() => {
  for (const key of ["LINES_OBSERVATIONS_ENABLED", "LINES_ENTRY_SERVING_ENABLED", "LINES_PP_CARRY_FORWARD_ENABLED"])
    vi.stubEnv(key, "true");
  vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === receipt.officialSources.eventClockAndRosters) return Response.json(raw.pbp);
      if (url === receipt.officialSources.eventOnIce) return new Response(html);
      throw new Error("Unexpected request: " + url);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("serves all seven verified official PP events in the correct team's sidebar without assigning PP slots", async () => {
  const db = database();
  const result = await readGameLines(db, { gameId: game.id, now: first.at });
  render(<GameLineSnapshots data={result} />);
  for (const team of result.teams) {
    const rail = within(screen.getByRole("region", { name: team.abbreviation + " updates and sources" }));
    const events = receipt.verifiedOnIceEvents.filter((e) => e.teamId === team.teamId);
    expect(rail.getAllByText("Observed power play · unit not specified.")).toHaveLength(events.length);
    for (const event of events) {
      expect(team.officialPowerPlay?.find((e) => e.eventId === event.gamecenterEvent)?.players).toEqual(
        event.skaters.map((p) => ({ playerId: p.id, name: p.name })),
      );
      const link = rail.getByRole("link", { name: "NHL play-by-play · event " + event.htmlEvent });
      expect(link.getAttribute("href")).toBe(receipt.officialSources.eventOnIce + "#PL-" + event.htmlEvent);
      const item = within(link.closest("li")!);
      expect(item.getByText("Period 1 · " + event.timeElapsed + " elapsed")).toBeTruthy();
      expect(item.getByText(event.skaters.map((p) => p.name).join(" — "))).toBeTruthy();
    }
    expect(team.ppDefaults.map((p) => p.selection)).toEqual([null, null]);
  }
  const requests = vi.mocked(fetch).mock.calls.length;
  const following = await readGameLines(db, { teamId: 9, gameId: next.id, now: first.at });
  expect(fetch).toHaveBeenCalledTimes(requests);
  expect(following.teams[0]!.ppDefaults.map((p) => p.selection)).toEqual([null, null]);
  expect(following.teams[0]!.officialPowerPlay).toBeUndefined();
  expect(db.writes).toEqual([]);
});

it("serves Ottawa's retained pregame revision until a freeze is stored, then preserves the frozen entry across a later report", async () => {
  const db = database();
  const read = (now: string) => readGameLines(db, { teamId: 9, gameId: game.id, now });
  const initial = await read(first.at);
  db.tables.line_game_state_observations![0]!.payload.observedAt = second.at;
  const refreshed = await read(second.at);
  expect(initial.teams[0]!.entry).toEqual(refreshed.teams[0]!.entry);
  expect(initial.teams[0]!.entry).toMatchObject({
    id: receipt.boundedStorage.initial.find((s) => s.team === 9)!.entry.id,
    status: "expected",
    cutoff: null,
  });
  expect(initial.entryView.mode).toBe("unrecorded");
  const view = render(<GameLineSnapshots data={initial} />);
  expect(screen.getByRole("heading", { name: "OTT · Pregame reports" })).toBeTruthy();
  expect(screen.getByText("The original game-entry lineup was not recorded.")).toBeTruthy();
  expect(db.writes).toEqual([]);
  const writeFixture = (now: string) =>
    persistLineReconciliation(db, { game, teamId: 9, games: [game, next], now, carryForward: true });
  await writeFixture(first.at);
  const atFreeze = await read(second.at);
  const lateTime = {
    ...entryClaims[0]!.time,
    originalPublishedAt: second.at,
    effectiveAt: second.at,
    interpretedAt: second.at,
    ingestedAt: second.at,
  };
  const later = fixtureClaim("later", {
    ...entryClaims[0],
    id: "later",
    originalIdentity: "later",
    kind: "iga",
    phase: "in_game",
    time: lateTime,
    unit: fixtureUnit(["Other"]),
  });
  db.tables.line_claim_revisions!.push({
    game_id: game.id,
    team_id: 9,
    claim_id: later.id,
    interpreted_at: second.at,
    payload: later,
  });
  await writeFixture(second.at);
  const afterReport = await read(second.at);
  expect(afterReport.teams[0]!.observations.map((x) => x.id)).toContain(later.id);
  expect(afterReport.teams[0]!.entry).toEqual(atFreeze.teams[0]!.entry);
  expect(afterReport.teams[0]!.entry).toMatchObject({ cutoff: game.observedAt, status: "frozen" });
  expect(afterReport.teams[0]!.entry!.units.map((u) => u.claims[0]!.sourceUrl)).toEqual(Array(4).fill(source));
  view.rerender(<GameLineSnapshots data={afterReport} />);
  expect(screen.getByRole("heading", { name: "OTT · Lineup entering the game" })).toBeTruthy();
  expect(db.tables.line_entry_revisions).toHaveLength(2);
  expect(db.writes).toEqual(["append_line_decisions", "append_line_decisions"]);
});

it("abstains on ambiguous clocks, incomplete personnel, mismatched identity and even-strength events", () => {
  const row = raw.rows.find((row) => row.includes('id="PL-101"'))!;
  const sourceUrl = receipt.officialSources.eventOnIce;
  const parse = (pbp: typeof raw.pbp, rows: string) =>
    officialPowerPlayEvents(game, pbp, raw.header + "<table>" + rows + "</table>", sourceUrl);
  const play = raw.pbp.plays.find((p) => p.eventId === 422)!;
  expect(parse(raw.pbp, row)).toHaveLength(1);
  expect(parse(raw.pbp, row + row.replaceAll("101", "102"))).toEqual([]);
  expect(parse({ ...raw.pbp, plays: [play, { ...play, eventId: 999 }] }, row)).toEqual([]);
  expect(parse({ ...raw.pbp, plays: [{ ...play, situationCode: "1551" }] }, row)).toEqual([]);
  expect(parse(raw.pbp, row.replace(/<font title="Right Wing - TRAVIS KONECNY">11<\/font>/, ""))).toEqual([]);
  expect(parse(raw.pbp, row.replace("Right Wing - TRAVIS KONECNY", "Right Wing - WRONG PLAYER"))).toEqual([]);
  expect(parse({ ...raw.pbp, homeTeam: raw.pbp.awayTeam }, row)).toBeNull();
});

it("preserves pregame sources when the official report is unavailable and makes no official read when observations are off", async () => {
  const db = database();
  db.tables.line_game_state_observations![0]!.payload.scheduleIdentity += ":outage";
  vi.mocked(fetch).mockRejectedValue(new Error("fixture upstream timeout"));
  const result = await readGameLines(db, { teamId: 9, gameId: game.id, now: first.at });
  const team = result.teams[0]!;
  expect(team.officialPowerPlay).toBeNull();
  expect(team.entry!.units).toHaveLength(4);
  expect(team.ppDefaults.map((p) => p.selection)).toEqual([null, null]);
  render(<GameLineSnapshots data={result} />);
  expect(screen.getByText("NHL on-ice observations are unavailable.")).toBeTruthy();
  vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "false");
  vi.mocked(fetch).mockClear();
  const disabled = await readGameLines(db, { teamId: 9, gameId: game.id, now: first.at });
  expect(disabled.teams[0]!.officialPowerPlay).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
