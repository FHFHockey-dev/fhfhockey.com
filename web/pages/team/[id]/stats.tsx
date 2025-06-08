import { useMemo } from "react";
import { useRouter } from "next/router";
import { RosterMatrix } from "components/RosterMatrix/RosterMatrix";
import usePlayers from "hooks/usePlayers";
import Layout from "components/Layout";

export default function TeamStats() {
  const router = useRouter();
  const { id } = router.query;
  const allPlayers = usePlayers();
  const teamId = id ? parseInt(id as string) : null;

  // Filter and transform players for the current team
  const teamPlayers = useMemo(() => {
    if (!allPlayers.length || !teamId) return [];

    return allPlayers
      .filter((player) => player.teamId === teamId)
      .map((player) => ({
        id: player.id,
        nhl_player_name: player.fullName,
        mapped_position: player.position,
        age: player.age,
        sweater_number: player.sweaterNumber,
        height: player.heightInCentimeters
          ? `${player.heightInCentimeters} cm`
          : undefined,
        weight: player.weightInKilograms,
        // Add other optional fields as null/undefined since we don't have this data
        eligible_positions: undefined,
        shoots_catches: undefined,
        injury_status: undefined,
        injury_note: undefined,
        games_played: undefined,
        goals: undefined,
        assists: undefined,
        points: undefined,
        plus_minus: undefined,
        pim: undefined,
        shots: undefined,
        shooting_percentage: undefined,
        toi_per_game: undefined,
        pp_toi_per_game: undefined,
        cf_pct: undefined,
        xgf_pct: undefined,
        hdcf_pct: undefined,
        pdo: undefined,
        total_points_per_60: undefined,
        ixg_per_60: undefined,
        wins: undefined,
        losses: undefined,
        save_pct: undefined,
        goals_against_avg: undefined,
        shutouts: undefined
      }));
  }, [allPlayers, teamId]);

  // Determine team abbreviation from the first player
  const teamAbbreviation = useMemo(() => {
    if (teamPlayers.length > 0) {
      const firstPlayer = allPlayers.find((p) => p.teamId === teamId);
      return firstPlayer?.teamAbbreviation || "";
    }
    return "";
  }, [allPlayers, teamId, teamPlayers.length]);

  return (
    <Layout>
      {/* ...existing code... */}

      {/* Add RosterMatrix section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Team Roster</h2>
        <RosterMatrix
          players={teamPlayers}
          teamAbbreviation={teamAbbreviation}
          isLoading={false}
          error={null}
        />
      </div>

      {/* ...existing code... */}
    </Layout>
  );
}
