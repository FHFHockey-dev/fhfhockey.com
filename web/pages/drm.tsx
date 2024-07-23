// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\drm.tsx

import { useState, useEffect } from "react";
import DateRangeMatrix, {
  OPTIONS as DATERANGE_MATRIX_MODES,
  Mode,
} from "web/components/DateRangeMatrix/index";
import { queryTypes, useQueryState } from "next-usequerystate";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { fetchScheduleData } from "utils/fetchScheduleData";
import { teamsInfo } from "lib/NHL/teamsInfo"; // Import teamsInfo

type TeamAbbreviation = keyof typeof teamsInfo;

export default function DRMPage() {
  const [dateRangeMatrixMode, setDateRangeMatrixMode] = useQueryState(
    "daterange-matrix-mode",
    queryTypes.string.withDefault(DATERANGE_MATRIX_MODES[0].value)
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbreviation | "">("");
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [gameIds, setGameIds] = useState<number[]>([]);

  useEffect(() => {
    async function fetchSeason() {
      const currentSeason = await fetchCurrentSeason();
      console.log("Current season ID:", currentSeason);
      setSeasonId(currentSeason);
    }
    fetchSeason();
  }, []);

  useEffect(() => {
    async function fetchGames() {
      if (selectedTeam && seasonId) {
        console.log(
          "Fetching games for team:",
          selectedTeam,
          "and season:",
          seasonId
        );
        const games = await fetchScheduleData(selectedTeam, seasonId);
        console.log("Fetched games:", games);
        setGameIds(games.map((game: { id: number }) => game.id));
      }
    }
    fetchGames();
  }, [selectedTeam, seasonId]);

  const mode = dateRangeMatrixMode as Mode;

  return (
    <div id="date-range-matrix" style={{ margin: "2rem 0", width: "100%" }}>
      <TeamDropdown
        onSelect={(team) => setSelectedTeam(team as TeamAbbreviation)}
      />
      {selectedTeam && gameIds.length > 0 && (
        <DateRangeMatrix
          id={selectedTeam}
          gameIds={gameIds}
          mode={mode}
          onModeChanged={(newMode) => {
            setDateRangeMatrixMode(newMode);
          }}
        />
      )}
    </div>
  );
}
