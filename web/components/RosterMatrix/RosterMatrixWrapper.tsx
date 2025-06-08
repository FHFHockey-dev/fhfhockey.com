import React, { useState, useEffect, useCallback } from "react";
import { RosterMatrix } from "./RosterMatrix";
import supabase from "../../lib/supabase";

// Team mapping from the database
const TEAM_MAPPING: Record<number, { abbrev: string; name: string }> = {
  1: { abbrev: "NJD", name: "New Jersey Devils" },
  2: { abbrev: "NYI", name: "New York Islanders" },
  3: { abbrev: "NYR", name: "New York Rangers" },
  4: { abbrev: "PHI", name: "Philadelphia Flyers" },
  5: { abbrev: "PIT", name: "Pittsburgh Penguins" },
  6: { abbrev: "BOS", name: "Boston Bruins" },
  7: { abbrev: "BUF", name: "Buffalo Sabres" },
  8: { abbrev: "MTL", name: "Montreal Canadiens" },
  9: { abbrev: "OTT", name: "Ottawa Senators" },
  10: { abbrev: "TOR", name: "Toronto Maple Leafs" },
  12: { abbrev: "CAR", name: "Carolina Hurricanes" },
  13: { abbrev: "FLA", name: "Florida Panthers" },
  14: { abbrev: "TBL", name: "Tampa Bay Lightning" },
  15: { abbrev: "WSH", name: "Washington Capitals" },
  16: { abbrev: "CHI", name: "Chicago Blackhawks" },
  17: { abbrev: "DET", name: "Detroit Red Wings" },
  18: { abbrev: "NSH", name: "Nashville Predators" },
  19: { abbrev: "STL", name: "St. Louis Blues" },
  20: { abbrev: "CGY", name: "Calgary Flames" },
  21: { abbrev: "COL", name: "Colorado Avalanche" },
  22: { abbrev: "EDM", name: "Edmonton Oilers" },
  23: { abbrev: "VAN", name: "Vancouver Canucks" },
  24: { abbrev: "ANA", name: "Anaheim Ducks" },
  25: { abbrev: "DAL", name: "Dallas Stars" },
  26: { abbrev: "LAK", name: "Los Angeles Kings" },
  28: { abbrev: "SJS", name: "San Jose Sharks" },
  29: { abbrev: "CBJ", name: "Columbus Blue Jackets" },
  30: { abbrev: "MIN", name: "Minnesota Wild" },
  52: { abbrev: "WPG", name: "Winnipeg Jets" },
  53: { abbrev: "ARI", name: "Arizona Coyotes" },
  54: { abbrev: "VGK", name: "Vegas Golden Knights" },
  55: { abbrev: "SEA", name: "Seattle Kraken" },
  56: { abbrev: "UTA", name: "Utah Hockey Club" }
};

// Position type that matches the database
type Position = "C" | "LW" | "RW" | "D" | "G";

interface RosterMatrixWrapperProps {
  teamId: string;
  seasonId: string;
  teamAbbrev: string;
}

interface PlayerData {
  id: number;
  nhl_player_name: string;
  mapped_position: string;
  eligible_positions?: string[] | string;
  age?: number;
  sweater_number?: number;
  height?: string;
  weight?: number;
  shoots_catches?: string;
  injury_status?: string;
  injury_note?: string;

  // Basic stats
  games_played?: number;
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  pim?: number;
  shots?: number;
  shooting_percentage?: number;
  toi_per_game?: number;
  pp_toi_per_game?: number;

  // Advanced stats
  cf_pct?: number;
  xgf_pct?: number;
  hdcf_pct?: number;
  pdo?: number;
  total_points_per_60?: number;
  ixg_per_60?: number;

  // Goalie stats
  wins?: number;
  losses?: number;
  save_pct?: number;
  goals_against_avg?: number;
  shutouts?: number;
}

export default function RosterMatrixWrapper() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from("players")
        .select("id, fullName, position, team_id");

      // Apply team filter if selected
      if (selectedTeam && selectedTeam !== "all") {
        // Find team ID by abbreviation
        const teamId = Object.entries(TEAM_MAPPING).find(
          ([id, team]) => team.abbrev === selectedTeam
        )?.[0];

        if (teamId) {
          query = query.eq("team_id", parseInt(teamId));
        }
      }

      // Apply position filter if selected
      if (selectedPosition && selectedPosition !== "all") {
        query = query.eq("position", selectedPosition as Position);
      }

      // Add search filter if provided
      if (searchTerm) {
        query = query.ilike("fullName", `%${searchTerm}%`);
      }

      // Limit results and order by name
      query = query.order("fullName").limit(200);

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching players:", error);
        setError(`Failed to fetch players: ${error.message}`);
        return;
      }

      if (!data) {
        setPlayers([]);
        return;
      }

      // Transform data to match expected PlayerData format
      const transformedPlayers: PlayerData[] = data.map((player) => ({
        id: player.id,
        nhl_player_name: player.fullName,
        mapped_position: player.position,
        team: player.team_id
          ? TEAM_MAPPING[player.team_id]?.abbrev || "Unknown"
          : "Free Agent"
      }));

      setPlayers(transformedPlayers);
    } catch (err) {
      console.error("Error in fetchPlayers:", err);
      setError("An unexpected error occurred while fetching players");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam, selectedPosition, searchTerm]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  return (
    <div className="roster-matrix-wrapper">
      <div className="controls">
        <div className="filters">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Teams</option>
            {Object.values(TEAM_MAPPING).map((team) => (
              <option key={team.abbrev} value={team.abbrev}>
                {team.abbrev} - {team.name}
              </option>
            ))}
          </select>

          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Positions</option>
            <option value="C">Center</option>
            <option value="LW">Left Wing</option>
            <option value="RW">Right Wing</option>
            <option value="D">Defense</option>
            <option value="G">Goalie</option>
          </select>

          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <button
          onClick={fetchPlayers}
          disabled={isLoading}
          className="refresh-button"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading && !players.length && (
        <div className="loading-message">Loading players...</div>
      )}

      {!isLoading && !error && players.length === 0 && (
        <div className="no-results">
          No players found matching your criteria.
        </div>
      )}

      {players.length > 0 && (
        <RosterMatrix
          players={players}
          teamAbbreviation={selectedTeam !== "all" ? selectedTeam : undefined}
        />
      )}

      <style jsx>{`
        .roster-matrix-wrapper {
          padding: 20px;
        }

        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 20px;
        }

        .filters {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .filter-select,
        .search-input,
        .refresh-button {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .filter-select,
        .search-input {
          min-width: 150px;
        }

        .refresh-button {
          background-color: #0070f3;
          color: white;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background-color: #0051a2;
        }

        .refresh-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .error-message {
          background-color: #fee;
          color: #c00;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .loading-message,
        .no-results {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        @media (max-width: 768px) {
          .controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filters {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
