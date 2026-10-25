import { useState, useEffect, useRef } from "react";
import supabase from "lib/supabase";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

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

// Unparseable coordinates are dropped rather than plotted at center ice.
function toPlottedShot(shot: any): ShotData | null {
  const x = parseFloat(shot.xcoord as unknown as string);
  const y = parseFloat(shot.ycoord as unknown as string);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    xcoord: x,
    ycoord: y,
    typedesckey: shot.typedesckey as string,
    hometeamdefendingside: shot.hometeamdefendingside,
    eventownerteamid: shot.eventownerteamid
  };
}

export function useShotData(
  teamId: number,
  season?: string | null,
  filters: ShotDataFilters = {
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: [GAME_TYPES.REGULAR_SEASON]
  },
  // Defer the play-by-play reads until the Shot Map is actually shown.
  enabled = true
) {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [opponentShotData, setOpponentShotData] = useState<ShotData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedKey = useRef<string | null>(null);
  const filterKey = JSON.stringify({
    eventTypes: filters.eventTypes,
    gameTypes: filters.gameTypes
  });
  const requestKey = JSON.stringify([teamId, season, filterKey]);

  useEffect(() => {
    let active = true;
    const requestFilters: ShotDataFilters = JSON.parse(filterKey);
    setError(null);
    // Keep already-loaded data when the tab is hidden and shown again.
    if (!enabled || loadedKey.current === requestKey) {
      setIsLoading(false);
      return;
    }

    console.log("useShotData called with teamId:", teamId, "season:", season);
    if (!teamId || !season) {
      setIsLoading(false);
      return;
    }

    // An explicitly empty selection means nothing to show, not "every event".
    if (
      requestFilters.eventTypes?.length === 0 ||
      requestFilters.gameTypes?.length === 0
    ) {
      setShotData([]);
      setOpponentShotData([]);
      loadedKey.current = requestKey;
      setIsLoading(false);
      return;
    }

    async function fetchTeamShotData() {
      try {
        setIsLoading(true);

        // First get all games for this team and season using pagination
        let allGames: { id: number; hometeamid: number; awayteamid: number }[] =
          [];

        const games = await fetchAllSupabasePages<any>(({ from, to }) => {
          if (!active) return Promise.resolve({ data: [], error: null });
          let gamesQuery = supabase
            .from("pbp_games")
            .select("id, hometeamid, awayteamid")
            .eq("season", season as string);

          gamesQuery = gamesQuery.or(
            `hometeamid.eq.${teamId},awayteamid.eq.${teamId}`
          );

          return gamesQuery.range(from, to) as any;
        }, { pageSize: PAGE_SIZE });
        if (!active) return;

        console.log("Fetched games for team", teamId, ":", games.length);

        // NHL game IDs carry the game type in digits 5-6 (e.g. 2025020001).
        const gameTypes = requestFilters.gameTypes;
        // Only keep games with non-null hometeamid and awayteamid, and cast to number
        allGames = games
          .filter((g) => g.hometeamid !== null && g.awayteamid !== null)
          .filter(
            (g) => !gameTypes || gameTypes.includes(String(g.id).slice(4, 6))
          )
          .map((g) => ({
            id: g.id,
            hometeamid: g.hometeamid as number,
            awayteamid: g.awayteamid as number
          }));

        if (allGames.length === 0) {
          setShotData([]);
          setOpponentShotData([]);
          loadedKey.current = requestKey;
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
          const events = await fetchAllSupabasePages<any>(({ from, to }) => {
            if (!active) return Promise.resolve({ data: [], error: null });
            let eventsQuery = supabase
              .from("pbp_plays")
              .select(
                "xcoord, ycoord, typedesckey, hometeamdefendingside, eventownerteamid, gameid"
              )
              .in("gameid", gameIdChunk);

            // Don't filter out shots without coordinates initially
            // We'll normalize them later in the processing step

            if (requestFilters.eventTypes && requestFilters.eventTypes.length > 0) {
              eventsQuery = eventsQuery.in("typedesckey", requestFilters.eventTypes);
            }

            return eventsQuery.range(from, to) as any;
          }, { pageSize: PAGE_SIZE });
          if (!active) return;

          if (events.length > 0) {
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
                .map(toPlottedShot)
                .filter((shot): shot is ShotData => shot !== null);

              const validOpponentShots: ShotData[] = events
                .filter(
                  (shot) =>
                    gameIdToOpponentId[Number(shot.gameid)] !== undefined &&
                    shot.eventownerteamid ===
                      gameIdToOpponentId[Number(shot.gameid)] &&
                    shot.xcoord !== null &&
                    shot.ycoord !== null
                )
                .map(toPlottedShot)
                .filter((shot): shot is ShotData => shot !== null);

              allShots = allShots.concat(validTeamShots);
              allOpponentShots = allOpponentShots.concat(validOpponentShots);

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

        console.log(
          `Final shot counts - Team: ${allShots.length}, Opponent: ${allOpponentShots.length}`
        );

        setShotData(allShots);
        setOpponentShotData(allOpponentShots);
        loadedKey.current = requestKey;
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error("Error fetching shot data:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchTeamShotData();
    return () => { active = false; };
  }, [teamId, season, filterKey, requestKey, enabled]);

  return {
    shotData: loadedKey.current === requestKey ? shotData : [],
    opponentShotData: loadedKey.current === requestKey ? opponentShotData : [],
    isLoading,
    error
  };
}
