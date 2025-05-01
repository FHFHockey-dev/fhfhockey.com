import React, { useEffect, useRef, useState } from "react";
import Fetch from "lib/cors-fetch";
import * as d3 from "d3";
import styles from "./GamePoissonChart.module.scss"; // Import the SCSS module

// --- Helper Functions (Keep as they are) ---
const poissonProbability = (lambda, k) => {
  if (lambda <= 0) return 0;
  if (k < 0) return 0;
  const fact = factorial(k);
  // Avoid division by zero or Infinity if factorial calculation failed
  if (fact === Infinity || fact === 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
};

const factorial = (num) => {
  if (num < 0) return Infinity;
  if (num === 0 || num === 1) return 1;
  // Add a limit to prevent excessive calculation/potential Infinity for large numbers
  if (num > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= num; i++) {
    result *= i;
  }
  return result;
};

const PoissonDistributionChart = ({ chartData }) => {
  const svgRef = useRef();
  const [homeWinProb, setHomeWinProb] = useState(0);
  const [awayWinProb, setAwayWinProb] = useState(0);
  const [prediction, setPrediction] = useState("");
  const [otPrediction, setOtPrediction] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("PDC useEffect triggered. chartData:", chartData);

    const isChartDataValid =
      chartData &&
      chartData.length === 2 &&
      chartData[0]?.team &&
      chartData[1]?.team &&
      chartData[0]?.homeExpectedGoals != null && // Check for null/undefined explicitly
      chartData[1]?.awayExpectedGoals != null &&
      chartData[0]?.homeExpectedGoals > 0 && // Ensure > 0 for Poisson lambda
      chartData[1]?.awayExpectedGoals > 0;

    if (!isChartDataValid) {
      setIsLoading(true);
      console.log(
        "PDC useEffect: Chart data not ready, insufficient, or invalid (e.g., xG <= 0). Waiting..."
      );
      d3.select(svgRef.current).selectAll("*").remove();
      d3.select("body").select(`.${styles.tooltip}`).remove();
      // Reset states if data becomes invalid
      setPrediction("");
      setOtPrediction("");
      setHomeWinProb(0);
      setAwayWinProb(0);
      return;
    }

    setIsLoading(false);

    const homeLambda = chartData[0].homeExpectedGoals;
    const awayLambda = chartData[1].awayExpectedGoals;
    const homeTeamName = chartData[0].team;
    const awayTeamName = chartData[1].team;

    let heatmapData = [];
    let homeWins = 0,
      awayWins = 0,
      draws = 0;

    // --- Find Key Outcomes in One Pass ---
    // Initialize with impossible values/scores
    let overallMostLikely = { x: -1, y: -1, value: -Infinity }; // Absolute highest probability outcome
    let nonDrawMostLikely = { x: -1, y: -1, value: -Infinity }; // Highest probability outcome where x != y
    let drawMostLikely = { x: -1, y: -1, value: -Infinity }; // Highest probability outcome where x == y

    for (let i = 0; i <= 10; i++) {
      // Home Score (y-axis)
      for (let j = 0; j <= 10; j++) {
        // Away Score (x-axis)
        const homeProb = poissonProbability(homeLambda, i);
        const awayProb = poissonProbability(awayLambda, j);
        const outcomeProb = homeProb * awayProb;

        // Skip negligible probabilities to avoid clutter and potential floating point issues near zero
        if (outcomeProb < 1e-9) continue;

        const currentOutcome = { x: j, y: i, value: outcomeProb };
        heatmapData.push(currentOutcome);

        // Update aggregate win/draw/loss probabilities
        if (i > j) homeWins += outcomeProb;
        else if (j > i) awayWins += outcomeProb;
        else draws += outcomeProb;

        // --- Update Most Likely Outcomes ---
        // 1. Check for Overall Most Likely
        if (currentOutcome.value > overallMostLikely.value) {
          overallMostLikely = currentOutcome;
        }

        // 2. Check for Most Likely Non-Draw
        if (i !== j && currentOutcome.value > nonDrawMostLikely.value) {
          nonDrawMostLikely = currentOutcome;
        }

        // 3. Check for Most Likely Draw (useful for display text later)
        if (i === j && currentOutcome.value > drawMostLikely.value) {
          drawMostLikely = currentOutcome;
        }
      }
    }

    // --- Normalization and Adjusted Win Probabilities ---
    const totalProb = homeWins + awayWins + draws;
    // Only normalize if the total is significantly different from 1 and greater than 0
    if (totalProb > 1e-6 && Math.abs(1 - totalProb) > 0.01) {
      console.warn(
        `Total probability (${totalProb}) is not close to 1. Normalizing win/draw/loss probabilities.`
      );
      const scaleFactor = 1 / totalProb;
      homeWins *= scaleFactor;
      awayWins *= scaleFactor;
      draws *= scaleFactor; // Normalize draws too for consistency if needed elsewhere
    }

    const totalWinsProb = homeWins + awayWins; // Denominator for adjusted win %
    // Handle division by zero if only draws are possible (or all probabilities are zero)
    const adjustedHomeWinProb =
      totalWinsProb > 1e-9 ? (homeWins / totalWinsProb) * 100 : 50; // Default to 50/50 if no wins
    const adjustedAwayWinProb =
      totalWinsProb > 1e-9 ? (awayWins / totalWinsProb) * 100 : 50;

    setHomeWinProb(adjustedHomeWinProb.toFixed(2));
    setAwayWinProb(adjustedAwayWinProb.toFixed(2));

    // --- Set Prediction Text Based on New Logic ---
    let finalPrediction = "";
    let finalOtPrediction = "";

    // Check if we found any likely outcome at all
    if (overallMostLikely.value <= 1e-9) {
      finalPrediction = "Prediction unavailable (probabilities too low).";
      finalOtPrediction = "";
    } else {
      const otWinner =
        adjustedHomeWinProb > adjustedAwayWinProb ? homeTeamName : awayTeamName;

      // *** Core Logic: Is the absolute MOST likely outcome a draw? ***
      if (overallMostLikely.x === overallMostLikely.y) {
        // YES, the highest probability outcome IS a draw.
        // The main prediction should show the MOST LIKELY *NON*-DRAW score.
        if (nonDrawMostLikely.value > 1e-9) {
          // Check if a valid non-draw outcome was found
          finalPrediction = `Model Prediction: | ${homeTeamName} | ${nonDrawMostLikely.y} - ${nonDrawMostLikely.x} | ${awayTeamName} |`;
          // The OT prediction explains that the draw was most likely overall
          // Use drawMostLikely here as overallMostLikely *is* the most likely draw
          finalOtPrediction = `(Most likely: Draw ${drawMostLikely.y}-${drawMostLikely.x}, favoring ${otWinner} in OT/SO)`;
        } else {
          // Edge Case: Only draws have significant probability. Show the most likely draw.
          finalPrediction = `Model Prediction: Draw ${drawMostLikely.y}-${drawMostLikely.x}`;
          finalOtPrediction = `(Favoring ${otWinner} in OT/SO)`;
        }
      } else {
        // NO, the highest probability outcome is NOT a draw.
        // Display this non-draw outcome as the main prediction.
        finalPrediction = `Model Prediction: | ${homeTeamName} | ${overallMostLikely.y} - ${overallMostLikely.x} | ${awayTeamName} |`;
        finalOtPrediction = ""; // No need for OT text if the primary prediction isn't a draw
      }
    }

    setPrediction(finalPrediction);
    setOtPrediction(finalOtPrediction);

    // --- D3 Drawing Code ( Largely Unchanged ) ---
    const margin = { top: 50, right: 30, bottom: 70, left: 70 };
    const width = 500 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("class", styles.chartSvg) // Use SCSS module class
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    svg.selectAll("*").remove(); // Clear previous SVG content

    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Scales ---
    const maxScore = 10; // Keep consistent with loop limit
    const scoreDomain = d3.range(maxScore + 1); // 0 to 10

    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(scoreDomain)
      .padding(0.05);

    const y = d3
      .scaleBand()
      .range([height, 0])
      .domain(scoreDomain)
      .padding(0.05);

    // --- Axes ---
    chartGroup
      .append("g")
      .attr("class", styles.xAxis) // Apply module class
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain")
      .remove();

    chartGroup
      .append("g")
      .attr("class", styles.yAxis) // Apply module class
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain")
      .remove();

    // --- Color Scale ---
    // Use max probability *found* in the data, or a small default if none found
    const maxProb =
      heatmapData.length > 0 ? d3.max(heatmapData, (d) => d.value) : 1e-9;
    const myColor = d3
      .scaleSequential(d3.interpolateBlues)
      // Ensure domain doesn't start and end at the same point if maxProb is 0
      .domain([0, maxProb > 0 ? maxProb : 1e-9]);

    // --- Tooltip ---
    d3.select("body").select(`.${styles.tooltip}`).remove(); // Ensure cleanup
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", styles.tooltip) // Use module class
      .style("opacity", 0); // Start hidden

    // --- Mouse Event Handlers ---
    const mouseover = function (event, d) {
      tooltip.style("opacity", 1);
      d3.select(this)
        .style("stroke", "black")
        .style("stroke-width", 2)
        .style("opacity", 1);
    };
    const mousemove = function (event, d) {
      tooltip
        .html(
          `Score: ${homeTeamName} ${d.y} - ${
            d.x
          } ${awayTeamName}<br>Probability: ${(d.value * 100).toFixed(2)}%`
        )
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 30 + "px");
    };
    const mouseleave = function (event, d) {
      tooltip.style("opacity", 0);
      d3.select(this)
        .style("stroke", "#808080") // Match SCSS or default
        .style("stroke-width", 1) // Match SCSS or default
        .style("opacity", 0.8); // Match SCSS or default
    };

    // --- Draw Rectangles ---
    chartGroup
      .selectAll("rect")
      .data(heatmapData, (d) => `${d.x}:${d.y}`) // Key function for object constancy
      .join("rect") // Enter-update-exit pattern
      .attr("x", (d) => x(d.x))
      .attr("y", (d) => y(d.y))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", (d) => myColor(d.value))
      .attr("rx", 4) // Example: Rounded corners (or move to SCSS)
      .attr("ry", 4) // Example: Rounded corners (or move to SCSS)
      .style("stroke-width", 1) // Base style (or move to SCSS)
      .style("stroke", "#808080") // Base style (or move to SCSS)
      .style("opacity", 0.8) // Base style (or move to SCSS)
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave);

    // --- Labels and Title ---
    chartGroup
      .append("text")
      .attr("class", styles.axisLabel) // Use module class
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 20) // Adjusted position
      .style("text-anchor", "middle")
      .text(`${awayTeamName} Goals`);

    chartGroup
      .append("text")
      .attr("class", styles.axisLabel) // Use module class
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 15) // Adjusted position
      .attr("x", 0 - height / 2)
      .style("text-anchor", "middle")
      .text(`${homeTeamName} Goals`);

    chartGroup
      .append("text")
      .attr("class", styles.chartTitle) // Use module class
      .attr("x", width / 2)
      .attr("y", 0 - margin.top / 2) // Adjusted position
      .style("text-anchor", "middle")
      .text(`Predicted Score Probability Distribution`);

    // --- Effect Cleanup ---
    return () => {
      // Remove the tooltip specific to this component instance when it unmounts
      tooltip.remove();
    };
  }, [chartData]); // Dependency array

  // --- Render Logic ---
  if (isLoading) {
    return <div className={styles.loadingMessage}>Loading Chart data...</div>;
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.predictionValues}>
        {/* Display the determined prediction */}
        <div className={styles.predictionText}>{prediction}</div>

        {/* Win Probability Displays */}
        <div className={styles.winProbabilityBox}>
          {chartData?.[0]?.logo && (
            <img
              src={chartData[0].logo}
              alt={`${chartData[0].team} logo`}
              className={styles.teamLogo}
            />
          )}
          {`${chartData?.[0]?.team || "Home"} Win%: ${homeWinProb}%`}{" "}
          {/* Add fallback text */}
        </div>
        <div className={styles.winProbabilityBox}>
          {chartData?.[1]?.logo && (
            <img
              src={chartData[1].logo}
              alt={`${chartData[1].team} logo`}
              className={styles.teamLogo}
            />
          )}
          {`${chartData?.[1]?.team || "Away"} Win%: ${awayWinProb}%`}{" "}
          {/* Add fallback text */}
        </div>

        {/* Display OT/SO prediction/context only if it's populated */}
        {otPrediction && (
          <div className={styles.otPredictionText}>{otPrediction}</div>
        )}
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default PoissonDistributionChart;
