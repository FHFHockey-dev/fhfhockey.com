import React, { useRef, useEffect } from "react";
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

// Register the components
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const DoughnutChart = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null); // Ref to store the chart instance

  useEffect(() => {
    const myChartRef = chartRef.current.getContext("2d");

    if (chartInstance.current) {
      chartInstance.current.destroy(); // Destroy the existing chart
    }

    if (myChartRef && data) {
      // Make sure the data is available
      chartInstance.current = new Chart(myChartRef, {
        type: "doughnut",
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: true, // Now it's true to maintain aspect ratio of the whole canvas
          aspectRatio: 3 / 1, // Adjust based on your need, but it affects whole canvas
          plugins: {
            legend: {
              position: "left",
              align: "start",
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                padding: 7,
                font: {
                  size: 11, // Set the font size here
                  family: " 'roboto condensed', sans-serif",
                },
              },
            },
          },
          layout: {
            padding: {
              // Add padding to reduce effective chart area, thus increasing chart size
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          },
          cutout: "30%", // Adjust the cutout percentage to make doughnut thicker or thinner
        },
      });
    }

    // Cleanup function to destroy chart instance on component unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]); // Re-render the chart if the data changes

  return <canvas ref={chartRef} />;
};

export default DoughnutChart;
