import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { buildPlayerValues } from "lib/draftDashboard/playerValues";
import type {
  DraftSettings,
  TeamDraftStats,
  DraftedPlayer,
} from "components/DraftDashboard/DraftDashboard";
import type { MockLeague, MockPlayer, MockSession } from "./contracts";
import { allocate, roster, slots } from "./engine";

export function freezePlayers(
  players: ProcessedPlayer[],
  league: MockLeague,
  prorate84 = false,
): MockPlayer[] {
  const draftSettings = {
    teamCount: league.teamCount,
    rosterConfig: league.roster,
  };
  const { values, eligibility } = buildPlayerValues({
    players,
    draftSettings,
    leagueType: league.leagueType,
    categoryWeights: league.scoring,
    forwardGrouping: league.grouping,
    prorate84,
    fantasyPointSettings: league.scoring,
  });
  const categories =
    league.leagueType === "categories"
      ? Object.fromEntries(
          Object.entries(league.scoring)
            .filter(([, w]) => w !== 0)
            .map(([k, w]) => [
              k,
              buildPlayerValues({
                players,
                draftSettings,
                leagueType: "categories",
                categoryWeights: { [k]: w },
                forwardGrouping: league.grouping,
              }).values,
            ]),
        )
      : {};
  return players
    .filter((p) => (eligibility.get(String(p.playerId))?.length ?? 0) > 0)
    .map((p) => {
      const positions = eligibility.get(String(p.playerId)) ?? [];
      const start = ["GAMES_STARTED", "STARTS_GOALIE", "GAMES_STARTED_GOALIE"]
        .map((k) => p.combinedStats[k]?.projected)
        .find((v) => typeof v === "number" && Number.isFinite(v));
      const games = ["GAMES_GOALIE", "GAMES_PLAYED_GOALIE", "GP_GOALIE"]
        .map((k) => p.combinedStats[k]?.projected)
        .find((v) => typeof v === "number" && Number.isFinite(v));
      return {
        id: String(p.playerId),
        canonicalId: p.fhfhPlayerId,
        name: p.fullName,
        team: p.displayTeam ?? "",
        positions,
        value: values.get(String(p.playerId)) ?? 0,
        adp: p.yahooAvgPick && p.yahooAvgPick > 0 ? p.yahooAvgPick : null,
        categories: Object.fromEntries(
          Object.entries(categories).map(([k, v]) => [
            k,
            v.get(String(p.playerId)) ?? 0,
          ]),
        ),
        workload: positions.includes("G") ? (start ?? games ?? null) : null,
        workloadKind: positions.includes("G")
          ? start != null
            ? "starts"
            : games != null
              ? "games"
              : null
          : null,
      };
    });
}
export function dashboardView(session: MockSession) {
  const c = session.config;
  const draftSettings: DraftSettings = {
    teamCount: c.teamCount,
    scoringCategories: c.scoring,
    categoryWeights: c.scoring,
    leagueType: c.leagueType,
    rosterConfig: {
      ...c.roster,
      bench: c.roster.bench ?? 0,
      utility: c.roster.utility ?? 0,
    },
    draftOrder: Array.from({ length: c.teamCount }, (_, i) => String(i)),
    draftOrderMode: "snake",
    isKeeper: false,
  };
  const draftedPlayers: DraftedPlayer[] = session.picks.map((p) => ({
    playerId: p.playerId,
    teamId: String(p.seat),
    pickNumber: p.pick,
    round: Math.ceil(p.pick / c.teamCount),
    pickInRound: ((p.pick - 1) % c.teamCount) + 1,
  }));
  const allPlayers: ProcessedPlayer[] = session.players.map((p) => ({
    playerId: Number(p.id),
    fullName: p.name,
    displayPosition: p.positions.join(","),
    displayTeam: p.team,
    eligiblePositions: p.positions,
    combinedStats: {},
    fantasyPoints: {
      projected: p.value,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null,
    },
    yahooAvgPick: p.adp,
  }));
  const teamStats: TeamDraftStats[] = draftSettings.draftOrder.map(
    (teamId, seat) => {
      const players = roster(session, seat),
        slotList = slots(c),
        assigned = allocate(players, slotList);
      const rosterSlots: TeamDraftStats["rosterSlots"] = {},
        bench: DraftedPlayer[] = [];
      assigned.forEach((index, slot) => {
        const pick = draftedPlayers.find(
          (p) => p.playerId === players[index].id,
        )!;
        const key = slotList[slot];
        if (key === "bench") bench.push(pick);
        else
          (rosterSlots[key === "utility" ? "UTILITY" : key] ??= []).push(pick);
      });
      return {
        teamId,
        teamName:
          seat === c.userSeat
            ? "Your team"
            : `GM ${seat + 1} · ${c.bots[seat].personality}`,
        owner: "",
        projectedPoints: players.reduce((sum, p) => sum + p.value, 0),
        categoryTotals: {},
        rosterSlots,
        bench,
      };
    },
  );
  return { draftSettings, draftedPlayers, allPlayers, teamStats };
}
