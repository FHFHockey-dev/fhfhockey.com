import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import styles from "pages/sustainabilityTool.module.scss";

const PlayerGameScoreLineChart = ({ gameScores }) => {
  const chartInstanceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !gameScores || gameScores.length === 0) return;

    const ctx = canvasRef.current.getContext("2d");

    // Format dates to M/D format
    const formattedDates = gameScores.map((gs) => {
      const date = new Date(gs.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: formattedDates,
        datasets: [
          {
            label: "Game Score",
            data: gameScores.map((gs) => gs.gameScore),
            fill: false,
            borderColor: "#2B90ED",
            backgroundColor: "#2B90ED",
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            display: true,
            min: -3,
            max: 5,
            ticks: {
              display: false,
              stepSize: 1, // Ensure a tick at every integer
            },
            grid: {
              color: "white", // Set grid lines to white
              drawBorder: false, // Hide the axis border if desired
              drawOnChartArea: true, // Draw grid lines on the chart area
              lineWidth: 0.5, // Set the thickness of the grid lines
            },
            title: {
              display: false,
              text: "Game Score",
            },
          },
          x: {
            title: {
              display: false,
              text: "Date",
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 82,
            },
            grid: {
              color: "white", // Set x-axis grid lines to white
              lineWidth: 0.5, // Set the thickness of the grid lines
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
          datalabels: {
            display: false,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [gameScores]);

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.yAxisLabel}>
        <div className={styles.yAxisLabelTitle}>Game Score</div>
        <div className={styles.yAxisLabelValues}>
          <span className={styles.top}>5</span>
          <span className={styles.middle}>0</span>
          <span className={styles.bottom}>-3</span>
        </div>
      </div>

      <div className={styles.chartAreaWrapper}>
        <canvas ref={canvasRef} style={{ height: "100%" }}></canvas>
      </div>
    </div>
  );
};

export default PlayerGameScoreLineChart;
