////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\PlayerPPTOIPerGameChart\PlayerPPTOIPerGameChart.tsx

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useRouter } from "next/router";
import supabase from "lib/supabase";
import styles from "styles/teamStats.module.scss";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  ChartData,
  ChartDataset,
  Plugin,
} from "chart.js";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface PlayerData {
  player_id: number;
  player_name: string;
  date: string;
  pp_toi_pct_per_game: number | null;
}

interface CustomDataPoint {
  x: number; // timestamp in milliseconds
  y: number; // pp_toi_pct_per_game
  rank: number;
}

const PlayerPPTOIPerGameChart: React.FC = () => {
  const router = useRouter();
  const { teamAbbreviation } = router.query;
  const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (teamAbbreviation) {
      fetchAllPlayerData(teamAbbreviation as string);
    }
  }, [teamAbbreviation]);

  const fetchAllPlayerData = async (abbreviation: string) => {
    let allData: PlayerData[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("sko_pp_stats")
        .select("player_id, player_name, date, pp_toi_pct_per_game")
        .eq("team_abbrev", abbreviation)
        .range(from, from + step - 1);

      if (error) {
        console.error("Error fetching player data:", error);
        break;
      }

      if (data.length === 0) break;

      allData = [...allData, ...data];

      if (data.length < step) break;

      from += step;
    }

    console.log(`Total records fetched: ${allData.length}`);
    processChartData(allData);
  };

  const processChartData = (data: PlayerData[]) => {
    console.log("Raw Data:", data);

    const playerDataMap = data.reduce(
      (acc: { [key: string]: PlayerData[] }, item: PlayerData) => {
        if (!acc[item.player_name]) {
          acc[item.player_name] = [];
        }
        acc[item.player_name].push(item);
        return acc;
      },
      {}
    );

    const allDates = Array.from(new Set(data.map((item) => item.date)))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .filter((date) =>
        Object.values(playerDataMap).some((playerData) =>
          playerData.some((d) => d.date === date)
        )
      );

    console.log("Organized Player Data:", playerDataMap);

    const datasets = Object.keys(playerDataMap).map((player) => {
      const playerData = playerDataMap[player]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .reduce((acc: { [key: string]: number }, item: PlayerData) => {
          acc[item.date] =
            item.pp_toi_pct_per_game !== null
              ? item.pp_toi_pct_per_game * 100
              : 0; // Assign a default value of 0 for null
          return acc;
        }, {});

      const dataPoints: CustomDataPoint[] = allDates
        .map((date) => {
          const y = playerData[date];
          if (y !== null) {
            return {
              x: new Date(date).getTime(),
              y,
              rank: getRank(date, playerDataMap, player),
            };
          }
          return null;
        })
        .filter((point) => point !== null) as CustomDataPoint[];

      return {
        label: player,
        data: dataPoints,
        fill: false,
        pointRadius: 0,
      } as ChartDataset<"line", CustomDataPoint[]>;
    });

    setChartData({
      datasets: datasets,
    });

    setLoading(false);
  };

  const getRank = (
    date: string,
    playerDataMap: { [key: string]: PlayerData[] },
    player: string
  ): number => {
    const playersOnDate = Object.keys(playerDataMap)
      .map((playerName) => {
        const playerData = playerDataMap[playerName].find(
          (d) => d.date === date
        );
        return {
          playerName,
          pp_toi_pct_per_game: playerData ? playerData.pp_toi_pct_per_game : 0,
        };
      })
      .sort(
        (a, b) => (b.pp_toi_pct_per_game || 0) - (a.pp_toi_pct_per_game || 0)
      );

    return playersOnDate.findIndex((p) => p.playerName === player) + 1;
  };

  const getLineColor = (dataPoints: CustomDataPoint[]): string[] => {
    return dataPoints.map((point) => {
      if (point.y >= 75) {
        return "#07aae2";
      } else if (point.y >= 50) {
        return "#116d8b";
      } else {
        return "#404040";
      }
    });
  };

  const handlePlayerToggle = (playerName: string) => {
    const updatedSelectedPlayers = new Set(selectedPlayers);
    if (selectedPlayers.has(playerName)) {
      updatedSelectedPlayers.delete(playerName);
    } else {
      updatedSelectedPlayers.add(playerName);
    }
    setSelectedPlayers(updatedSelectedPlayers);
  };

  const filteredDatasets =
    chartData?.datasets.filter((dataset) =>
      selectedPlayers.size > 0
        ? selectedPlayers.has(dataset.label as string)
        : true
    ) || [];

  if (loading) return <div>Loading...</div>;

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Player PP TOI % Per Game",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value}%`,
        },
      },
      x: {
        type: "time",
        time: {
          unit: "day",
          tooltipFormat: "yyyy-MM-dd",
          displayFormats: {
            day: "MMM d",
          },
        },
      },
    },
  };

  const variableLineColorPlugin: Plugin<"line"> = {
    id: "variableLineColor",
    beforeRender: (chart) => {
      const datasets = chart.data.datasets;
      datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        const points = meta.data as any[];
        const colors = (dataset.data as CustomDataPoint[]).map((point) => {
          if (point.y >= 75) {
            return "#07aae2";
          } else if (point.y >= 50) {
            return "#116d8b";
          } else {
            return "#404040";
          }
        });
        if (meta.dataset) {
          (meta.dataset as any).options.borderColor = colors;
        }
      });
    },
  };

  return (
    <div>
      <h2>PP TOI % Per Game</h2>
      <div>
        {chartData?.datasets.map((dataset) => (
          <label key={dataset.label}>
            <input
              type="checkbox"
              checked={selectedPlayers.has(dataset.label as string)}
              onChange={() => handlePlayerToggle(dataset.label as string)}
            />
            {dataset.label}
          </label>
        ))}
      </div>
      <div className={styles.chartWrapper}>
        <div className={styles.yAxisContainer}>
          <div className={styles.yAxisLabel}>PP TOI %</div>
          <div className={styles.yAxisTicks}>
            {[100, 80, 60, 40, 20, 0].map((tick) => (
              <div key={tick} className={styles.yAxisTick}>
                {tick}%
              </div>
            ))}
          </div>
        </div>
        <div className={styles.chartContainer}>
          <div className={styles.chartInnerContainer}>
            {chartData && (
              <Line
                data={{ ...chartData, datasets: filteredDatasets }}
                options={chartOptions}
                plugins={[variableLineColorPlugin]}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPPTOIPerGameChart;
