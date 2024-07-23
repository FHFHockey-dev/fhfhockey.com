// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\supabaseShifts.js

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");

async function fetchAndUpsertTOIData(gameIds) {
  for (const gameId of gameIds) {
    const data = await fetchTOIDataForGame(gameId); // Use your existing function or API call
    await upsertTOIData(gameId, data);
  }
}

async function fetchTOIDataForGame(gameId) {
  const shiftDataUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;
  try {
    const [{ data: shiftsData }, { rostersMap, teams }, boxscore] =
      await Promise.all([
        fetch(shiftDataUrl).then((res) => res.json()),
        getRostersMap(gameId),
        fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`).then(
          (res) => res.json()
        ),
      ]);

    if (!shiftsData) {
      console.error(
        `No shifts data found for game ID ${gameId}. URL: ${shiftDataUrl}`
      );
      return [];
    }
    if (!rostersMap) {
      console.error(`No rosters data found for game ID ${gameId}`);
      return [];
    }

    if (boxscore.gameType !== 2) {
      return [];
    }

    let rosters = groupBy(Object.values(rostersMap), (player) => player.teamId);
    const data = [];
    const pairwiseTOIForTwoTeams = processShifts(shiftsData, rosters);

    Object.keys(pairwiseTOIForTwoTeams).forEach((teamId) => {
      pairwiseTOIForTwoTeams[teamId].forEach((item) => {
        if (!rostersMap[item.p1] || !rostersMap[item.p2]) return;
        data.push({
          toi: item.toi,
          p1: rostersMap[item.p1],
          p2: rostersMap[item.p2],
          teamId: parseInt(teamId),
        });
      });
    });

    return data;
  } catch (error) {
    console.error(
      `Error fetching TOI data for game ID ${gameId}. URL: ${shiftDataUrl}. Error:`,
      error
    );
    return [];
  }
}

async function upsertTOIData(gameId, data) {
  const rows = data.map((item) => ({
    game_id: gameId,
    team_id: item.teamId,
    player1_id: item.p1.id,
    player2_id: item.p2.id,
    toi: item.toi,
  }));

  const { data: supabaseData, error } = await supabase
    .from("toi_data")
    .upsert(rows, {
      onConflict: ["game_id", "team_id", "player1_id", "player2_id"],
    });

  if (error) {
    console.error("Error upserting data:", error);
  }
}

const gameIds = [
  /* array of game IDs for the season */
];
fetchAndUpsertTOIData(gameIds);

function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

async function getRostersMap(gameId) {
  const rostersMap = {};
  const goalies = [];
  try {
    const boxscore = await fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    ).then((res) => res.json());

    const playerByGameStats = boxscore.playerByGameStats;
    const transform = (teamId) => (item) => ({
      id: item.playerId,
      teamId: teamId,
      sweaterNumber: item.sweaterNumber,
      position: item.position,
      name: item.name.default,
      toi: item.toi,
      starter: item.starter,
    });

    const players = [];
    const teams = [boxscore.homeTeam, boxscore.awayTeam].map((team) => ({
      id: team.id,
      name: team.name.default,
    }));

    const homeTeamPlayers = [
      ...playerByGameStats.homeTeam.forwards,
      ...playerByGameStats.homeTeam.defense,
    ].map(transform(boxscore.homeTeam.id));
    const awayTeamPlayers = [
      ...playerByGameStats.awayTeam.forwards,
      ...playerByGameStats.awayTeam.defense,
    ].map(transform(boxscore.awayTeam.id));
    const homeGoalies = playerByGameStats.homeTeam.goalies.map(
      transform(boxscore.homeTeam.id)
    );
    const awayGoalies = playerByGameStats.awayTeam.goalies.map(
      transform(boxscore.awayTeam.id)
    );

    players.push(...homeTeamPlayers, ...awayTeamPlayers);
    goalies.push(...homeGoalies, ...awayGoalies);

    players.forEach((p) => {
      rostersMap[p.id] = p;
    });

    return { rostersMap, teams, goalies };
  } catch (error) {
    console.error("Error fetching roster map:", error);
    return { rostersMap, teams: [], goalies: [] };
  }
}

function processShifts(shifts = [], rosters = {}) {
  if (!shifts.length) {
    console.error("No shifts data provided.");
  }
  if (!Object.keys(rosters).length) {
    console.error("No rosters data provided.");
  }

  const teamIds = Object.keys(rosters).map(Number);
  const result = {};
  teamIds.forEach((teamId) => {
    const teamRosters = rosters[teamId];
    if (!teamRosters) {
      console.error(`No rosters found for team ID ${teamId}`);
      return;
    }

    for (let i = 0; i < teamRosters.length; i++) {
      for (let j = i; j < teamRosters.length; j++) {
        if (result[teamId] === undefined) result[teamId] = [];
        const p1 = teamRosters[i].id;
        const p2 = teamRosters[j].id;
        result[teamId].push({ toi: getPairwiseTOI(shifts, p1, p2), p1, p2 });
      }
    }
  });
  return result;
}

function getPairwiseTOI(shifts, p1, p2) {
  let totalTOI = 0;
  shifts.forEach((shift) => {
    if (shift.playerId === p1 || shift.playerId === p2) {
      totalTOI += shift.duration;
    }
  });
  return totalTOI;
}
