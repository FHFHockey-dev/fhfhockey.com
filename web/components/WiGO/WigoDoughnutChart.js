import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(ChartDataLabels);

const WigoDoughnutChart = ({ gameCategories, pointsDistributionData }) => {
  const chartRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    // Check if all necessary data is present before initializing the chart
    if (
      !ctxRef.current ||
      !gameCategories ||
      !pointsDistributionData ||
      Object.keys(gameCategories).length === 0 ||
      pointsDistributionData.length === 0
    ) {
      return;
    }

    const ctx = ctxRef.current.getContext("2d");
    chartRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          "Elite",
          "Great",
          "Good",
          "Average",
          "Bad",
          "Abysmal",
          ...pointsDistributionData.map((pd) => `${pd.value}pt Gms`),
        ],
        datasets: [
          {
            label: "# of Games",
            data: [
              gameCategories.Elite,
              gameCategories.Great,
              gameCategories.Good,
              gameCategories.Average,
              gameCategories.Bad,
              gameCategories.Abysmal,
            ],
            backgroundColor: [
              "#2B90ED",
              "#4FA9DD",
              "#7CC47C",
              "#FFEB3B",
              "#FFA500",
              "#E23F07",
            ],
            borderWidth: 2,
            datalabels: {
              anchor: "center",
              backgroundColor: "#202020",
              borderColor: "white",
              borderRadius: 20,
              borderWidth: 2,
              color: "white",
              display: function (context) {
                var dataset = context.dataset;
                var count = dataset.data.length;
                var value = dataset.data[context.dataIndex];
                return value > count * 0.5;
              },
              font: {
                weight: "bold",
              },
              padding: 6,
              formatter: Math.round,
            },
          },

          {
            label: "Games at Point Total",
            data: pointsDistributionData.map((pd) => pd.value),
            backgroundColor: [
              "#E9F2FC", // 0pt Gms
              "#B1CDED", // 1pt Gms
              "#77ABE1", // 2pt Gms
              "#3D89D5", // 3pt Gms
              "#1B67B2", // 4pt Gms
              "#13497E", // 5pt Gms
              "#0B2B4A", // 6pt Gms
              "#030D16", // 7pt Gms
            ],
            borderWidth: 2,
            datalabels: {
              anchor: "start",
              align: "center",
              offset: 10,
              backgroundColor: "#202020",
              borderColor: "white",
              borderRadius: 20,
              borderWidth: 2,
              color: "white",
              font: {
                weight: "bold",
              },
              display: function (context) {
                var dataset = context.dataset;
                var count = dataset.data.length;
                var value = dataset.data[context.dataIndex];
                return value > count * 0.75;
              },
              padding: 5,
              formatter: Math.round,
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1,
        cutout: "50%",
        animation: {
          animateScale: true,
          animateRotate: true,
        },
        plugins: {
          legend: {
            display: false,
          },
          datalabels: {
            color: "#fff", // Global setting for labels; can be overridden by individual datasets
          },
        },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          callbacks: {
            label: (toolTipItem, data) => {
              let i = toolTipItem.index;
              return (
                data.datasets[toolTipItem.datasetIndex].labels[i] +
                ": " +
                toolTipItem.formattedValue
              );
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [gameCategories, pointsDistributionData]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <canvas
        ref={ctxRef}
        id="doughnutChart"
        style={{ width: "100%", height: "100%", padding: "3px" }}
      ></canvas>
    </div>
  );
};

export default WigoDoughnutChart;
