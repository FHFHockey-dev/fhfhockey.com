// Import necessary modules from Next.js, Supabase, and other utilities
import { NextApiRequest, NextApiResponse } from 'next';
import supabase from 'lib/supabase';
import Fetch from 'lib/cors-fetch';
import { format, parseISO, addDays, isBefore } from 'date-fns';
import { getCurrentSeason } from 'lib/NHL/server'; 
import { WGOGoalieStat, WGOAdvancedGoalieStat } from 'lib/NHL/types';

// Define the structure of the NHL API response for goalie stats
interface NHLApiResponse {
    data: WGOGoalieStat[] | WGOAdvancedGoalieStat[];
}

// Fetch all goalie data for a specific date with a limit on the number of records
async function fetchAllDataForDate(formattedDate: string, limit: number): Promise<{ goalieStats: WGOGoalieStat[]; advancedGoalieStats: WGOAdvancedGoalieStat[]; }> {
    let start = 0;
    let moreDataAvailable = true;
    let goalieStats: WGOGoalieStat[] = [];
    let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];

    // Loop to fetch all pages of data from the API
    while (moreDataAvailable) {
        // Construct the URLs for fetching goalie stats and advanced stats
        const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
        const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

        // Fetch data from both URLs in parallel using Promise.all
        const [goalieStatsResponse, advancedGoalieStatsResponse] = await Promise.all([
            Fetch(goalieStatsUrl).then(res => res.json() as Promise<NHLApiResponse>),
            Fetch(advancedGoalieStatsUrl).then(res => res.json() as Promise<NHLApiResponse>),
        ]);
        
        // Concatenate the fetched data to the accumulated arrays
        goalieStats = goalieStats.concat(goalieStatsResponse.data as WGOGoalieStat[]);
        advancedGoalieStats = advancedGoalieStats.concat(advancedGoalieStatsResponse.data as WGOAdvancedGoalieStat[]);

        // Determine if more data is available to fetch in the next iteration
        moreDataAvailable = goalieStatsResponse.data.length === limit || advancedGoalieStatsResponse.data.length === limit;
        start += limit; // Increment the start index for the next fetch
    }

    return {
        goalieStats,
        advancedGoalieStats,
    };
}

// Function to update goalie stats for a specific date in the Supabase database
async function updateGoalieStats(date: string): Promise<{ updated: boolean; goalieStats: WGOGoalieStat[]; advancedGoalieStats: WGOAdvancedGoalieStat[]; }> {
    const formattedDate = format(parseISO(date), 'yyyy-MM-dd');
    const { goalieStats, advancedGoalieStats } = await fetchAllDataForDate(formattedDate, 100);

    // Iterate over each goalie stat and upsert into the Supabase table
    for (const stat of goalieStats) {
        const advStats = advancedGoalieStats.find(aStat => aStat.playerId === stat.playerId);
        await supabase.from("wgo_goalie_stats").upsert({
            // Mapping fields from fetched data to Supabase table columns
            goalie_id: stat.playerId,
            goalie_name: stat.goalieFullName,
            date: formattedDate,
            shoots_catches: stat.shootsCatches,
            games_played: stat.gamesPlayed,
            games_started: stat.gamesStarted,
            wins: stat.wins,
            losses: stat.losses,
            ot_losses: stat.otLosses,
            save_pct: stat.savePct,
            saves: stat.saves,
            goals_against: stat.goalsAgainst,
            goals_against_avg: stat.goalsAgainstAverage,
            shots_against: stat.shotsAgainst,
            time_on_ice: stat.timeOnIce,
            shutouts: stat.shutouts,
            goals: stat.goals,
            assists: stat.assists,
            // advanced stats from advancedGoalieStatsResponse (advStats)
            complete_game_pct: advStats?.completeGamePct, // float
            complete_games: advStats?.completeGames, // int
            incomplete_games: advStats?.incompleteGames, // int
            quality_start: advStats?.qualityStart, // int
            quality_starts_pct: advStats?.qualityStartsPct, // float
            regulation_losses: advStats?.regulationLosses, // int
            regulation_wins: advStats?.regulationWins, // int
            shots_against_per_60: advStats?.shotsAgainstPer60, // float
        });
    }

    return { updated: true, goalieStats, advancedGoalieStats };
}

// Function to update goalie stats for the entire season
async function updateAllGoalieStatsForSeason() {
    const currentSeason = await getCurrentSeason();
    let currentDate = parseISO(currentSeason.regularSeasonStartDate);
    const endDate = new Date(currentSeason.regularSeasonEndDate);
    let totalUpdates = 0; // To track the total number of updates made

    // Iterate through each day of the season and update stats
    while (isBefore(currentDate, endDate)) {
        const formattedDate = format(currentDate, 'yyyy-MM-dd');
        console.log(`Processing data for date: ${formattedDate}`);
        
        const { goalieStats, advancedGoalieStats } = await fetchAllDataForDate(formattedDate, 100);

        for (const stat of goalieStats) {
            const advStats = advancedGoalieStats.find(aStat => aStat.playerId === stat.playerId);
            await supabase.from("wgo_goalie_stats").upsert({
                // Mapping fields from fetched data to Supabase table columns
                goalie_id: stat.playerId,
                goalie_name: stat.goalieFullName,
                date: formattedDate,
                shoots_catches: stat.shootsCatches,
                games_played: stat.gamesPlayed,
                games_started: stat.gamesStarted,
                wins: stat.wins,
                losses: stat.losses,
                ot_losses: stat.otLosses,
                save_pct: stat.savePct,
                saves: stat.saves,
                goals_against: stat.goalsAgainst,
                goals_against_avg: stat.goalsAgainstAverage,
                shots_against: stat.shotsAgainst,
                time_on_ice: stat.timeOnIce,
                shutouts: stat.shutouts,
                goals: stat.goals,
                assists: stat.assists,
                // advanced stats from advancedGoalieStatsResponse (advStats)
                complete_game_pct: advStats?.completeGamePct, // float
                complete_games: advStats?.completeGames, // int
                incomplete_games: advStats?.incompleteGames, // int
                quality_start: advStats?.qualityStart, // int
                quality_starts_pct: advStats?.qualityStartsPct, // float
                regulation_losses: advStats?.regulationLosses, // int
                regulation_wins: advStats?.regulationWins, // int
                shots_against_per_60: advStats?.shotsAgainstPer60, // float                
            });
            totalUpdates += 1;
        }

        currentDate = addDays(currentDate, 1);
    }

    console.log('Finished updating goalie stats for the season');
    return { 
        message: `Season data updated successfully. Total updates: ${totalUpdates}`,
        success: true,
        totalUpdates: totalUpdates
    };
}

// Function to fetch data for a specific player across multiple dates
// Function to fetch data for a specific player across multiple dates
async function fetchDataForPlayer(playerId: string, playerName: string): Promise<{ goalieStats: WGOGoalieStat[]; advancedGoalieStats: WGOAdvancedGoalieStat[]; }> {
    let start = 0;
    let moreDataAvailable = true;
    let goalieStats: WGOGoalieStat[] = [];
    let advancedGoalieStats: WGOAdvancedGoalieStat[] = [];

    while (moreDataAvailable) {
        const encodedPlayerName = encodeURIComponent(`%${playerName}%`);
        const today = new Date();
        const formattedToday = format(today, 'yyyy-MM-dd');
        const regularSeasonStartDate = format(parseISO((await getCurrentSeason()).regularSeasonStartDate), 'yyyy-MM-dd');
        const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedToday}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=2%20and%20goalieFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;
        const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=100&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedToday}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${regularSeasonStartDate}%22%20and%20gameTypeId=2%20and%20goalieFullName%20likeIgnoreCase%20%22${encodedPlayerName}%22`;

        const [goalieStatsResponse, advancedGoalieStatsResponse] = await Promise.all([
            Fetch(goalieStatsUrl).then(res => res.json() as Promise<NHLApiResponse>),
            Fetch(advancedGoalieStatsUrl).then(res => res.json() as Promise<NHLApiResponse>),
        ]);

        goalieStats = goalieStats.concat(goalieStatsResponse.data as WGOGoalieStat[]);
        advancedGoalieStats = advancedGoalieStats.concat(advancedGoalieStatsResponse.data as WGOAdvancedGoalieStat[]);

        moreDataAvailable = goalieStatsResponse.data.length === 100 || advancedGoalieStatsResponse.data.length === 100;
        start += 100;
    }

    return {
        goalieStats,
        advancedGoalieStats,
    };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const dateParam = req.query.date;
        const playerIdParam = req.query.playerId;
        const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
        const playerId = Array.isArray(playerIdParam) ? playerIdParam[0] : playerIdParam;
        const goalieFullName = Array.isArray(req.query.goalieFullName) ? req.query.goalieFullName[0] : req.query.goalieFullName || 'Unknown Goalie';

        if (date) {
            const result = await updateGoalieStats(date);
            res.json({
                message: `Successfully updated goalie stats for date ${date}`,
                success: true,
                data: result,
            });
        } else if (playerId && goalieFullName) {
            const result = await fetchDataForPlayer(playerId, goalieFullName);
            res.json({
                message: `Successfully fetched goalie stats for player ID ${playerId}`,
                success: true,
                data: result,
            });
        } else {
            res.status(400).json({
                message: 'Missing required query parameters. Please provide a date or a player ID and goalie full name.',
                success: false,
            });
        }
    } catch (e: any) {
        res.status(400).json({
            message: 'Failed to process request. Reason: ' + e.message,
            success: false,
        });
    }
}


