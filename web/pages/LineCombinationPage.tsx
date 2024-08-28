// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/pages/LineCombinationPage.tsx

import { useState, useEffect } from "react";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import { teamsInfo } from "lib/NHL/teamsInfo";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { fetchAggregatedData } from "web/components/DateRangeMatrix/fetchAggregatedData";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LinePairGrid, {
  PlayerData,
} from "components/DateRangeMatrix/LinePairGrid";
import styles from "components/DateRangeMatrix/PulsatingGrid.module.scss";

type TeamAbbreviation = keyof typeof teamsInfo;

const LineCombinationPage = () => {
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbreviation | "">("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [aggregatedData, setAggregatedData] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);

  useEffect(() => {
    async function initializeDates() {
      const currentSeason = await fetchCurrentSeason();
      setStartDate(new Date(currentSeason.startDate));
      setEndDate(new Date(currentSeason.endDate));
    }
    initializeDates();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (selectedTeam && startDate && endDate) {
        setLoading(true);
        const { regularSeasonPlayersData, playoffPlayersData } =
          await fetchAggregatedData(
            selectedTeam,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0]
          );

        const allPlayersData = [
          ...Object.values(regularSeasonPlayersData),
          ...Object.values(playoffPlayersData),
        ];

        const aggregatedPlayersData: Record<number, PlayerData> = {};

        allPlayersData.forEach((playerData) => {
          const player = playerData as {
            playerId: number;
            teamId: number;
            primaryPosition: string;
            playerName: string;
            displayPosition: string;
            playerType: string;
            regularSeasonData: {
              totalTOI: number;
              GP: number;
              timesOnLine: Record<string, number>;
              timesOnPair: Record<string, number>;
              percentToiWith: Record<number, number>;
              percentToiWithMixed: Record<number, number>;
              timeSpentWith: Record<number, string>;
              timeSpentWithMixed: Record<number, string>;
              timesPlayedWith: Record<number, number>;
              percentOfSeason: Record<number, number>;
            };
          };
          const playerId = player.playerId;
          if (!aggregatedPlayersData[playerId]) {
            aggregatedPlayersData[playerId] = {
              id: player.playerId,
              teamId: player.teamId,
              position: player.primaryPosition,
              name: player.playerName,
              totalTOI: 0,
              timesOnLine: {},
              timesOnPair: {},
              percentToiWith: {},
              percentToiWithMixed: {},
              timeSpentWith: {},
              timeSpentWithMixed: {},
              GP: 0,
              timesPlayedWith: {},
              ATOI: "00:00",
              percentOfSeason: {},
              displayPosition: player.displayPosition,
              comboPoints: 0,
              mutualSharedToi: {},
              playerType: player.playerType,
            };
          }
          const aggregatedPlayer = aggregatedPlayersData[playerId];

          // Aggregate the data
          aggregatedPlayer.totalTOI += player.regularSeasonData.totalTOI;
          aggregatedPlayer.GP += player.regularSeasonData.GP;
          aggregatedPlayer.timesOnLine = {
            ...aggregatedPlayer.timesOnLine,
            ...player.regularSeasonData.timesOnLine,
          };
          aggregatedPlayer.timesOnPair = {
            ...aggregatedPlayer.timesOnPair,
            ...player.regularSeasonData.timesOnPair,
          };
          aggregatedPlayer.percentToiWith = {
            ...aggregatedPlayer.percentToiWith,
            ...player.regularSeasonData.percentToiWith,
          };
          aggregatedPlayer.percentToiWithMixed = {
            ...aggregatedPlayer.percentToiWithMixed,
            ...player.regularSeasonData.percentToiWithMixed,
          };
          aggregatedPlayer.timeSpentWith = {
            ...aggregatedPlayer.timeSpentWith,
            ...player.regularSeasonData.timeSpentWith,
          };
          aggregatedPlayer.timeSpentWithMixed = {
            ...aggregatedPlayer.timeSpentWithMixed,
            ...player.regularSeasonData.timeSpentWithMixed,
          };
          aggregatedPlayer.timesPlayedWith = {
            ...aggregatedPlayer.timesPlayedWith,
            ...player.regularSeasonData.timesPlayedWith,
          };
          aggregatedPlayer.percentOfSeason = {
            ...aggregatedPlayer.percentOfSeason,
            ...player.regularSeasonData.percentOfSeason,
          };
        });

        const updatedRoster = Object.values(aggregatedPlayersData).map(
          (player) => {
            const mutualSharedToi: Record<number, number> = {};
            for (const teammateId in player.percentToiWith) {
              const teammate = aggregatedPlayersData[parseInt(teammateId)];
              if (teammate) {
                const avgToi =
                  (player.percentToiWith[teammate.id] +
                    teammate.percentToiWith[player.id]) /
                  2;
                mutualSharedToi[teammate.id] = avgToi;
              }
            }
            player.mutualSharedToi = mutualSharedToi;
            return player;
          }
        );

        setAggregatedData(updatedRoster);
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedTeam, startDate, endDate]);

  const calculateComboPoints = (player: PlayerData) => {
    const timesOnLine = player.timesOnLine;
    const timesOnPair = player.timesOnPair;
    player.comboPoints =
      (timesOnLine["1"] || 0) * 4 +
      (timesOnLine["2"] || 0) * 3 +
      (timesOnLine["3"] || 0) * 2 +
      (timesOnLine["4"] || 0) * 1 +
      (timesOnPair["1"] || 0) * 3 +
      (timesOnPair["2"] || 0) * 2 +
      (timesOnPair["3"] || 0) * 1;
    return player;
  };

  useEffect(() => {
    const sortedRoster = aggregatedData
      .map(calculateComboPoints)
      .sort((a, b) => (b.comboPoints ?? 0) - (a.comboPoints ?? 0));

    const assignGroups = (
      players: PlayerData[],
      groupSize: number,
      assignedPlayers: Set<number>
    ): PlayerData[] => {
      if (players.length === 0) return [];

      const pivotPlayer = players.find(
        (player) => !assignedPlayers.has(player.id)
      );
      if (!pivotPlayer) return [];

      assignedPlayers.add(pivotPlayer.id);

      const group: PlayerData[] = [pivotPlayer];
      const remainingPlayers = players.filter(
        (player) => !assignedPlayers.has(player.id)
      );

      remainingPlayers.sort((a, b) => {
        const mutualToiA = pivotPlayer.mutualSharedToi?.[a.id] || 0;
        const mutualToiB = pivotPlayer.mutualSharedToi?.[b.id] || 0;
        return mutualToiB - mutualToiA;
      });

      for (let i = 0; i < groupSize - 1; i++) {
        if (remainingPlayers[i]) {
          group.push(remainingPlayers[i]);
          assignedPlayers.add(remainingPlayers[i].id);
        }
      }

      return group;
    };

    const assignedPlayers = new Set<number>();
    const linesArray: PlayerData[][] = [];
    const pairsArray: PlayerData[][] = [];

    const forwards = sortedRoster.filter((player) => player.playerType === "F");
    const defensemen = sortedRoster.filter(
      (player) => player.playerType === "D"
    );

    while (forwards.length > 0 && linesArray.length < 4) {
      const linePlayers = assignGroups(forwards, 3, assignedPlayers);
      if (linePlayers.length === 3) {
        linesArray.push(linePlayers);
        forwards.splice(
          0,
          forwards.length,
          ...forwards.filter((player) => !assignedPlayers.has(player.id))
        );
      } else {
        break;
      }
    }

    while (defensemen.length > 0 && pairsArray.length < 3) {
      const pairPlayers = assignGroups(defensemen, 2, assignedPlayers);
      if (pairPlayers.length === 2) {
        pairsArray.push(pairPlayers);
        defensemen.splice(
          0,
          defensemen.length,
          ...defensemen.filter((player) => !assignedPlayers.has(player.id))
        );
      } else {
        break;
      }
    }

    setLines(linesArray);
    setPairs(pairsArray);
  }, [aggregatedData]);

  return (
    <div>
      <TeamDropdown
        onSelect={(team) => {
          setSelectedTeam(team as TeamAbbreviation);
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          margin: "1rem 0",
        }}
      >
        <DatePicker
          selected={startDate || null}
          onChange={(date: Date | null) => setStartDate(date ?? undefined)}
          selectsStart
          startDate={startDate || undefined}
          endDate={endDate || undefined}
        />
        <DatePicker
          selected={endDate || null}
          onChange={(date: Date | null) => setEndDate(date ?? undefined)}
          selectsEnd
          startDate={startDate || undefined}
          endDate={endDate || undefined}
        />
      </div>
      <div>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <LinePairGrid lines={lines} pairs={pairs} />
        )}
      </div>
    </div>
  );
};

export default LineCombinationPage;
