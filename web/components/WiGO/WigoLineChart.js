import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const WigoLineChart = ({ stats }) => {
  const chartRef = useRef(null); // Ref to store the chart instance
  const ctxRef = useRef(null); // Ref for the canvas context

  useEffect(() => {
    if (!ctxRef.current) return; // Ensure the ref is set

    const ctx = ctxRef.current.getContext("2d");

    if (chartRef.current) {
      chartRef.current.destroy(); // Destroy the previous instance of the chart
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}`; // Convert to M/D format
    };

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: stats ? stats.map((s) => formatDate(s.date)) : [],
        datasets: [
          {
            label: "PT/GM",
            data: stats ? stats.map((s) => s.points_per_game) : [],
            fill: true,
            backgroundColor: "rgba(31, 61, 78, 0.3)",
            borderColor: "#05221d",
            pointRadius: 0,
            tension: 0,
            yAxisID: "y",
          },
          {
            label: "PP%",
            data: stats ? stats.map((s) => s.pp_toi_pct_per_game * 100) : [], // Convert decimal to percentage
            fill: true,
            backgroundColor: "rgba(28, 119, 210, 0.3)",
            borderColor: "#1c77d2",
            pointRadius: 0,
            tension: 0,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        plugins: {
          tooltip: {
            enabled: true, // Disable tooltips
          },
          legend: {
            display: true, // can be toggled to false to hide the legend
            position: "top", // can be 'top', 'left', 'bottom', 'right'
            labels: {
              color: "#223d4e",
              font: {
                size: 12, // Adjust font size as needed
                family: "Roboto condensed", // Set the font family for the legend
                weight: "bold",
              },
            },
          },
          datalabels: {
            display: false, // Disable datalabels if you are using the datalabels plugin
          },
        },
        layout: {
          padding: {
            top: 5,
            bottom: 5,
            left: 10,
            right: 10,
          },
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: "#223d4e", // Example tick label color
              font: {
                size: 10, // Example tick label font size
                family: "Roboto condensed", // Example tick label font family
              },
            },
          },
          y: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            max: 10, // Assuming the max value for points_per_game is 10
            ticks: {
              color: "#223d4e", // Example tick label color
              font: {
                size: 10, // Example tick label font size
                family: "Roboto condensed", // Example tick label font family
              },
            },
          },
          y1: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            max: 100, // Assuming the max value for pp_toi_pct_per_game is 1 (or 100% after conversion)
            ticks: {
              color: "#223d4e", // Example tick label color
              font: {
                size: 10, // Example tick label font size
                family: "Roboto condensed", // Example tick label font family
              },
            },
          },
        },
      },
    });
    // Cleanup function to destroy chart on component unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [stats]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <canvas
        ref={ctxRef}
        id="myChart"
        style={{ width: "100%", height: "100%" }}
      ></canvas>
    </div>
  );
};

export default WigoLineChart;
