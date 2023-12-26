// teamLandingPage.js

import React, { useEffect, useState, useCallback } from 'react';
import Link from "next/link";

import { teamsInfo } from 'lib/NHL/teamsInfo';

import StrengthOfSchedule from './strengthOfSchedule.js'; // Assuming it's in the same directory
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";


/// DEV NOTE:
/// Move Fetches to server side
/// Find out why PP% is messed up in L10


const TeamStatsComponent = () => {
  const [teamData, setTeamData] = useState([]);
  const [sortedTableData, setSortedTableData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [teamsWithPowerScores, setTeamsWithPowerScores] = useState([]);
  
const size = useScreenSize();
const isMobileView = size.screen === BreakPoint.s;


  function calculateLeagueAverages(teamsData) {
    const statsSums = {
      L10ptsPct: 0,
      L10goalsFor: 0,
      L10goalsAgainst: 0,
      L10shotsFor: 0,
      L10shotsAgainst: 0,
      L10powerPlay: 0,
      L10penaltyKill: 0,
      L10powerPlayOpportunities: 0,
      L10hits: 0,
      L10blocks: 0,
      L10pim: 0
    };
  
    teamsData.forEach(team => {
      const stats = team.lastTenGames[0].lastTenGames[0]; // Accessing the nested lastTenGames
      statsSums.L10ptsPct += stats.L10ptsPct;
      statsSums.L10goalsFor += stats.L10goalsFor;
      statsSums.L10goalsAgainst += stats.L10goalsAgainst;
      statsSums.L10shotsFor += stats.L10shotsFor;
      statsSums.L10shotsAgainst += stats.L10shotsAgainst;
      statsSums.L10powerPlay += stats.L10powerPlay;
      statsSums.L10penaltyKill += stats.L10penaltyKill;
      statsSums.L10powerPlayOpportunities += stats.L10powerPlayOpportunities;
      statsSums.L10hits += stats.L10hits;
      statsSums.L10blocks += stats.L10blocks;
      statsSums.L10pim += stats.L10pim;
    });
  
    const numberOfTeams = teamsData.length;
    return {
      L10ptsPct: statsSums.L10ptsPct / numberOfTeams,
      L10goalsFor: statsSums.L10goalsFor / numberOfTeams,
      L10goalsAgainst: statsSums.L10goalsAgainst / numberOfTeams,
      L10shotsFor: statsSums.L10shotsFor / numberOfTeams,
      L10shotsAgainst: statsSums.L10shotsAgainst / numberOfTeams,
      L10powerPlay: statsSums.L10powerPlay / numberOfTeams,
      L10penaltyKill: statsSums.L10penaltyKill / numberOfTeams,
      L10powerPlayOpportunities: statsSums.L10powerPlayOpportunities / numberOfTeams,
      L10hits: statsSums.L10hits / numberOfTeams,
      L10blocks: statsSums.L10blocks / numberOfTeams,
      L10pim: statsSums.L10pim / numberOfTeams
    };
  }

  function calculateStandardDeviations(teamsData, leagueAverages) {
    let sumsOfSquaredDifferences = {
      L10ptsPct: 0,
      L10goalsFor: 0,
      L10goalsAgainst: 0,
      L10shotsFor: 0,
      L10shotsAgainst: 0,
      L10powerPlay: 0,
      L10penaltyKill: 0,
      L10powerPlayOpportunities: 0,
      L10hits: 0,
      L10blocks: 0,
      L10pim: 0
    };
  
    teamsData.forEach(team => {
      const stats = team.lastTenGames[0].lastTenGames[0];
      for (const stat in sumsOfSquaredDifferences) {
        if (sumsOfSquaredDifferences.hasOwnProperty(stat)) {
          let difference = stats[stat] - leagueAverages[stat];
          sumsOfSquaredDifferences[stat] += difference * difference;
        }
      }
    });
  
    let stdDeviations = {};
    const numberOfTeams = teamsData.length;
    for (const stat in sumsOfSquaredDifferences) {
      if (sumsOfSquaredDifferences.hasOwnProperty(stat)) {
        stdDeviations[stat] = Math.sqrt(sumsOfSquaredDifferences[stat] / numberOfTeams);
      }
    }
  
    return stdDeviations;
  }
  
  function calculatePowerScores(teamsData, leagueAverages, leagueStdDeviations) {
    // Define weights for each stat
    const statWeights = {
      L10ptsPct: 10,
      L10goalsFor: 6,
      L10goalsAgainst: 4,
      L10shotsFor: 2,
      L10shotsAgainst: 2,
      L10powerPlay: 10,
      L10penaltyKill: 2,
      L10powerPlayOpportunities: 4,
      L10hits: 1,
      L10blocks: 1,
      L10pim: 1
    };
  
    return teamsData.map(team => {
      const stats = team.lastTenGames[0].lastTenGames[0];
      let powerScore = 0;
  
      for (const stat in leagueAverages) {
        if (leagueAverages.hasOwnProperty(stat)) {
          const zScore = (stats[stat] - leagueAverages[stat]) / leagueStdDeviations[stat];
          const weightedZScore = zScore * statWeights[stat];
          
          if (stat === 'L10goalsAgainst' || stat === 'L10shotsAgainst') {
            powerScore -= weightedZScore; // Negate the score for these stats
          } else {
            powerScore += weightedZScore;
          }
        }
      }
  
      return { ...team, powerScore };
    });
  }

  const requestSort = (key) => {
    let direction = 'ascending';
    if (key === 'L10pim' || key === 'L10ptsPct' || key === 'L10hits' || key === 'L10blocks' || key === 'L10powerPlayOpportunities' || key === 'L10goalsFor' || key === 'L10shotsFor' || key === 'L10powerPlay' || key === 'L10penaltyKill') {
      direction = 'descending';
    }
    if (sortConfig.key === key && sortConfig.direction === direction) {
      direction = direction === 'ascending' ? 'descending' : 'ascending';
    }
    setSortConfig({ key, direction });
    sortDataBy(key, direction);
  }
  
  const sortDataBy = (key, direction) => {
    const sortedData = [...sortedTableData].sort((a, b) => {
      const aStats = a.lastTenGames && a.lastTenGames[0].lastTenGames[0] ? a.lastTenGames[0].lastTenGames[0][key] : null;
      const bStats = b.lastTenGames && b.lastTenGames[0].lastTenGames[0] ? b.lastTenGames[0].lastTenGames[0][key] : null;
  
      if (aStats === null) return direction === 'ascending' ? 1 : -1;
      if (bStats === null) return direction === 'ascending' ? -1 : 1;
  
      return direction === 'ascending' ? aStats - bStats : bStats - aStats;
    });
    setSortedTableData(sortedData);
  };

  const fetchGameStats = useCallback(async (gameId, teamId) => {
    const boxscoreUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
  
    try {
      const response = await fetch(boxscoreUrl);
      const data = await response.json();
  
      // Determine if the team is the home or away team
      const isHomeTeam = data.homeTeam.id === teamId;
      const teamStats = isHomeTeam ? data.homeTeam : data.awayTeam;
  
      // Extract the relevant stats here
      const powerPlayOpportunities = extractPowerPlayOpportunities(teamStats.powerPlayConversion);
      const pim = teamStats.pim; // Penalty in minutes
      const hits = teamStats.hits;
      const blocks = teamStats.blocks;
  
      // Return the extracted stats
      return {
        powerPlayOpportunities,
        pim,
        hits,
        blocks
      };
    } catch (error) {
      console.error(`Error fetching game stats: ${error}`);
      return null;
    }
  }, []); // This depends on whether you use any external values in this function
  

  const getCurrentDate = () => {
    const today = new Date();
    console.log(today)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const fetchTeamStats = useCallback(async (franchiseId, teamId) => {
    const currentDate = getCurrentDate();
    const statsUrl = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${currentDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%222023-09-29%22%20and%20gameTypeId=2`;
    try {
      const response = await fetch(statsUrl);
      const data = await response.json();

      if (data && data.data) {
        data.data.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
        const lastTenGames = data.data.slice(0, 10);

        const gameStatsPromises = lastTenGames.map(game => fetchGameStats(game.gameId, teamId));
        const gamesStats = await Promise.all(gameStatsPromises);

        const lastTenStats = {
          lastTenIds: lastTenGames.map(game => game.gameId),
          L10ptsPct: average(lastTenGames, 'pointPct'),
          L10goalsAgainst: average(lastTenGames, 'goalsAgainst'),
          L10goalsFor: average(lastTenGames, 'goalsFor'),
          L10shotsFor: average(lastTenGames, 'shotsForPerGame'),
          L10shotsAgainst: average(lastTenGames, 'shotsAgainstPerGame'),
          L10powerPlay: average(lastTenGames, 'powerPlayPct'),
          L10penaltyKill: average(lastTenGames, 'penaltyKillPct'),
          L10powerPlayOpportunities: totalSum(gamesStats, 'powerPlayOpportunities') / gamesStats.length,
          L10hits: totalSum(gamesStats, 'hits') / gamesStats.length,
          L10blocks: totalSum(gamesStats, 'blocks') / gamesStats.length,
          L10pim: totalSum(gamesStats, 'pim') / gamesStats.length
        };
        console.log("LAST TEN GAMES: ", lastTenGames, lastTenStats)
        return { lastTenGames: [lastTenStats] };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching team stats: ${error}`);
      return null;
    }
  }, [fetchGameStats]); // Add dependencies if necessary

  const fetchBasicTeamData = useCallback(async () => {
    const teamsUrl = "https://api.nhle.com/stats/rest/en/franchise?sort=fullName&include=lastSeason.id&include=firstSeason.id";
  
    try {
      const response = await fetch(teamsUrl);
      const data = await response.json();
  
      // Filter out teams that are no longer active (lastSeason is not null)
      const activeTeams = data.data.filter(team => team.lastSeason === null);
  
      return activeTeams.map(team => {
        const abbreviation = Object.keys(teamsInfo).find(abbr => teamsInfo[abbr].name === team.fullName);
        return { ...team, abbreviation };
      });
    } catch (error) {
      console.error(`Error fetching basic team data: ${error}`);
      return [];
    }
  }, []);
  

  

const fetchDetailedTeamStats = useCallback(async (basicTeamData) => {
  const rankTeams = (data) => {
    return data.sort((a, b) => {
      // Check if lastTenGames data is available for both teams
      if (a.lastTenGames && b.lastTenGames && a.lastTenGames[0] && b.lastTenGames[0]) {
        // Compare the teams based on L10goalsFor
        return b.lastTenGames[0].L10goalsFor - a.lastTenGames[0].L10goalsFor;
      }
      return 0; // If data is not available, keep the original order
    });
  };

  const detailedDataPromises = basicTeamData.map(team => {
    if (team.lastSeason === null) {
      return fetchTeamStats(team.id, team.id)
        .then(stats => {
          return { ...team, lastTenGames: [stats] };
        })
        .catch(error => {
          console.error(`Error fetching stats for team ${team.fullName}: ${error}`);
          return { ...team, lastTenGames: [null] }; // Set to null if error
        });
    }
    return team;
  });

  Promise.all(detailedDataPromises).then(detailedData => {
    const rankedData = rankTeams(detailedData);
    
    // Calculate ranks for each stat and add to team data
    ['L10ptsPct', 'L10goalsFor', 'L10goalsAgainst', 'L10shotsAgainst', 'L10shotsFor', 'L10powerPlay', 'L10penaltyKill', 'L10powerPlayOpportunities', 'L10hits', 'L10blocks', 'L10pim'].forEach(statKey => {
      const statRanks = calculateStatRanks(rankedData, statKey);
      rankedData.forEach(team => {
        const rankEntry = statRanks.find(rank => rank.teamId === team.id);
        team[`${statKey}Rank`] = rankEntry ? rankEntry.rank : null;

        // Console log for each team's rank in this stat
        // console.log(`${team.abbreviation} rank in ${statKey}: ${team[`${statKey}Rank`]}`);
      });
    });

    setSortedTableData(rankedData);    
  });
}, [fetchTeamStats]); // Add any additional dependencies as needed

  useEffect(() => {
    fetchBasicTeamData().then(basicData => {
      setTeamData(basicData); // Set basic team data for logos grid
      fetchDetailedTeamStats(basicData); // Fetch detailed stats
    });
  }, [fetchBasicTeamData, fetchDetailedTeamStats]);
  
  useEffect(() => {
    if (sortedTableData.length > 0) {
      const leagueAverages = calculateLeagueAverages(sortedTableData);
      // console.log('League averages:', leagueAverages);
      const standardDeviations = calculateStandardDeviations(sortedTableData, leagueAverages);
      // console.log('Standard deviations:', standardDeviations);
      let updatedTeamsWithPowerScores = calculatePowerScores(sortedTableData, leagueAverages, standardDeviations);
      // console.log('Teams with power scores:', updatedTeamsWithPowerScores);
      
      // Sort teams by powerScore in descending order
      updatedTeamsWithPowerScores = updatedTeamsWithPowerScores.sort((a, b) => b.powerScore - a.powerScore);
  
      setTeamsWithPowerScores(updatedTeamsWithPowerScores);
    }
  }, [sortedTableData]);
  
  
  function totalSum(games, key) {
    return games.reduce((acc, game) => acc + (game[key] || 0), 0);
  }

  function average(games, key) {
    const sum = games.reduce((acc, game) => acc + (game[key] || 0), 0);
    return games.length > 0 ? sum / games.length : 0;
  }

  function extractPowerPlayOpportunities(powerPlayConversion) {
    // Use a regular expression to extract numbers from the format "x/y"
    const matches = powerPlayConversion.match(/(\d+)\/(\d+)/);
    console.log(matches);
    if (matches && matches.length === 3) {
      // The second element in the matches array will be the total opportunities
      return parseInt(matches[2], 10);
    }
    
    // Return 0 if the format is not as expected
    return 0;
  }

  

  function calculateStatRanks(teamsData, statKey) {
    // Define stats for which lower values are better
    const reverseOrderStats = ['L10goalsAgainst', 'L10shotsAgainst'];
  
    // Create an array with teams and their respective stat values
    const teamsWithStat = teamsData.map(team => ({
      teamId: team.id,
      teamName: team.abbreviation,
      statValue: team.lastTenGames[0].lastTenGames[0][statKey]
    }));
  
    // Sort the teams by the stat value
    if (reverseOrderStats.includes(statKey)) {
      // For stats where lower is better, sort in ascending order
      teamsWithStat.sort((a, b) => a.statValue - b.statValue);
    } else {
      // For other stats, sort in descending order
      teamsWithStat.sort((a, b) => b.statValue - a.statValue);
    }
  
    // Assign ranks based on sorted order
    let currentRank = 1;
    let previousValue = null;
    teamsWithStat.forEach((team, index) => {
      if (previousValue !== null && team.statValue === previousValue) {
        // Prepend 'T-' for tied ranks
        team.rank = `T-${currentRank}`;
      } else {
        currentRank = index + 1;
        team.rank = currentRank.toString();
        previousValue = team.statValue;
      }
    });
  
    return teamsWithStat.map(team => ({ teamId: team.teamId, rank: team.rank }));
  }
  
  const getColorClass = (rank) => {
    // Check if the rank has 'T-' prefix and remove it
    const cleanRank = rank.startsWith('T-') ? rank.substring(2) : rank;
  
    // Convert the cleaned rank to a number for calculation
    const numericRank = Number(cleanRank);
  
    // If you add more colors, change * 10 to * n where n is the number of colors
    const scaledRank = Math.ceil((numericRank / 32) * 32);
    return `rank-color-${scaledRank}`;
  };
  
  

  return (
    <div className="team-landing-page">
      <h1>Team Stat Pages</h1>
      <div className="sos-and-logo-grid">
        <div className="sos-container">
        <h2>Strength of Schedule - Past</h2>
          <StrengthOfSchedule type="past" />
        </div>
        <div className="team-logos-grid">
          {teamData.map(team => (
            <Link key={team.id} href={`/team/${team.abbreviation}`}>
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_light.svg`}
                alt={`${team.fullName} Logo`} 
              />
            </Link>
          ))}
        </div>
        <div className="sos-container">
          <h2>Strength of Schedule - Future</h2>
          <StrengthOfSchedule type="future" />
        </div>
      </div>
      <div className="tables-container">
        <div className="team-ranks-table-container">
          <h1>Team Power Rankings - Last 10 Games</h1>
          <table className='team-ranks-table'>
            <thead className='team-ranks-table-header'>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th onClick={() => requestSort('L10ptsPct')}>PTS%</th>
                <th onClick={() => requestSort('L10goalsFor')}>GF/GP</th>
                <th onClick={() => requestSort('L10goalsAgainst')}>GA/GP</th>
                <th onClick={() => requestSort('L10shotsFor')}>SF/GP</th>
                <th onClick={() => requestSort('L10shotsAgainst')}>SA/GP</th>
                <th onClick={() => requestSort('L10powerPlay')}>PP%</th>
                <th onClick={() => requestSort('L10penaltyKill')}>PK%</th>
                <th onClick={() => requestSort('L10powerPlayOpportunities')}>PPO/GP</th>
                <th onClick={() => requestSort('L10hits')}>HIT/GP</th>
                <th onClick={() => requestSort('L10blocks')}>BLK/GP</th>
                <th onClick={() => requestSort('L10pim')}>PIM/GP</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.map((team, index) => {
                const teamStats = team.lastTenGames ? team.lastTenGames[0] : null;

                if (!teamStats) {
                  console.warn(`Missing detailed stats for team: ${team.abbreviation}`);
                  return (
                    <tr key={team.id}>
                      <td>{index + 1}</td>
                      <td>
                        <img className='tableImg' src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_light.svg`} alt={`${team.fullName} Logo`} style={{ width: '22px', height: '22px', marginRight: '10px' }} />
                        {team.fullName}
                      </td>
                      {/* Render empty cells for missing stats */}
                      <td colSpan="10">Stats not available</td>
                    </tr>
                  );
                }

                return (
                  <tr key={team.id} className='team-ranks-row'>
                    <td>{index + 1}</td>
                    <td className='team-cell'>
                      <div className='team-logo-container'>
                        <img src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_dark.svg`} alt={`${team.fullName} Logo`} />
                      </div>
                      <div className='team-label-container'>
                        {team.abbreviation}
                      </div>
                    </td>
                    <td>{(teamStats.lastTenGames[0].L10ptsPct * 100).toFixed(1)}%</td>
                    <td>{teamStats.lastTenGames[0].L10goalsFor.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10goalsAgainst.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10shotsFor.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10shotsAgainst.toFixed(2)}</td>
                    <td>{(teamStats.lastTenGames[0].L10powerPlay * 100).toFixed(1)}%</td>
                    <td>{(teamStats.lastTenGames[0].L10penaltyKill * 100).toFixed(1)}%</td>
                    <td>{teamStats.lastTenGames[0].L10powerPlayOpportunities.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10hits.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10blocks.toFixed(2)}</td>
                    <td>{teamStats.lastTenGames[0].L10pim.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className='table-separator'></div>
        <div className="fantasy-power-ranks-table-container">
          <h1>Fantasy Power Rankings - Last 10 Games</h1>
          <table className='fantasy-power-ranks-table'>
            <thead className='fantasy-power-ranks-table-header'>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>PTS%</th>
                <th>GF/GP</th>
                <th>GA/GP</th>
                <th>SF/GP</th>
                <th>SA/GP</th>
                <th>PP%</th>
                <th>PK%</th>
                <th>PPO/GP</th>
                <th>HIT/GP</th>
                <th>BLK/GP</th>
                <th>PIM/GP</th>
              </tr>
            </thead>
            <tbody>
              {teamsWithPowerScores.map((team, index) => (
                <tr key={team.id} className='fantasy-power-ranks-row'>
                  <td className={index % 2 === 0 ? 'odd-row' : ''}>{index + 1}</td>
                  <td className={`team-cell ${index % 2 === 0 ? 'odd-row' : ''}`}>
                  <div className='team-logo-container'>
                    <img src={`https://assets.nhle.com/logos/nhl/svg/${team.abbreviation}_dark.svg`} alt={`${team.fullName} Logo`} />
                    </div>
                    {!isMobileView && (
                      <div className='team-label-container'>
                        {team.abbreviation}
                      </div>
                    )}
                  </td>
                  <td className={getColorClass(team.L10ptsPctRank)}>{team.L10ptsPctRank}</td>
                  <td className={getColorClass(team.L10goalsForRank)}>{team.L10goalsForRank}</td>
                  <td className={getColorClass(team.L10goalsAgainstRank)}>{team.L10goalsAgainstRank}</td>
                  <td className={getColorClass(team.L10shotsForRank)}>{team.L10shotsForRank}</td>
                  <td className={getColorClass(team.L10shotsAgainstRank)}>{team.L10shotsAgainstRank}</td>
                  <td className={getColorClass(team.L10powerPlayRank)}>{team.L10powerPlayRank}</td>
                  <td className={getColorClass(team.L10penaltyKillRank)}>{team.L10penaltyKillRank}</td>
                  <td className={getColorClass(team.L10powerPlayOpportunitiesRank)}>{team.L10powerPlayOpportunitiesRank}</td>
                  <td className={getColorClass(team.L10hitsRank)}>{team.L10hitsRank}</td>
                  <td className={getColorClass(team.L10blocksRank)}>{team.L10blocksRank}</td>
                  <td className={getColorClass(team.L10pimRank)}>{team.L10pimRank}</td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
};


export default TeamStatsComponent;
