import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from 'web/styles/ShiftChart.module.scss';
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

// Initializes the timestamps state with keys for each period and an empty array for each
const initialTimestamps = {
    period1: [],
    period2: [],
    period3: [],
    overtime: []
  };

function ShiftChart() {
    // State hooks to manage component data
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedGame, setSelectedGame] = useState('');
    const [games, setGames] = useState([]);
    const [playerData, setPlayerData] = useState({ home: [], away: [] });
    const [totalGameTime, setTotalGameTime] = useState(0);
    const [totalGameTimeInSeconds, setTotalGameTimeInSeconds] = useState(0);
    const [totalGameWidth, setTotalGameWidth] = useState(1000); // State for the dynamic width of the game canvas
    const [isOvertime, setIsOvertime] = useState(false);
    const [timestamps, setTimestamps] = useState(initialTimestamps);


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
                // Ensure each player has a 'shifts' object
                shifts: { period1: [], period2: [], period3: [], overtime: [] }
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
    const fetchShiftChartData = useCallback(async (gameId) => {
        try {
            // Fetch shift chart data
            console.log(`Fetching shift chart data for game ID: ${gameId}...`);
            const shiftDataResponse = await Fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`)
                .then(res => res.json());
//            console.log('Shift chart data:', shiftDataResponse.data);
    
            // Fetch game details and calculate total game time
            console.log(`Fetching game details for game ID: ${gameId}...`);
            const gameDetailsResponse = await Fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`)
                .then(res => res.json());
//            console.log('Game details:', gameDetailsResponse);
    
            // Calculate total game time
            const totalGameTime = calculateTotalGameTime(gameDetailsResponse);
    
            // Set total game time and calculate total game time in seconds
            setTotalGameTime(totalGameTime);
            setIsOvertime(gameDetailsResponse.periodDescriptor.periodType === "OT");

            const totalGameTimeInMinutes = calculateTotalGameTime(gameDetailsResponse);
            console.log(`Total Game Time in Minutes: ${totalGameTimeInMinutes}`); // Verify this value
            setTotalGameTime(totalGameTimeInMinutes);

            const totalSeconds = calculateTotalGameTimeInSeconds(totalGameTimeInMinutes);
            console.log(`Setting total game time in seconds: ${totalSeconds}`); // Verify this value
            setTotalGameTimeInSeconds(totalSeconds);
    
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
    }, []); // Empty dependency array to prevent infinite loop

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

    // Helper function to convert HH:MM time string to seconds
    const convertTimeToSeconds = (timeString) => {
        if (!timeString) {
            return 0; // Return 0 if timeString is null or undefined
        }
        const [minutes, seconds] = timeString.split(':').map(Number);
        return minutes * 60 + seconds;
    };

    // Function to generate timestamps for every period of the game and the game's end
    const generateTimestamps = (totalGameTimeInSeconds, isOvertime) => {
        const periodLengthInSeconds = 20 * 60; // 20 minutes per period in seconds
        let timestamps = {
            period1: [],
            period2: [],
            period3: [],
            overtime: []
        };

        // Add timestamps for each period
        for (let period = 1; period <= 3; period++) {
            for (let time = 0; time <= periodLengthInSeconds; time += 5 * 60) {
                if (period === 3 && time === periodLengthInSeconds) {
                    // Add "60" for the end of the third period
                    timestamps[`period${period}`].push({
                        label: '60',
                        seconds: time
                    });
                } else {
                    const label = (period - 1) * 20 + time / 60;
                    timestamps[`period${period}`].push({
                        label: label.toString(),
                        seconds: time
                    });
                }
            }
        }

        // Add timestamp for the end of OT
        if (isOvertime) {
            const overtimeStart = periodLengthInSeconds * 3;
            const overtimeDuration = totalGameTimeInSeconds - overtimeStart;
            timestamps.overtime.push({
                label: formatOvertimeLabel(overtimeDuration),
                seconds: totalGameTimeInSeconds
            });
        }

        return timestamps;
    };

    // Helper function to format overtime label
    const formatOvertimeLabel = (overtimeDurationInSeconds) => {
        const minutes = Math.floor(overtimeDurationInSeconds / 60);
        const seconds = overtimeDurationInSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Updated function to generate period bars
    const generatePeriodBars = (totalGameTimeInSeconds, isOvertime) => {
        const periodLength = 20 * 60; // 20 minutes per period in seconds
        let periods = [];
    
        // Regular periods
        for (let period = 1; period <= 3; period++) {
            const start = (period - 1) * periodLength;
            const end = period * periodLength;
            periods.push({
                period: period,
                startPercent: (start / totalGameTimeInSeconds) * 100,
                widthPercent: (periodLength / totalGameTimeInSeconds) * 100,
            });
        }
    
        // Overtime period
        if (isOvertime) {
            const overtimeStart = periodLength * 3;
            periods.push({
                period: 'OT',
                startPercent: (overtimeStart / totalGameTimeInSeconds) * 100,
                widthPercent: ((totalGameTimeInSeconds - overtimeStart) / totalGameTimeInSeconds) * 100,
            });
        }
    
        return periods;
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
                    shifts: {
                        period1: [],
                        period2: [],
                        period3: [],
                        overtime: [] // Assuming period 4 is overtime
                    }
                };
            }
            const periodKey = shift.period === 4 ? 'overtime' : `period${shift.period}`;
            playerShifts[playerName].shifts[periodKey].push(shift);
        });

        // Sort the shifts for each player by start time within each period
        Object.values(playerShifts).forEach(player => {
            Object.keys(player.shifts).forEach(periodKey => {
                player.shifts[periodKey].sort((a, b) => {
                    const startTimeA = convertTimeToSeconds(a.startTime);
                    const startTimeB = convertTimeToSeconds(b.startTime);
                    return startTimeA - startTimeB;
                });
            });
        });

        // Function to convert HH:MM time string to seconds
        function convertTimeToSeconds(timeString) {
            const [hours, minutes] = timeString.split(':').map(Number);
            return hours * 3600 + minutes * 60;
        }

        return Object.values(playerShifts).reduce((acc, player) => {
            acc[player.id] = player; // Use player ID as key for easy lookup
            return acc;
        }, {});
    };

    // Function to calculate the width of a shift block for a specific period
    const calculateShiftWidthForPeriod = (shiftDurationString, periodLengthInSeconds) => {
        const durationInSeconds = convertTimeToSeconds(shiftDurationString);
        return (durationInSeconds / periodLengthInSeconds) * 100; // Returns a percentage of the period width
    };

    // Function to calculate the starting position of a shift block for a specific period
    const calculateShiftStartForPeriod = (startTimeString, periodLengthInSeconds) => {
        const startTimeInSeconds = convertTimeToSeconds(startTimeString);
        return (startTimeInSeconds / periodLengthInSeconds) * 100; // Returns a percentage of the period width
    };

    const renderPeriodShifts = (shifts, period) => {
        // Determine the length of the period in seconds
        const periodLengthInSeconds = (period === 'overtime') ? OVERTIME_LENGTH_SECONDS : REGULAR_PERIOD_LENGTH_SECONDS;
    
        const borderColors = {
            period1: '2px solid yellow',
            period2: '2px solid blue',
            period3: '2px solid red',
            overtime: '2px solid white'
        };
    
        return shifts.map((shift, index) => {
            const shiftWidth = calculateShiftWidthForPeriod(shift.duration, periodLengthInSeconds);
            const shiftStart = calculateShiftStartForPeriod(shift.startTime, periodLengthInSeconds);
            const shiftKey = `shift-${index}`;
    
            const borderColor = borderColors[period];
    
            // Debugging
            console.log(`Rendering shift: Period: ${period}, Border Color: ${borderColor}`);
    
            const shiftStyle = { 
                backgroundColor: shift.hexValue,
                width: `${shiftWidth}%`,
                left: `${shiftStart}%`,
                border: borderColor
            };
    
            return (
                <div key={shiftKey} className={styles.shiftBlock} style={shiftStyle} />
            );
        });
    };    

    // Function to render shift blocks for each period in a container
    const renderShiftBlocks = (player, totalGameTimeInSeconds) => {
        // Ensure player.shifts is an object before mapping
        const shiftsEntries = player && player.shifts ? Object.entries(player.shifts) : [];
    
        return (
            <div className={styles.shiftBlockContainer}>
                {shiftsEntries.map(([periodKey, shifts]) => (
                    <div key={periodKey} className={styles.periodSection}>
                        {renderPeriodShifts(shifts, periodKey, totalGameTimeInSeconds)}
                    </div>
                ))}
            </div>
        );
    };

    // Constants for period lengths in seconds
    const REGULAR_PERIOD_LENGTH_SECONDS = 20 * 60; // 20 minutes
    const OVERTIME_LENGTH_SECONDS = 5 * 60; // 5 minutes

    // Define the length of a period in seconds and calculate the ends of each period
    const periodLengthInSeconds = 20 * 60; // 20 minutes per period in seconds

    // a game can have up to 4 periods (3 regular and 1 OT) - infitine OTs in the Playoffs
    const periodEnds = [periodLengthInSeconds, periodLengthInSeconds * 2, periodLengthInSeconds * 3, totalGameTimeInSeconds].filter(end => end <= totalGameTimeInSeconds);


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


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

    useEffect(() => {
        if (selectedGame) {
            fetchShiftChartData(selectedGame);
        }
    }, [fetchShiftChartData, selectedGame]); // Only re-run the effect if selectedGame changes
    
    // useEffect to recalculate the timestamps when the total game time changes
    useEffect(() => {
        const newTimestamps = generateTimestamps(totalGameTimeInSeconds, isOvertime);
        setTimestamps(newTimestamps); 
    }, [totalGameTimeInSeconds, isOvertime]);
    
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////

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
                    onChange={handleGameChange} // Assign handleGameChange 
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
            {/* Timestamps Row */}
            <div className={styles.timestampsRow}>
                {['period1', 'period2', 'period3', 'overtime'].map((periodKey, index) => (
                <div key={periodKey} className={styles[`${periodKey}Section`]}>
                    {timestamps[periodKey].map((timestamp, idx) => (
                    <div
                        key={idx}
                        className={styles.timestamp}
                        style={{
                        left: `${(timestamp.seconds / (20 * 60)) * 100}%`
                        }}
                    >
                        {timestamp.label}
                    </div>
                    ))}
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
                        {renderShiftBlocks(player, totalGameTimeInSeconds, isOvertime)}
                    </div>

                    </React.Fragment>
                ))}

            </div>


                
        </div>
    );
}

export default ShiftChart;