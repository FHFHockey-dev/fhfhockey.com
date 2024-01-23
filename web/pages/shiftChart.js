import React, { useState, useEffect, useRef } from 'react';
import styles from 'web/styles/ShiftChart.module.scss';
import * as d3 from 'd3';
import Fetch from 'lib/cors-fetch';


// TODO
// 1) Fix alignment of the timestamps to match the shift blocks
// 2) Add period markers after 20, 40, 60 minutes 
// 3) Team Label Markers
// 4) Shift Blocks stretched out to fill chart area
// 5) Integrate PP spans
// 6) Create dynamic time animations. Use the game clock to animate the shift blocks to show who is on/off the ice
// 7) Add a play-by-play timeline to the bottom of the chart
// 8) Add a legend to the chart
// 9) Create the line combo matrix
// 10) Create the PP Combo Matrix/Splits
// 11) Create more todo list items


function ShiftChart() {
    // State hooks to manage component data
    const svgRef = useRef(null);

    const [selectedDate, setSelectedDate] = useState('');
    const [selectedGame, setSelectedGame] = useState('');
    const [games, setGames] = useState([]);
    const [playerData, setPlayerData] = useState({ home: [], away: [] });
    const [totalGameTime, setTotalGameTime] = useState(0);
    const [totalGameTimeInSeconds, setTotalGameTimeInSeconds] = useState(0);
    const [totalGameWidth, setTotalGameWidth] = useState(1000); // State for the dynamic width of the game canvas

    // Ref hook for direct DOM access to the game canvas for width calculations
    const gameCanvasRef = useRef(null);

    // Fetches and processes player data for a given game ID
    const fetchPlayerData = async (gameId) => {
        try {
            const response = await Fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`).then(res => res.json());
            const processedPlayerData = processPlayerData(response);
            setPlayerData(processedPlayerData);
            return processedPlayerData;
        } catch (error) {
            console.error('Error fetching player data:', error);
            return { home: [], away: [] };
        }
    };

    // Processes the raw game data into structured format for player display
    const processPlayerData = (gameData) => {
        const homeTeamId = gameData.homeTeam.id;
        const awayTeamId = gameData.awayTeam.id;
    
        let homePlayers = [];
        let awayPlayers = [];
    
        const addPlayer = (playerData, teamId) => {
            const player = {
                id: playerData.playerId,
                name: playerData.name.default,
                position: playerData.position,
            };
    
            if (teamId === homeTeamId) {
                homePlayers.push(player);
            } else if (teamId === awayTeamId) {
                awayPlayers.push(player);
            }
        };
    
        // Corrected roles to match the API structure
        const teams = ['homeTeam', 'awayTeam'];
        const roles = ['forwards', 'defense', 'goalies']; // Updated to 'defense'

        teams.forEach(team => {
            roles.forEach(role => {
                if (gameData.boxscore.playerByGameStats[team] && gameData.boxscore.playerByGameStats[team][role]) {
                    gameData.boxscore.playerByGameStats[team][role].forEach(player => {
                        addPlayer(player, team === 'homeTeam' ? homeTeamId : awayTeamId);
                    });
                }
            });
        });
    
        return {
            home: homePlayers,
            away: awayPlayers
        };
    };    

    // Fetches season dates for initial component setup
    const fetchSeasonDates = async () => {
        try {
            console.log('Fetching season dates...');
            const response = await Fetch('https://api-web.nhle.com/v1/schedule/now').then(res => res.json());
            // console.log('Season dates:', response);
            // Extract and set the season dates here
        } catch (error) {
            console.error('Error fetching season dates:', error);
        }
    };

    // Fetches games for a selected date
    const fetchNHLGames = async (date) => {
        try {
            console.log(`Fetching games for date: ${date}...`);
            const response = await Fetch(`https://api-web.nhle.com/v1/schedule/${date}`).then(res => res.json());
            // console.log('Games on selected date:', response);
    
            // Extract the games for the specific date
            const dayData = response.gameWeek.find(day => day.date === date);
            const gamesOnSelectedDate = dayData ? dayData.games : [];
            // console.log('Filtered games for the selected date:', gamesOnSelectedDate);
    
            setGames(gamesOnSelectedDate);
        } catch (error) {
            console.error('Error fetching games:', error);
        }
    };

    // Calculates the total game time in minutes and seconds
    const calculateTotalGameTime = (gameDetails) => {
        const regularPeriodLength = 20; // 20 minutes for a regular period
        const isOvertime = gameDetails.periodDescriptor.periodType === "OT";
        let totalMinutes = regularPeriodLength * 3; // Regular NHL game has 3 periods
    
        if (isOvertime) {
            const overtimeSeconds = gameDetails.clock.secondsRemaining;
            const overtimeMinutesPlayed = (5 * 60 - overtimeSeconds) / 60; // Calculate the overtime minutes
            totalMinutes += overtimeMinutesPlayed;
        }
    
        // Format the time to avoid rounding errors
        const totalSeconds = Math.floor(totalMinutes * 60);
        const formattedMinutes = Math.floor(totalSeconds / 60);
        const formattedSeconds = totalSeconds % 60;
    
        return `${formattedMinutes}:${formattedSeconds.toString().padStart(2, '0')} minutes`;
    };

    // Function to convert game time into total seconds for further calculations
    const calculateTotalGameTimeInSeconds = (gameDetails) => {
        const regularPeriodLengthInSeconds = 20 * 60; // 20 minutes for a regular period in seconds
        let totalSeconds = regularPeriodLengthInSeconds * 3; // Regular NHL game has 3 periods
    
        // Check if the periodDescriptor and periodType properties exist before trying to read them
        if (gameDetails.periodDescriptor && gameDetails.periodDescriptor.periodType === "OT") {
            const overtimeSeconds = gameDetails.clock.secondsRemaining;
            totalSeconds += (5 * 60) - overtimeSeconds; // Add overtime seconds
        }
    
        return totalSeconds;
    };

    // Function to fetch game shift chart data and game details
    const fetchShiftChartData = async (gameId) => {
        try {
            // Fetch shift chart data
            console.log(`Fetching shift chart data for game ID: ${gameId}...`);
            const shiftDataResponse = await Fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`)
                .then(res => res.json());
//            console.log('Shift chart data:', shiftDataResponse.data);
    
            // Fetch game details
            console.log(`Fetching game details for game ID: ${gameId}...`);
            const gameDetailsResponse = await Fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`)
                .then(res => res.json());
//            console.log('Game details:', gameDetailsResponse);
    
            // Calculate total game time
            const totalGameTime = calculateTotalGameTime(gameDetailsResponse);
    
            // Set total game time and calculate total game time in seconds
            setTotalGameTime(totalGameTime);

            const totalGameTimeInMinutes = calculateTotalGameTime(gameDetailsResponse);
            console.log(`Total Game Time in Minutes: ${totalGameTimeInMinutes}`); // Verify this value
            setTotalGameTime(totalGameTimeInMinutes);

            const totalSeconds = calculateTotalGameTimeInSeconds(totalGameTimeInMinutes);
            console.log(`Setting total game time in seconds: ${totalSeconds}`); // Verify this value
            setTotalGameTimeInSeconds(totalSeconds);

            // Verify state update before calling calculateShiftWidth and calculateShiftStart
            // console.log(`Total Game Time in Seconds (State): ${totalGameTimeInSeconds}`);
    
            // Fetch player data
            console.log(`Fetching player data for game ID: ${gameId}...`);
            const fetchedPlayerData = await fetchPlayerData(gameId);
    
            // Organize shift chart data
            const organizedShiftData = organizeShiftData(shiftDataResponse.data);
            console.log('Organized shift chart data:', organizedShiftData);
    
            // Merge player data with hex values from shift chart data
            const updatedPlayerData = mergePlayerData(organizedShiftData, fetchedPlayerData);
            setPlayerData(updatedPlayerData);
    
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    // Organizes shift data into structured format for rendering the chart
    const organizeShiftData = (shiftData) => {
        const playerShifts = {};
    
        shiftData.forEach(shift => {
            const playerName = `${shift.firstName} ${shift.lastName}`;
            if (!playerShifts[playerName]) {
                playerShifts[playerName] = {
                    name: playerName,
                    id: shift.playerId,
                    team: shift.teamAbbrev,
                    hexValue: shift.hexValue,
                    shifts: []
                };
            }
            playerShifts[playerName].shifts.push({
                shiftNumber: shift.shiftNumber,
                startTime: shift.startTime,
                endTime: shift.endTime,
                duration: shift.duration,
                period: shift.period
            });
        });
    
        return Object.values(playerShifts).reduce((acc, player) => {
            acc[player.id] = player; // Use player ID as key for easy lookup
            return acc;
        }, {});
    };

    // Function to merge player data with shift data
    const mergePlayerData = (shiftData, playerData) => {
        const addShiftDataToPlayer = (teamPlayers) => {
            return teamPlayers.map(player => {
                const playerShiftData = shiftData[player.id] || {};
                return {
                    ...player,
                    hexValue: playerShiftData.hexValue || '#000000', // Default color if not found
                    shifts: playerShiftData.shifts || [] // Ensure 'shifts' is an array
                };
            });
        };
    
        return {
            home: addShiftDataToPlayer(playerData.home),
            away: addShiftDataToPlayer(playerData.away)
        };
    };

    // Handler for game selection change
    const handleGameChange = (event) => {
        const gameId = event.target.value;
        setSelectedGame(gameId);
        if (gameId) {
            fetchShiftChartData(gameId);
            fetchPlayerData(gameId); // Fetch player data
        }
    };

    // Function to calculate the width of a shift block
    const calculateShiftWidth = (shiftDurationString, totalGameTimeInSeconds) => {
        if (!shiftDurationString) {
            console.warn('Shift duration string is null or undefined');
            return 0;
        }
    
        const [minutes, seconds] = shiftDurationString.split(":").map(Number);
        const shiftDurationInSeconds = minutes * 60 + seconds;
        // Use totalGameTimeInSeconds which now includes overtime
        const width = (shiftDurationInSeconds / totalGameTimeInSeconds) * totalGameWidth;
        return width;
    };

    // Function to calculate the starting position of a shift block    
    const calculateShiftStart = (startTimeString, totalGameTimeInSeconds) => {
        const [minutes, seconds] = startTimeString.split(":").map(Number);
        const startTimeInSeconds = minutes * 60 + seconds;
        return (startTimeInSeconds / totalGameTimeInSeconds) * totalGameWidth; // Start position relative to total game width
    };

    // Generate Period Labels
    const generatePeriodLabels = (totalGameTimeInSeconds) => {
        const periodLength = 20 * 60; // 20 minutes in seconds
        const periods = [];
        for (let i = 0; i < 4; i++) { // 4 periods max including OT
            const start = i * periodLength;
            if (start < totalGameTimeInSeconds) {
                periods.push(`P${i + 1}`);
            }
        }
        if (periods.length === 4) {
            periods[3] = 'OT'; // Replace P4 with OT
        }
        return periods;
    };
    
    // Function to generate timestamps for every 5 minutes of the game
    const generateMinuteMarkers = (totalGameTimeInSeconds) => {
        const markers = [];
        for (let i = 0; i <= totalGameTimeInSeconds; i += 300) { // Increment by 5 minutes
            markers.push(i / 60); // Convert seconds to minutes
            console.log(`Marker Position: ${(markers * 60) / totalGameTimeInSeconds * 100}%`);
        }
        return markers;
    };

    // Pre-calculate period labels and minute markers to avoid recalculating them on every render
    const periodLabels = generatePeriodLabels(totalGameTimeInSeconds);
    const minuteMarkers = generateMinuteMarkers(totalGameTimeInSeconds);

    // Function to render shift blocks 
    const renderShiftBlocks = (player, totalGameTimeInSeconds) => {
        // Check if player.shifts is an array before calling map
        if (!Array.isArray(player.shifts)) {
            return null; // or return an empty array, or some placeholder content
        }
        
        return player.shifts.map((shift, index) => {
            const shiftWidth = calculateShiftWidth(shift.duration, totalGameTimeInSeconds);
            const shiftStart = calculateShiftStart(shift.startTime, totalGameTimeInSeconds);
            const shiftKey = `player-${player.id}-shift-${shift.shiftNumber}`;
            
            return (
                <div
                    key={shiftKey}
                    className={styles.shiftBlock}
                    style={{
                        backgroundColor: player.hexValue, // Use player's hex value for the background color
                        width: `${shiftWidth}%`, // Note: Using percentage instead of pixels
                        left: `${shiftStart}%` // Note: Using percentage instead of pixels
                    }}
                />
            );
        });
    };



    // useEffect to fetch season dates on component mount
    useEffect(() => {
        fetchSeasonDates();
    }, []); 

    // useEffect to fetch games whenever the selected date changes
    useEffect(() => {
        if (selectedDate) {
            fetchNHLGames(selectedDate);
        } else {
            setGames([]);
        }
    }, [selectedDate]);

    // Use useEffect to set the width of the game canvas after the component mounts
    useEffect(() => {
        // Only attempt to set the width if the ref is current and the game has been selected
        if (gameCanvasRef.current && selectedGame) {
          const updateDimensions = () => {
            setTotalGameWidth(gameCanvasRef.current.offsetWidth);
          };
      
          // Set the initial dimensions and add event listener for any resize events
          updateDimensions();
          window.addEventListener('resize', updateDimensions);
      
          // Clean up event listener when the component is unmounted or the selected game changes
          return () => window.removeEventListener('resize', updateDimensions);
        }
      }, [selectedGame]);
    
    return (
        <div className={styles.shiftChartContainer}>

            <div className={styles.dropdownContainer}>

                <div className={styles.shiftChartDropdown}>
                <label htmlFor="date-selector">Select Date: </label>
                <input 
                    type="date" 
                    id="date-selector" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                />
                </div>
                <div className={styles.shiftChartDropdown}>
                <label htmlFor="game-selector">Select Game: </label>
                <select 
                    id="game-selector" 
                    value={selectedGame} 
                    onChange={handleGameChange} // Assign handleGameChange here
                >
                        <option value="">Select a game</option>
                        {games.map(game => (
                            <option key={game.id} value={game.id}>
                                {`${game.homeTeam.abbrev} vs ${game.awayTeam.abbrev}`}
                            </option>
                        ))}
                    </select>
                </div>

            </div>
                    
            {/* Shift chart display using CSS Grid */}
            <div className={styles.chartGrid}>

            {/* Period Labels and Timestamps Inside Game Canvas */}

                {/* Period Labels */}
                <div className={styles.periodLabels}>
                    {periodLabels.map((label, index) => (
                        <div key={index} className={`${styles.periodLabel} ${label === 'OT' ? 'ot' : ''}`}>
                            {label}
                        </div>
                    ))}
                </div>

                {/* Minute Markers */}
                <div className={styles.minuteMarkers}>
                    {minuteMarkers.map((marker, index) => (
                        <div key={index} className={styles.minuteMarker}>
                            {marker}
                        </div>
                    ))}
                </div>

            {/* Iterating over players to create rows */}
            {playerData.home.concat(playerData.away).map((player, index) => (
                <React.Fragment key={player.id}>

                    {/* Player Name */}
                    <div className={styles.playerName} style={{ color: player.hexValue, gridColumn: 1, gridRow: index + 2 }}>
                        {player.name}
                    </div>

                    {/* Player Position */}
                    <div className={styles.playerPosition} style={{ color: player.hexValue, gridColumn: 2, gridRow: index + 2 }}>
                        {player.position}
                    </div>

                    {/* Shift Blocks */}
                    <div className={styles.shiftBlockContainer} style={{ gridColumn: 3, gridRow: index + 2 }}>
                        {renderShiftBlocks(player, totalGameTimeInSeconds)}
                    </div>

                    </React.Fragment>
                ))}

            </div>

        </div>
    );
}

export default ShiftChart;