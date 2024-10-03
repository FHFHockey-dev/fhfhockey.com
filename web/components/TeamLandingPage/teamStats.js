// teamStats.js

import React, { useEffect, useState, useCallback } from 'react';
import './teamStats.module.scss'; // Import the CSS file
import { teamsInfo } from './teamsInfo'; // Import the teamsInfo object
import { useParams } from 'react-router-dom';

const TeamStatsModule = ({ selectedTeamId }) => {

  const { abbreviation } = useParams();
  const team = teamsInfo[abbreviation]; // Get team info from teamsInfo object
  const [teamData, setTeamData] = useState([]);
  const [sortedTableData, setSortedTableData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [teamsWithPowerScores, setTeamsWithPowerScores] = useState([]);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 600);
  const [selectedTeamStats, setSelectedTeamStats] = useState(null);


  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 600);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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

  const fetchSelectedTeamStats = useCallback(async () => {
    // Assuming team.id is the correct identifier for fetching stats
    const stats = await fetchTeamStats(team.franchiseId, team.id);
    if (stats) {
      setSelectedTeamStats(stats.lastTenGames[0]);
    }
  }, [team]);

  useEffect(() => {
    fetchSelectedTeamStats();
  }, [fetchSelectedTeamStats]);


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
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const fetchTeamStats = useCallback(async (franchiseId, teamId) => {
    const currentDate = getCurrentDate();
    const statsUrl = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${currentDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%222023-10-10%22%20and%20gameTypeId=2`;
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
          console.log(`Fetched stats for team ${team.fullName}`, stats);
          return { ...team, lastTenGames: [stats] };

        })
        .catch(error => {
          console.error(`Error fetching stats for team ${team.fullName}: ${error}`);
          return { ...team, lastTenGames: [null] }; // Set to null if error
        });
    }
    return team;
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
    if (matches && matches.length === 3) {
      // The second element in the matches array will be the total opportunities
      return parseInt(matches[2], 10);
    }
    // Return 0 if the format is not as expected
    return 0;
  }



//  console.log("Rendering TeamStatsModule...");
  return (
    <div className="team-stats-module"
            style={{border: `2px solid #FFFFFF`,
                    borderRadius: '2px',
                    padding: '5px',
                    overflow: 'auto',
                    '--primary-color': team?.primaryColor,
                    '--secondary-color': team?.secondaryColor,
                    '--jersey-color': team?.jersey,
                    '--accent-color': team?.accent,
                    '--alt-color': team?.alt,
                    }}>
      {/* Display other stats... */}
      <table className='team-stats-table'>
        <thead className="headerBlock" style={{ fontFamily: 'Roboto Condensed', fontWeight: '400', margin: '0'}}>
          <tr>
            <th colSpan='100%' style={{textAlign: 'center', border: '3px solid #FFFFFF', fontSize: "1.25em"}}>Team Stats</th>
          </tr>
        </thead>
        <tbody>            
            <tr>
              <td>GP:</td><td colSpan={2}></td>
                    
            </tr>
            <tr>
              <td>Record:</td><td colSpan={2}></td>
            </tr>
            <tr>
              <td>PTS:</td>
                <td></td>
                <td></td> {/* RANK */}
            </tr>
            <tr>
              <td>PTS%:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>GF/GP:</td>
                <td></td>
                <td></td>
            </tr>

            <tr>
              <td>GA/GP:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>PP%:</td>
                <td></td>
                <td></td> {/* RANK */}
            </tr>
            <tr>
              <td>PK%:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>PP/GP:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>SOG/GP:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>SA/GP:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>S%:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
              <td>Sv%:</td>
                <td></td>
                <td></td>
            </tr>

            <tr>
              <th colSpan='100%' style={{textAlign: 'center', border: '3px solid #FFFFFF', fontSize: "1.6em"}}>Last 10GP</th>
            </tr>

            <tr>
              <td>Record:</td>
                <td colSpan={2}></td>
            </tr>
            <tr>
              <td>Goals/GP</td>
                <td colSpan={2}>{selectedTeamStats?.L10goalsFor}</td>
            </tr>
            <tr>
              <td>GA/GP</td>
                <td colSpan={2}>{selectedTeamStats?.L10goalsAgainst}</td>
            </tr>
            <tr>
              <td>SF/GP</td>
                <td colSpan={2}>{selectedTeamStats?.L10shotsFor}</td>
            </tr>
            <tr>
              <td>SA/GP</td>
                <td colSpan={2}>{selectedTeamStats?.L10shotsAgainst}</td>
            </tr>
            <tr>
              <td>PP%</td>
                <td colSpan={2}>{selectedTeamStats?.L10powerPlay * 100}%</td>
            </tr>
            <tr>
              <td>PK%</td>
                <td colSpan={2}>%</td>
            </tr>
            <tr>
              <td>PPO/GP</td>
                <td colSpan={2}></td>
            </tr>
            <tr>
              <td>HIT/GP</td>
                <td colSpan={2}></td>
            </tr>
            <tr>
              <td>BLK/GP</td>
                <td colSpan={2}></td>
            </tr>
            <tr>
              <td>PIM/GP</td>
                <td colSpan={2}></td>
            </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TeamStatsModule;