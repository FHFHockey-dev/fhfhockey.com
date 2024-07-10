// import { useRef, useEffect } from "react";
// import usePercentileRank from "hooks/usePercentileRank";
// import Chart from "chart.js";

// const WGORadarChart = ({ playerStats }) => {
//   const chartRef = useRef(null);

//   useEffect(() => {
//     if (chartRef.current && playerStats) {
//       const ctx = chartRef.current.getContext("2d");

//       console.log(usePercentileRank);

//       // Calculate percentile ranks here using your custom hook
//       const percentileRanks = {
//         points: usePercentileRank(playerStats.points),
//         goals: usePercentileRank(playerStats.goals),
//         assists: usePercentileRank(playerStats.assists),
//         shots: usePercentileRank(playerStats.shots),
//         hits: usePercentileRank(playerStats.hits),
//       };

//       const data = {
//         labels: ["Points", "Goals", "Assists", "Shots", "Hits"],
//         datasets: [
//           {
//             label: "Percentile Ranks",
//             data: [
//               percentileRanks.points,
//               percentileRanks.goals,
//               percentileRanks.assists,
//               percentileRanks.shots,
//               percentileRanks.hits,
//             ],
//             fill: true,
//             backgroundColor: "rgba(135, 206, 235, 0.2)",
//             borderColor: "rgb(0, 191, 255)",
//             pointBackgroundColor: "rgb(0, 191, 255)",
//             pointBorderColor: "#fff",
//             pointHoverBackgroundColor: "#fff",
//             pointHoverBorderColor: "rgb(0, 191, 255)",
//           },
//         ],
//       };

//       const options = {
//         scales: {
//           r: {
//             angleLines: {
//               display: false,
//             },
//             suggestedMin: 0,
//             suggestedMax: 100,
//           },
//         },
//         elements: {
//           line: {
//             borderWidth: 3,
//           },
//         },
//       };

//       new Chart(ctx, {
//         type: "radar",
//         data: data,
//         options: options,
//       });
//     }
//   }, [playerStats]);

//   return <canvas ref={chartRef}></canvas>;
// };

// export default WGORadarChart;
