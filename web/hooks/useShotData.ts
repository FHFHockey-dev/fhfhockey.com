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
  const [opponentShotData, setOpponentShotData] = useState<ShotData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("useShotData called with teamId:", teamId, "season:", season);
    if (!teamId || !season) {
      setIsLoading(false);
      return;
    }

    async function fetchTeamShotData() {
      try {
        setIsLoading(true);

        // First get all games for this team and season using pagination
        let allGames: { id: number; hometeamid: number; awayteamid: number }[] =
          [];
        let hasMoreGames = true;
        let gamesPage = 0;

        // Initialize game type filter condition
        const gameTypeFilters =
          filters.gameTypes?.map((gameType) => {
            const seasonStart = season!.substring(0, 4);
            return `id.like.${seasonStart}${gameType}%`;
          }) || [];

        while (hasMoreGames) {
          let gamesQuery = supabase
            .from("pbp_games")
            .select("id, hometeamid, awayteamid")
            .eq("season", season as string);

          gamesQuery = gamesQuery.or(
            `hometeamid.eq.${teamId},awayteamid.eq.${teamId}`
          );

          gamesQuery = gamesQuery.range(
            gamesPage * PAGE_SIZE,
            (gamesPage + 1) * PAGE_SIZE - 1
          );

          const { data: games, error: gamesError } = await gamesQuery;
          console.log(
            "Fetched games for team",
            teamId,
            ":",
            games?.length || 0
          );

          if (gamesError) {
            throw new Error(`Error fetching games: ${gamesError.message}`);
          }

          if (!games || games.length === 0) {
            hasMoreGames = false;
          } else {
            // Only keep games with non-null hometeamid and awayteamid, and cast to number
            allGames = allGames.concat(
              games
                .filter((g) => g.hometeamid !== null && g.awayteamid !== null)
                .map((g) => ({
                  id: g.id,
                  hometeamid: g.hometeamid as number,
                  awayteamid: g.awayteamid as number
                }))
            );
            hasMoreGames = games.length === PAGE_SIZE;
            gamesPage++;
          }
        }

        if (allGames.length === 0) {
          setShotData([]);
          setOpponentShotData([]);
          setIsLoading(false);
          return;
        }

        const gameIds = allGames.map((game) => game.id);

        // Now fetch shot data from pbp_plays for these games with pagination
        let allShots: ShotData[] = [];
        let allOpponentShots: ShotData[] = [];

        // Split gameIds into smaller chunks to avoid query parameter limits
        const GAME_CHUNK_SIZE = 50;
        const gameIdChunks = [];
        for (let i = 0; i < gameIds.length; i += GAME_CHUNK_SIZE) {
          gameIdChunks.push(gameIds.slice(i, i + GAME_CHUNK_SIZE));
        }

        // Build a map of gameId to opponentId for quick lookup
        const gameIdToOpponentId: Record<number, number> = {};
        allGames.forEach((game) => {
          if (game.hometeamid === teamId) {
            gameIdToOpponentId[game.id] = game.awayteamid;
          } else {
            gameIdToOpponentId[game.id] = game.hometeamid;
          }
        });

        // Process each chunk of game IDs
        for (const gameIdChunk of gameIdChunks) {
          let hasMoreEvents = true;
          let eventsPage = 0;
          while (hasMoreEvents) {
            let eventsQuery = supabase
              .from("pbp_plays")
              .select(
                "xcoord, ycoord, typedesckey, hometeamdefendingside, eventownerteamid, gameid"
              )
              .in("gameid", gameIdChunk);

            // Don't filter out shots without coordinates initially
            // We'll normalize them later in the processing step

            if (filters.eventTypes && filters.eventTypes.length > 0) {
              eventsQuery = eventsQuery.in("typedesckey", filters.eventTypes);
            }
            eventsQuery = eventsQuery.range(
              eventsPage * PAGE_SIZE,
              (eventsPage + 1) * PAGE_SIZE - 1
            );
            const { data: events, error: eventsError } = await eventsQuery;
            if (eventsError) {
              throw new Error(`Error fetching events: ${eventsError.message}`);
            }
            if (!events || events.length === 0) {
              hasMoreEvents = false;
            } else {
              console.log("All events count:", events.length);

              // Split into team and opponent events
              // More permissive filtering for valid shots, with coordinate normalization
              const validTeamShots: ShotData[] = events
                .filter(
                  (shot) =>
                    shot.eventownerteamid === teamId &&
                    shot.xcoord !== null &&
                    shot.ycoord !== null
                )
                .map((shot) => {
                  // Normalize coordinates if needed
                  let x = parseFloat(shot.xcoord as unknown as string);
                  let y = parseFloat(shot.ycoord as unknown as string);

                  // Ensure coordinates are valid numbers
                  if (isNaN(x)) x = 0;
                  if (isNaN(y)) y = 0;

                  return {
                    xcoord: x,
                    ycoord: y,
                    typedesckey: shot.typedesckey as string,
                    hometeamdefendingside: shot.hometeamdefendingside,
                    eventownerteamid: shot.eventownerteamid
                  };
                });

              const validOpponentShots: ShotData[] = events
                .filter(
                  (shot) =>
                    gameIdToOpponentId[Number(shot.gameid)] !== undefined &&
                    shot.eventownerteamid ===
                      gameIdToOpponentId[Number(shot.gameid)] &&
                    shot.xcoord !== null &&
                    shot.ycoord !== null
                )
                .map((shot) => {
                  // Normalize coordinates if needed
                  let x = parseFloat(shot.xcoord as unknown as string);
                  let y = parseFloat(shot.ycoord as unknown as string);

                  // Ensure coordinates are valid numbers
                  if (isNaN(x)) x = 0;
                  if (isNaN(y)) y = 0;

                  return {
                    xcoord: x,
                    ycoord: y,
                    typedesckey: shot.typedesckey as string,
                    hometeamdefendingside: shot.hometeamdefendingside,
                    eventownerteamid: shot.eventownerteamid
                  };
                });

              allShots = allShots.concat(validTeamShots);
              allOpponentShots = allOpponentShots.concat(validOpponentShots);
              hasMoreEvents = events.length === PAGE_SIZE;
              eventsPage++;

              // Log some debugging info about the shot data
              console.log(
                `Processed ${validTeamShots.length} team shots and ${validOpponentShots.length} opponent shots`
              );

              // Sample a few shots to verify their coordinates
              if (validTeamShots.length > 0) {
                console.log("Sample team shot:", validTeamShots[0]);
              }
              if (validOpponentShots.length > 0) {
                console.log("Sample opponent shot:", validOpponentShots[0]);
              }
            }
          }
        }

        console.log(
          `Final shot counts - Team: ${allShots.length}, Opponent: ${allOpponentShots.length}`
        );

        setShotData(allShots);
        setOpponentShotData(allOpponentShots);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error("Error fetching shot data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeamShotData();
  }, [teamId, season, filters.eventTypes, filters.gameTypes]);

  return { shotData, opponentShotData, isLoading, error };
}
