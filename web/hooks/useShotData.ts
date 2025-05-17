import { useState, useEffect } from "react";
import supabase from "lib/supabase";

export interface ShotData {
  xcoord: number;
  ycoord: number;
  typedesckey: string;
  hometeamdefendingside?: string | null;
  eventownerteamid?: number | null;
}

// Maximum number of rows per page for Supabase queries
const PAGE_SIZE = 1000;

// Possible play event types
export const EVENT_TYPES = [
  "blocked-shot",
  "delayed-penalty",
  "faceoff",
  "failed-shot-attempt",
  "game-end",
  "giveaway",
  "goal",
  "hit",
  "missed-shot",
  "penalty",
  "period-end",
  "period-start",
  "shootout-complete",
  "shot-on-goal",
  "stoppage",
  "takeaway"
];

// Game type constants
export const GAME_TYPES = {
  PRESEASON: "01",
  REGULAR_SEASON: "02",
  PLAYOFFS: "03"
};

export interface ShotDataFilters {
  eventTypes?: string[];
  gameTypes?: string[];
}

export function useShotData(
  teamId: number,
  season?: string | null,
  filters: ShotDataFilters = {
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: [GAME_TYPES.REGULAR_SEASON]
  }
) {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!teamId || !season) {
      setIsLoading(false);
      return;
    }

    async function fetchTeamShotData() {
      try {
        setIsLoading(true);

        // First get all games for this team and season using pagination
        let allGames: { id: number }[] = [];
        let hasMoreGames = true;
        let gamesPage = 0;

        // Initialize game type filter condition
        const gameTypeFilters =
          filters.gameTypes?.map((gameType) => {
            // Handle potentially undefined season (though we've already checked above)
            const seasonStart = season!.substring(0, 4);
            return `id.like.${seasonStart}${gameType}%`;
          }) || [];

        while (hasMoreGames) {
          // Fix 2: Fix the OR query format for Supabase
          // `.or()` needs to receive a proper string with comma-separated conditions
          let gamesQuery = supabase
            .from("pbp_games")
            .select("id")
            .eq("season", season as string); // Type assertion since we've checked above that season is not null/undefined

          // Add team filter (home or away team)
          gamesQuery = gamesQuery.or(
            `hometeamid.eq.${teamId},awayteamid.eq.${teamId}`
          );

          // Add pagination
          gamesQuery = gamesQuery.range(
            gamesPage * PAGE_SIZE,
            (gamesPage + 1) * PAGE_SIZE - 1
          );

          // Add game type filter if specified
          if (gameTypeFilters.length > 0) {
            const gameTypeFilterQuery = gameTypeFilters.join(",");
            // We'll filter the results after fetching since the format of supabase OR queries is tricky
          }

          const { data: games, error: gamesError } = await gamesQuery;

          if (gamesError) {
            throw new Error(`Error fetching games: ${gamesError.message}`);
          }

          if (!games || games.length === 0) {
            hasMoreGames = false;
          } else {
            // Apply game type filtering here if needed
            let filteredGames = games;
            if (gameTypeFilters.length > 0) {
              filteredGames = games.filter((game) => {
                const gameId = String(game.id);
                // Check if the game ID matches any of our game type filters
                return (
                  filters.gameTypes?.some((gameType) => {
                    const seasonStart = season?.substring(0, 4) || "";
                    const pattern = `${seasonStart}${gameType}`;
                    return gameId.startsWith(pattern);
                  }) || false
                );
              });
            }

            allGames = allGames.concat(filteredGames);

            // Check if we need to fetch more pages
            hasMoreGames = games.length === PAGE_SIZE;
            gamesPage++;
          }
        }

        if (allGames.length === 0) {
          setShotData([]);
          setIsLoading(false);
          return;
        }

        const gameIds = allGames.map((game) => game.id);

        // Now fetch shot data from pbp_plays for these games with pagination
        let allShots: ShotData[] = [];

        // Due to the large number of games and potential shots, we'll process in batches
        // Split gameIds into smaller chunks to avoid query parameter limits
        const GAME_CHUNK_SIZE = 50; // Process 50 games at a time
        const gameIdChunks = [];

        for (let i = 0; i < gameIds.length; i += GAME_CHUNK_SIZE) {
          gameIdChunks.push(gameIds.slice(i, i + GAME_CHUNK_SIZE));
        }

        // Process each chunk of game IDs
        for (const gameIdChunk of gameIdChunks) {
          let hasMoreShots = true;
          let shotsPage = 0;

          while (hasMoreShots) {
            // Base query for plays
            let playsQuery = supabase
              .from("pbp_plays")
              .select(
                "xcoord, ycoord, typedesckey, hometeamdefendingside, eventownerteamid"
              )
              .in("gameid", gameIdChunk)
              .not("xcoord", "is", null)
              .not("ycoord", "is", null);

            // Add event type filter if specified
            if (filters.eventTypes && filters.eventTypes.length > 0) {
              playsQuery = playsQuery.in("typedesckey", filters.eventTypes);
            }

            // Add team filter
            playsQuery = playsQuery.eq("eventownerteamid", teamId);

            // Add pagination
            playsQuery = playsQuery.range(
              shotsPage * PAGE_SIZE,
              (shotsPage + 1) * PAGE_SIZE - 1
            );

            // Execute the query
            const { data: shots, error: shotsError } = await playsQuery;

            if (shotsError) {
              throw new Error(`Error fetching shots: ${shotsError.message}`);
            }

            if (!shots || shots.length === 0) {
              hasMoreShots = false;
            } else {
              // Fix 3: Type casting to ensure Supabase returned data matches our ShotData interface
              // Filter out any records with null coordinates that may have slipped through
              const validShots: ShotData[] = shots
                .filter(
                  (shot) =>
                    shot.xcoord !== null &&
                    shot.ycoord !== null &&
                    shot.typedesckey !== null
                )
                .map((shot) => ({
                  xcoord: shot.xcoord as number,
                  ycoord: shot.ycoord as number,
                  typedesckey: shot.typedesckey as string,
                  hometeamdefendingside: shot.hometeamdefendingside,
                  eventownerteamid: shot.eventownerteamid
                }));

              allShots = allShots.concat(validShots);

              // Check if we need to fetch more pages
              hasMoreShots = shots.length === PAGE_SIZE;
              shotsPage++;
            }
          }
        }

        setShotData(allShots);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error("Error fetching shot data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeamShotData();
  }, [teamId, season, filters.eventTypes, filters.gameTypes]);

  return { shotData, isLoading, error };
}
