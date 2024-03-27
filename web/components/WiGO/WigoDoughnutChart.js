import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(ChartDataLabels);

const WigoDoughnutChart = ({ stats }) => {
  const chartRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!stats || !ctxRef.current) return;

    const ctx = ctxRef.current.getContext("2d");

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const playerStats = stats[0]; // stats is an array and we need the first object

    // Calculate the assist ratio
    const primaryAssists = playerStats.total_primary_assists;
    const secondaryAssists = playerStats.total_secondary_assists;

    // Calculate the total peripherals and their percentages
    const totalPeripherals =
      playerStats.blocked_shots + playerStats.hits + playerStats.shots;
    const blockPercentage =
      (playerStats.blocked_shots / totalPeripherals) * 100;
    const hitPercentage = (playerStats.hits / totalPeripherals) * 100;
    const shotsPercentage = (playerStats.shots / totalPeripherals) * 100;

    // Calculate PDO (you need to adjust this according to your data)
    const pdo =
      playerStats.shooting_percentage +
      (playerStats.skater_save_pct_5v5 || 0) * 100;
    const notPdo = 100 - pdo;

    // Use zone start percentage from the player stats
    const oZoneStartPct = playerStats.zone_start_pct * 100;
    const notOZoneStartPct = 100 - oZoneStartPct;

    // Define the labels for each dataset
    const datasetLabels = {
      peripherals: ["BLK", "HIT", "SH"],
      performance: ["A1", "A2"],
      pdo: ["SH%", "SV%"],
      oZoneStart: ["OZS%", "Other"],
    };

    chartRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          "Block",
          "Hit",
          "Shot",
          "Primary Assist",
          "Secondary Assist",
          "PDO",
          "OZS",
        ],

        datasets: [
          {
            label: "Peripherals",
            data: [blockPercentage, hitPercentage, shotsPercentage],
            backgroundColor: ["#022B3A", "#145787", "#2683d3"],
            borderWidth: 0.5,
          },
          {
            label: "Assist Ratio",
            data: [primaryAssists, secondaryAssists],
            backgroundColor: ["#222222", "#FFE74C"],
            borderWidth: 0.5,
          },
          {
            label: "PDO",
            data: [pdo, notPdo],
            backgroundColor: ["#BCE7FD", "#424B54"],
            borderWidth: 0.5,
          },
          {
            label: "Zone Start %",
            data: [oZoneStartPct, notOZoneStartPct],
            backgroundColor: ["#334E68", "#FFD700 "],
            borderWidth: 0.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "20%",
        plugins: {
          legend: {
            position: "", // Move legend to the left
            labels: {
              font: {
                family: "Roboto Condensed", // legend font
              },
            },
          },
          datalabels: {
            color: "#fff",
            anchor: "center",
            align: "center",
            font: {
              size: 12,
              family: "Roboto Condensed", // data labels font
              weight: "bold",
            },
            formatter: (value, context) => {
              const datasetIndex = context.datasetIndex;
              const dataIndex = context.dataIndex;
              const labelSets = Object.values(datasetLabels);
              const label = labelSets[datasetIndex][dataIndex];
              return label;
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [stats]);

  return (
    <div style={{ width: "100%", height: "100%", padding: "5px" }}>
      <canvas
        ref={ctxRef}
        id="doughnutChart"
        style={{ width: "100%", height: "100%" }}
      ></canvas>
    </div>
  );
};

export default WigoDoughnutChart;
