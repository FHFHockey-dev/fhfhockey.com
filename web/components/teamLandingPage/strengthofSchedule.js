// StrengthOfSchedule.js
import React, { useState, useEffect } from 'react';

const StrengthOfSchedule = ({ type }) => {
    const [teamRecords, setTeamRecords] = useState({});
    const [fullTeamData, setFullTeamData] = useState({ records: {}, logs: {} });


    useEffect(() => {
        fetch('https://api-web.nhle.com/v1/standings/2023-11-27')
            .then(response => response.json())
            .then(data => {
                const processedData = processTeamData(data.standings);
                setTeamRecords(processedData);
                console.log("Team records:", teamRecords);
                console.log("Team records:", processedData);
            })
            .catch(error => console.error('Error fetching NHL data:', error));
    }, []);

    const processTeamData = (teams) => {
        return teams.reduce((acc, team) => {
            const teamKey = team.teamAbbrev.default;
            acc[teamKey] = {
                overall: {
                    pointPctg: team.pointPctg,
                    goalDifferentialPctg: team.goalDifferentialPctg,
                    winPctg: team.winPctg,
                    overallRecord: `${team.wins}-${team.losses}-${team.otLosses}`
                },
                home: {
                    homeGamesPlayed: team.homeGamesPlayed,
                    homeGoalDifferential: team.homeGoalDifferential,
                    homeGoalsFor: team.homeGoalsFor,
                    homeGoalsAgainst: team.homeGoalsAgainst,
                    homeWins: team.homeWins,
                    homeLosses: team.homeLosses,
                    homeOtLosses: team.homeOtLosses,
                    homePoints: team.homePoints,
                    homeRecord: `${team.homeWins}-${team.homeLosses}-${team.homeOtLosses}`,
                    homePtsPct: (team.homePoints / (team.homeGamesPlayed * 2)).toFixed(3)
                },
                away: {
                    roadGamesPlayed: team.roadGamesPlayed,
                    roadGoalDifferential: team.roadGoalDifferential,
                    roadGoalsFor: team.roadGoalsFor,
                    roadGoalsAgainst: team.roadGoalsAgainst,
                    roadWins: team.roadWins,
                    roadLosses: team.roadLosses,
                    roadOtLosses: team.roadOtLosses,
                    roadPoints: team.roadPoints,
                    roadRecord: `${team.roadWins}-${team.roadLosses}-${team.roadOtLosses}`,
                    roadPtsPct: (team.roadPoints / (team.roadGamesPlayed * 2)).toFixed(3)
                },
                lastTen: {
                    l10GamesPlayed: team.l10GamesPlayed,
                    l10GoalDifferential: team.l10GoalDifferential,
                    l10GoalsFor: team.l10GoalsFor,
                    l10GoalsAgainst: team.l10GoalsAgainst,
                    l10Wins: team.l10Wins,
                    l10Losses: team.l10Losses,
                    l10OtLosses: team.l10OtLosses,
                    l10Points: team.l10Points,
                    l10Record: `${team.l10Wins}-${team.l10Losses}-${team.l10OtLosses}`,
                    l10PtsPct: (team.l10Points / (team.l10GamesPlayed * 2)).toFixed(3)
                }
            };
            return acc;
        }, {});
    };

    const fetchGameLogs = async (teamAbbrevs) => {
        const gameLogs = {};
    
        for (const abbrev of teamAbbrevs) {
            try {
                const response = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/20232024`);
                const data = await response.json();
                gameLogs[abbrev] = processGameLogs(data.games, abbrev);
            } catch (error) {
                console.error(`Error fetching game logs for ${abbrev}:`, error);
            }
        }
    
        return gameLogs;
    };
    
    const processGameLogs = (games, teamAbbrev) => {
        return games.filter(game => game.gameType === 2) // Only include regular season games
        .map(game => {
            const isHomeGame = game.homeTeam.abbrev === teamAbbrev;
            const opponentAbbrev = isHomeGame ? game.awayTeam.abbrev : game.homeTeam.abbrev;
            const opponentRecord = teamRecords[opponentAbbrev];

            // Calculate opponent's points percentage
            const opponentPtsPct = opponentRecord.overall.pointPctg;

            // Determine opponent's home/away win percentages
            const opponentHomeWinPct = opponentRecord.home.homePtsPct;
            const opponentRoadWinPct = opponentRecord.away.roadPtsPct;

            // Extract the scores
            const teamScore = isHomeGame ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isHomeGame ? game.awayTeam.score : game.homeTeam.score;
    
            // Determine the outcome of the game
            let outcome;
            if (teamScore > opponentScore) {
                outcome = 'win';
            } else if (teamScore < opponentScore) {
                outcome = 'loss';
            } else {
                outcome = 'tie'; // Adjust based on NHL rules for ties/overtime losses
            }
    
            // Additional details can be extracted as needed, e.g., gameDate, venue, etc.
            return {
                date: game.gameDate,
                isHomeGame,
                opponent: opponentAbbrev,
                opponentRecord,
                opponentPtsPct,
                opponentHomeWinPct,
                opponentRoadWinPct,
                teamScore,
                opponentScore,
                outcome
            };
        });
    };

    const calculateOpponentRecords = (gameLogs, teamRecords) => {
        const combinedOpponentRecords = {};
    
        for (const team in gameLogs) {
            let pastOpponents = [];
            let futureOpponents = [];
            let pastHomeGames = 0;
            let pastAwayGames = 0;
            let futureHomeGames = 0;
            let futureAwayGames = 0;
    
            gameLogs[team].forEach(game => {
                const opponentAbbrev = game.opponent;
                const opponentRecord = teamRecords[opponentAbbrev];
                const currentDate = new Date();
    
                if (new Date(game.date) < currentDate) { // Past game
                    pastOpponents.push(opponentRecord);
                    if (game.isHomeGame) {
                        pastHomeGames++;
                    } else {
                        pastAwayGames++;
                    }
                } else { // Future game
                    futureOpponents.push(opponentRecord);
                    if (game.isHomeGame) {
                        futureHomeGames++;
                    } else {
                        futureAwayGames++;
                    }
                }
            });
    
            combinedOpponentRecords[team] = {
                past: {
                    opponents: aggregateOpponentRecords(pastOpponents),
                    homeGames: pastHomeGames,
                    awayGames: pastAwayGames
                },
                future: {
                    opponents: aggregateOpponentRecords(futureOpponents),
                    homeGames: futureHomeGames,
                    awayGames: futureAwayGames
                }
            };
        }
    
        return combinedOpponentRecords;
    };
    
    const aggregateOpponentRecords = (opponents) => {
        const totalOpponents = opponents.length;
        if (totalOpponents === 0) {
            return {
                avgHomeWinPct: 0,
                avgAwayWinPct: 0,
                avgPtsPct: 0,
                avgGoalDiff: 0
            };
        }
    
        const totals = opponents.reduce((acc, record) => {
            acc.homeWinPct += parseFloat(record.home.homePtsPct);
            acc.awayWinPct += parseFloat(record.away.roadPtsPct);
            acc.ptsPct += record.overall.pointPctg;
            acc.goalDiff += record.overall.goalDifferentialPctg;
            return acc;
        }, { homeWinPct: 0, awayWinPct: 0, ptsPct: 0, goalDiff: 0 });
    
        return {
            avgHomeWinPct: (totals.homeWinPct / totalOpponents).toFixed(3),
            avgAwayWinPct: (totals.awayWinPct / totalOpponents).toFixed(3),
            avgPtsPct: (totals.ptsPct / totalOpponents).toFixed(3),
            avgGoalDiff: (totals.goalDiff / totalOpponents).toFixed(3)
        };
    };
    
    
    
    useEffect(() => {
        const teamAbbrevs = Object.keys(teamRecords);
        if (teamAbbrevs.length > 0) {
            fetchGameLogs(teamAbbrevs, teamRecords).then(gameLogs => {
                const opponentRecords = calculateOpponentRecords(gameLogs, teamRecords);
                const fullTeamData = {
                    records: teamRecords,
                    logs: gameLogs,
                    opponentRecords
                };
                // Update the state with the combined data
                setFullTeamData(fullTeamData);
    
                // Add console logs to see the combined data
                console.log("Full Team Data:", fullTeamData);
            });
        }
    }, [teamRecords]);
    
    const renderSoSTable = (sosRankings) => {
        return (
            <div className={`sos-table ${type}`}>
                <table className='sosTableClass'>
                    <thead>
                        <tr>
                            <th>Team</th>
                            <th>SoS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sosRankings.map(({ team, sos }) => (
                            <tr key={team}>
                                <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <img 
                                        src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`} 
                                        alt={`${team} Logo`} 
                                        style={{ width: '30px', height: '30px' }} 
                                    />
                                    {team}
                                </td>
                                <td className='sosDataCell' style={{textAlign: 'center' }}>{sos}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    useEffect(() => {
        if (Object.keys(fullTeamData).length > 0 && fullTeamData.opponentRecords) {
            const pastSoSRankings = calculatePastSoSRanking(fullTeamData.opponentRecords);
            const futureSoSRankings = calculateFutureSoSRanking(fullTeamData.opponentRecords);
            setPastRankings(pastSoSRankings);
            setFutureRankings(futureSoSRankings);
        }
    }, [fullTeamData]);
    
    
    const calculatePastSoSRanking = (opponentRecords) => {
        const sosRankings = Object.entries(opponentRecords).map(([team, recordData]) => {
            // Ensure past opponent records are available
            if (!recordData.past || recordData.past.homeGames + recordData.past.awayGames === 0) {
                return { team, sos: 0 }; // Return default value if data is missing or no games played
            }
    
            const { past } = recordData;
            const totalPastGames = past.homeGames + past.awayGames;
    
            const weightedOppWinPct = ((past.homeGames * parseFloat(past.opponents.avgAwayWinPct)) + 
                                       (past.awayGames * parseFloat(past.opponents.avgHomeWinPct))) / 
                                       totalPastGames;
    
            return { team, sos: weightedOppWinPct.toFixed(3) }; // Round the sos value to 3 decimal places
        });
    
        sosRankings.sort((a, b) => parseFloat(b.sos) - parseFloat(a.sos)); // Ensure sorting is based on numerical values
    
        return sosRankings;
    };
    
    const calculateFutureSoSRanking = (opponentRecords) => {
        const sosRankings = Object.entries(opponentRecords).map(([team, recordData]) => {
            // Ensure future opponent records are available
            if (!recordData.future || recordData.future.homeGames + recordData.future.awayGames === 0) {
                return { team, sos: 0 }; // Return default value if data is missing or no games scheduled
            }
    
            const { future } = recordData;
            const totalFutureGames = future.homeGames + future.awayGames;
    
            const weightedOppWinPct = ((future.homeGames * parseFloat(future.opponents.avgAwayWinPct)) + 
                                       (future.awayGames * parseFloat(future.opponents.avgHomeWinPct))) / 
                                       totalFutureGames;
    
            return { team, sos: weightedOppWinPct.toFixed(3) }; // Round the sos value to 3 decimal places
        });
    
        sosRankings.sort((a, b) => parseFloat(b.sos) - parseFloat(a.sos)); // Ensure sorting is based on numerical values
    
        return sosRankings;
    };
    
    // const futureSoSRankings = calculateFutureSoSRanking(fullTeamData);
    // const pastSoSRankings = calculatePastSoSRanking(fullTeamData);
    // console.log("Past SoS Rankings:", pastSoSRankings);
    // console.log("Future SoS Rankings:", futureSoSRankings);
    
    
    const [pastRankings, setPastRankings] = useState([]);
    const [futureRankings, setFutureRankings] = useState([]);

    return (
        <div>
            {type === 'past' ? renderSoSTable(pastRankings) : renderSoSTable(futureRankings)}
        </div>
    );
};

export default StrengthOfSchedule;