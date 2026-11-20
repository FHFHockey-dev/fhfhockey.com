import { HTMLElement, parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import { createSharedReadCache } from "lib/NHL/client/sharedRead";
import type { LineGame, OfficialPowerPlayObservation } from "./types";

type Spot = {
  teamId: number;
  sweaterNumber: number;
  playerId: number;
  positionCode: string;
  firstName: { default: string };
  lastName: { default: string };
};
type Play = {
  eventId: number;
  periodDescriptor: { number: number };
  timeInPeriod: string;
  typeDescKey: string;
  situationCode: string;
  sortOrder: number;
};
type PlayByPlay = {
  id: number;
  gameDate: string;
  homeTeam: { id: number };
  awayTeam: { id: number };
  plays: Play[];
  rosterSpots: Spot[];
};
const eventTypes: Record<string, string> = {
  FAC: "faceoff",
  GOAL: "goal",
  SHOT: "shot-on-goal",
  MISS: "missed-shot",
  BLOCK: "blocked-shot",
  GIVE: "giveaway",
  TAKE: "takeaway",
  HIT: "hit",
  PENL: "penalty",
  STOP: "stoppage",
  PEND: "period-end",
};
const normalized = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
const eventsCache = createSharedReadCache<OfficialPowerPlayObservation[] | null>(60_000, 64);

function onIce(cell: HTMLElement, teamId: number, roster: Spot[], skaterCount: number) {
  const players: { playerId: number; name: string }[] = [];
  const seen = new Set<number>();
  let goalies = 0;
  for (const label of cell.querySelectorAll("font[title]")) {
    const number = Number(label.text.trim());
    const spots = roster.filter((spot) => spot.teamId === teamId && spot.sweaterNumber === number);
    const spot = spots[0];
    if (spots.length !== 1 || !spot || !Number.isSafeInteger(spot.playerId) || spot.playerId <= 0 || seen.has(spot.playerId))
      return null;
    const name = [spot.firstName?.default, spot.lastName?.default].filter(Boolean).join(" ");
    const title = label.getAttribute("title")?.match(/^(.+?) - (.+)$/);
    if (
      !["C", "L", "R", "D", "G"].includes(spot.positionCode) ||
      !name ||
      !title ||
      normalized(title[2]!) !== normalized(name) ||
      (title[1] === "Goalie") !== (spot.positionCode === "G")
    )
      return null;
    seen.add(spot.playerId);
    if (spot.positionCode === "G") goalies++;
    else players.push({ playerId: spot.playerId, name });
  }
  return goalies === 1 && players.length === skaterCount ? players : null;
}

/** The HTML report supplies on-ice personnel; Gamecenter supplies team-scoped roster IDs, strength and event order. */
export function officialPowerPlayEvents(
  game: LineGame,
  pbp: PlayByPlay,
  html: string,
  sourceUrl: string,
): OfficialPowerPlayObservation[] | null {
  if (
    pbp?.id !== game.id ||
    pbp.gameDate !== game.date ||
    pbp.homeTeam?.id !== game.homeTeamId ||
    pbp.awayTeam?.id !== game.awayTeamId ||
    !Array.isArray(pbp.plays) ||
    !Array.isArray(pbp.rosterSpots)
  )
    return null;
  const report = parse(html);
  const header = report.querySelectorAll("#GameInfo td").map((cell) => cell.text.trim());
  const date = new Date(game.date + "T12:00:00Z").toLocaleDateString("en-US", { dateStyle: "full", timeZone: "UTC" });
  if (!header.includes("Play By Play") || !header.includes("Game " + String(game.id).slice(-4)) || !header.includes(date))
    return null;
  const byClock = new Map<string, Play | null>();
  for (const play of pbp.plays) {
    const key = [play.periodDescriptor?.number, play.timeInPeriod, play.typeDescKey].join("/");
    byClock.set(key, byClock.has(key) ? null : play);
  }
  const matched = new Map<number, OfficialPowerPlayObservation>();
  const seen = new Set<number>();
  for (const row of report.querySelectorAll("tr[id^=PL-]")) {
    const cells = row.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "TD");
    if (cells.length !== 8) continue;
    const reportEvent = Number(cells[0]!.text.trim());
    if (!Number.isSafeInteger(reportEvent) || reportEvent <= 0 || row.id !== "PL-" + reportEvent) continue;
    const period = Number(cells[1]!.text.trim());
    const elapsed = cells[3]!.firstChild?.text.trim().padStart(5, "0");
    if (!elapsed || !/^\d\d:[0-5]\d$/.test(elapsed)) continue;
    const play = byClock.get([period, elapsed, eventTypes[cells[4]!.text.trim()]].join("/"));
    if (!play || !Number.isSafeInteger(play.eventId) || !/^1(?:5[34]|[34]5)1$/.test(play.situationCode)) continue;
    // Without a unique clock/type pair in both reports, the on-ice cells cannot be attributed to an event.
    if (seen.has(play.eventId)) {
      matched.delete(play.eventId);
      continue;
    }
    seen.add(play.eventId);
    const away = onIce(cells[6]!, game.awayTeamId, pbp.rosterSpots, Number(play.situationCode[1]));
    const home = onIce(cells[7]!, game.homeTeamId, pbp.rosterSpots, Number(play.situationCode[2]));
    if (!away || !home) continue;
    const awayPowerPlay = away.length === 5;
    matched.set(play.eventId, {
      gameId: game.id,
      teamId: awayPowerPlay ? game.awayTeamId : game.homeTeamId,
      eventId: play.eventId,
      reportEvent,
      order: play.sortOrder,
      period,
      elapsed,
      players: awayPowerPlay ? away : home,
      sourceUrl: sourceUrl + "#PL-" + reportEvent,
    });
  }
  return [...matched.values()].sort((a, b) => b.order - a.order);
}

export function readOfficialPowerPlay(game: LineGame) {
  const id = String(game.id);
  const season = id.slice(0, 4);
  const sourceUrl = `https://www.nhl.com/scores/htmlreports/${season}${Number(season) + 1}/PL${id.slice(4)}.HTM`;
  return eventsCache.read(game.scheduleIdentity + ":" + game.phase, async () => {
    try {
      const signal = AbortSignal.timeout(5000);
      const [pbp, html] = await Promise.all([
        get<PlayByPlay>(`/gamecenter/${game.id}/play-by-play`, false, signal),
        fetch(sourceUrl, { signal }).then((response) => {
          if (!response.ok) throw new Error("NHL on-ice report unavailable");
          return response.text();
        }),
      ]);
      return officialPowerPlayEvents(game, pbp, html, sourceUrl);
    } catch {
      return null;
    }
  });
}
