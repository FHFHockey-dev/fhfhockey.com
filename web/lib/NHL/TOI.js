const BASE_URL = "https://statsapi.web.nhl.com/api/v1";

const fetchStats = async (playerId, seasonId) => {
    const response = await fetch(
        `${BASE_URL}/people/${playerId}/stats?stats=gameLog${seasonId ? `&season=${seasonId}` : ""
        }`
    );
    const json = await response.json();

    const matches = json.stats[0].splits.reverse();
    const teamId = json.stats[0].splits[0].team.id;

    let labels = [];
    let timeOnIce = [];
    let powerPlayTimeOnIce = [];

    for (let i = 0; i < matches.length; i++) {
        labels[i] = matches[i].date;
        timeOnIce[i] = matches[i].stat.timeOnIce;
        powerPlayTimeOnIce[i] = matches[i].stat.powerPlayTimeOnIce;
    }
    return {
        totalPowerPlayTime: await fetchTotalPowerPlayTime(teamId, seasonId, labels),
        labels,
        timeOnIce,
        powerPlayTimeOnIce,
    };
};

const fetchTotalPowerPlayTime = async (teamId, seasonId, dates) => {
    const response = await fetch(`${BASE_URL}/teams/${teamId}/roster`);
    const json = await response.json();
    const totalPlayers = json.roster.length;
    const matchesForPlayerId = {};

    let powerPlayTimeOnIce = new Array(dates.length);
    for (let i = 0; i < dates.length; i++) {
        let PPTOI = 0;

        for (let j = 0; j < totalPlayers; j++) {
            const playerId = json.roster[j].person.id;
            if (i == 0) {
                const response = await fetch(
                    `${BASE_URL}/people/${playerId}/stats?stats=gameLog${seasonId ? `&season=${seasonId}` : ""
                    }`
                );
                const playerJson = await response.json();
                const matches = playerJson.stats[0].splits.reverse();

                matchesForPlayerId[playerId] = matches;
            }

            for (let k = 0; k < matchesForPlayerId[playerId].length; k++) {
                if (
                    dates[i] == matchesForPlayerId[playerId][k].date &&
                    matchesForPlayerId[playerId][k].stat.powerPlayTimeOnIce
                ) {
                    PPTOI += Number.parseFloat(
                        formatTime(matchesForPlayerId[playerId][k].stat.powerPlayTimeOnIce)
                    );
                    break;
                }
            }
        }
        powerPlayTimeOnIce[i] = PPTOI / 5;
    }
    // totalPowerPlayTime = powerPlayTimeOnIce;
    return powerPlayTimeOnIce;
};

function formatTime(timeString) {
    const arr = timeString.split(":");
    const minutes = Number.parseInt(arr[0]) + Number.parseInt(arr[1]) / 60; // converting

    return minutes
}

const fetchTOIData = async (playerId) => {
    const { labels, timeOnIce, totalPowerPlayTime, powerPlayTimeOnIce } = await fetchStats(playerId);

    for (let i = 0; i < timeOnIce.length; i++) {
        timeOnIce[i] = Number.parseFloat(formatTime(timeOnIce[i]) * 100 / 60)
        powerPlayTimeOnIce[i] = Number.parseFloat(formatTime(powerPlayTimeOnIce[i]) / totalPowerPlayTime[i]) * 100
    }

    return {
        labels,
        TOI: timeOnIce,
        PPTOI: powerPlayTimeOnIce
    }
}

export default fetchTOIData;
