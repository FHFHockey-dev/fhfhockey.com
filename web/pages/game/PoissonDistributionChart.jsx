import React, { useEffect, useRef, useState } from "react";
import Fetch from "lib/cors-fetch";
import * as d3 from "d3";

// Poisson Probability Function
const poissonProbability = (lambda, k) => {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
};

// Factorial Function
const factorial = (num) => {
  if (num === 0 || num === 1) return 1;
  let result = 1;
  for (let i = 2; i <= num; i++) {
    result *= i;
  }
  return result;
};

const PoissonDistributionChart = ({ chartData }) => {
  const svgRef = useRef();
  const [leagueAverages, setLeagueAverages] = useState({});
  const [prediction, setPrediction] = useState("");
  const [homeWinProb, setHomeWinProb] = useState(0);
  const [awayWinProb, setAwayWinProb] = useState(0);
  const [otPrediction, setOtPrediction] = useState(""); // Added for overtime prediction
  const [isLoading, setIsLoading] = useState(true); // State to manage loading status

  useEffect(() => {
    const fetchLeagueData = async () => {
      // Early exit if chartData is not ready, but handle isLoading state outside
      if (!chartData || chartData.length < 2) {
        setIsLoading(true); // Ensure loading state is true if data is not ready
        return;
      }

      setIsLoading(true); // Set loading true when starting to fetch data

      try {
        const today = new Date().toISOString().slice(0, 10); // Gets today's date in "YYYY-MM-DD" format
        const standingsUrl = `https://api-web.nhle.com/v1/standings/${today}`;

        try {
          const standingsResponse = await Fetch(standingsUrl).then((res) =>
            res.json()
          );

          const { standings } = standingsResponse;
          if (!standings || standings.length === 0) {
            console.error("Standings data is empty or not available.");
            setIsLoading(false); // Stop loading if data is empty
            return;
          }

          console.log("Standings data:", standings);

          const seasonId = standings[0].seasonId; // Assume same seasonId for all teams
          const numberOfTeams = standings.length; // Define numberOfTeams based on the standings length

          // Initialize sums for each stat category
          let sums = {
            gamesPlayed: 0,
            goalDifferential: 0,
            goalDifferentialPctg: 0,
            goalAgainst: 0,
            goalFor: 0,
            goalsForPctg: 0,
            homeGamesPlayed: 0,
            homeGoalDifferential: 0,
            homeGoalsAgainst: 0,
            homeGoalsFor: 0,
            homeLosses: 0,
            homeOtLosses: 0,
            homePoints: 0,
            homeRegulationPlusOtWins: 0,
            homeRegulationWins: 0,
            homeWins: 0,
            l10GamesPlayed: 0,
            l10GoalDifferential: 0,
            l10GoalsAgainst: 0,
            l10GoalsFor: 0,
            l10Losses: 0,
            l10OtLosses: 0,
            l10Points: 0,
            l10RegulationPlusOtWins: 0,
            l10RegulationWins: 0,
            l10Wins: 0,
            losses: 0,
            otLosses: 0,
            pointPctg: 0,
            points: 0,
            regulationPlusOtWinPctg: 0,
            regulationPlusOtWins: 0,
            regulationWinPctg: 0,
            regulationWins: 0,
            roadGamesPlayed: 0,
            roadGoalDifferential: 0,
            roadGoalsAgainst: 0,
            roadGoalsFor: 0,
            roadLosses: 0,
            roadOtLosses: 0,
            roadPoints: 0,
            roadRegulationPlusOtWins: 0,
            roadRegulationWins: 0,
            roadWins: 0,
            shootoutLosses: 0,
            shootoutWins: 0,
            winPctg: 0,
            wins: 0,
          };

          // Loop through each team to sum up stats
          standings.forEach((team) => {
            // Sum up stats for each team
            Object.keys(sums).forEach((stat) => {
              if (typeof team[stat] !== "undefined") {
                sums[stat] += team[stat];
              }
            });
          });

          // Calculate averages by dividing each sum by the number of teams
          let averages = {};
          Object.keys(sums).forEach((stat) => {
            averages[stat] = sums[stat] / numberOfTeams;
          });
          // Second endpoint for additional stats
          const summaryUrl = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"teamId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameTypeId=2 and seasonId<=${seasonId} and seasonId>=${seasonId}`;
          const summaryResponse = await Fetch(summaryUrl).then((res) =>
            res.json()
          );
          const { data } = summaryResponse;

          // Extend sums object to include new stats
          sums.penaltyKillPct = 0;
          sums.powerPlayPct = 0;
          sums.shotsAgainstPerGame = 0;
          sums.shotsForPerGame = 0;

          data.forEach((team) => {
            sums.penaltyKillPct += team.penaltyKillPct;
            sums.powerPlayPct += team.powerPlayPct;
            sums.shotsAgainstPerGame += team.shotsAgainstPerGame;
            sums.shotsForPerGame += team.shotsForPerGame;
          });

          // Update averages object with new stats
          averages.penaltyKillPct = sums.penaltyKillPct / numberOfTeams;
          averages.powerPlayPct = sums.powerPlayPct / numberOfTeams;
          averages.shotsAgainstPerGame =
            sums.shotsAgainstPerGame / numberOfTeams;
          averages.shotsForPerGame = sums.shotsForPerGame / numberOfTeams;

          console.log("Updated League averages:", averages);

          setLeagueAverages(averages);
          setIsLoading(false); // Data is ready, stop loading.
        } catch (error) {
          console.error("Error fetching league data:", error);
        }
      } catch (error) {
        console.error("Error fetching league data:", error);
      }

      fetchLeagueData();

      const processData = () => {
        if (chartData.length < 2) {
          return { homeExpectedGoals: 0, awayExpectedGoals: 0 };
        }
        const homeExpectedGoals = chartData?.[0]?.goalsForPerGame ?? 0;
        const awayExpectedGoals = chartData?.[1]?.goalsForPerGame ?? 0;

        return { homeExpectedGoals, awayExpectedGoals };
      };

      const { homeExpectedGoals, awayExpectedGoals } = processData();

      // Initialize heatmapData for Poisson probabilities
      let heatmapData = [];
      for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
          const homeProb = poissonProbability(chartData[0].goalsForPerGame, i);
          const awayProb = poissonProbability(chartData[1].goalsForPerGame, j);
          heatmapData.push({ x: i, y: j, value: homeProb * awayProb });
        }
      }

      // Setup SVG
      const margin = { top: 50, right: 30, bottom: 70, left: 70 };
      const width = 600 - margin.left - margin.right;
      const height = 600 - margin.top - margin.bottom;

      // Calculate win probabilities excluding draws
      let homeWins = 0;
      let awayWins = 0;
      let draws = 0;
      heatmapData.forEach(({ x, y, value }) => {
        if (x > y) homeWins += value;
        else if (y > x) awayWins += value;
        else draws += value; // Count draws separately
      });

      // Adjust probabilities for home and away wins to account for draws
      const totalWins = homeWins + awayWins;
      const adjustedHomeWinProb = (homeWins / totalWins) * 100;
      const adjustedAwayWinProb = (awayWins / totalWins) * 100;

      // Update state with adjusted probabilities
      setHomeWinProb(adjustedHomeWinProb.toFixed(2));
      setAwayWinProb(adjustedAwayWinProb.toFixed(2));

      // Dynamic team names from chartData
      const homeTeamName = chartData[0]?.team || "Home Team";
      const awayTeamName = chartData[1]?.team || "Away Team";

      // Determine the most likely outcome and consider OT prediction
      let mostLikelyOutcome = { x: 0, y: 0, value: 0 };
      let highestDrawValue = 0;
      heatmapData.forEach((outcome) => {
        if (outcome.x === outcome.y && outcome.value > highestDrawValue) {
          highestDrawValue = outcome.value;
        } else if (outcome.value > mostLikelyOutcome.value) {
          mostLikelyOutcome = outcome;
        }
      });

      // Update prediction text
      const predictionText = ` Model-Bot Prediction: | ${homeTeamName} | ${mostLikelyOutcome.x}-${mostLikelyOutcome.y} | ${awayTeamName} |`;
      setPrediction(predictionText);

      // Handle OT prediction for draws
      if (highestDrawValue > mostLikelyOutcome.value) {
        // If the highest draw probability is greater than the most likely outcome's probability
        const otWinner =
          adjustedHomeWinProb > adjustedAwayWinProb
            ? homeTeamName
            : awayTeamName;
        setOtPrediction(`${otWinner} wins in OT`);
      } else {
        setOtPrediction(""); // Clear OT prediction if not applicable
      }

      // Select the SVG if it exists or append it if not, set its attributes
      const svg = d3
        .select(svgRef.current)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      svg.selectAll("*").remove(); // Clear previous SVG content

      // Build X scales and axis:
      const x = d3
        .scaleBand()
        .range([0, width])
        .domain(d3.range(11)) // 0 to 10 for scores
        .padding(0.1); // Increased padding for gaps

      svg
        .append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

      // Build Y scales and axis:
      const y = d3
        .scaleBand()
        .range([height, 0])
        .domain(d3.range(11))
        .padding(0.1);

      svg.append("g").call(d3.axisLeft(y));

      // Build color scale
      const myColor = d3
        .scaleSequential()
        .interpolator(d3.interpolateRgb("#101010", "#07aae2"))
        .domain([0, d3.max(heatmapData, (d) => d.value)]);

      // Create the heatmap
      svg
        .selectAll()
        .data(heatmapData, function (d) {
          return d.x + ":" + d.y;
        })
        .enter()
        .append("rect")
        .attr("x", function (d) {
          return x(d.x);
        })
        .attr("y", function (d) {
          return y(d.y);
        })
        .attr("rx", 4) // Optional: for rounded corners
        .attr("ry", 4) // Optional: for rounded corners
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", function (d) {
          return myColor(d.value);
        })
        .style("stroke", "#808080") // Add white border
        .style("stroke-width", "1px");

      // Add text labels
      svg
        .selectAll()
        .data(heatmapData, function (d) {
          return d.x + ":" + d.y;
        })
        .enter()
        .append("text")
        .text(function (d) {
          return `${(d.value * 100).toFixed(1)}%`;
        })
        .attr("x", function (d) {
          return x(d.x) + x.bandwidth() / 2;
        })
        .attr("y", function (d) {
          return y(d.y) + y.bandwidth() / 2;
        })
        .style("text-anchor", "middle")
        .attr("alignment-baseline", "central")

        .style("fill", function (d) {
          return d.value > 0.5 ? "#ccc" : "#CCC";
        })
        .style("font-family", "Helvetica")
        .style("font-weight", "bold")
        .style("font-size", "12px"); // Smaller font size

      // Add X axis label
      svg
        .append("text")
        .attr("text-anchor", "end")
        .attr("x", width / 2 + margin.left)
        .attr("y", height + margin.top + 20)
        .text(chartData[1].team) // Away team name for X axis
        .style("font-family", "Helvetica")
        .style("font-size", "16px")
        .style("fill", "white"); // Make the text white

      // Add Y axis label
      svg
        .append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2 + margin.top)
        .text(chartData[0].team) // Home team name for Y axis
        .style("font-family", "Helvetica")
        .style("font-size", "16px")
        .style("fill", "white"); // Make the text white

      if (chartData && chartData.length >= 2) {
        fetchLeagueData();
      } else {
        // Handle case where chartData is not sufficient
        setIsLoading(false); // You might want to set isLoading to false here as well, or handle the condition appropriately
      }
    };
  }, [chartData]);

  if (isLoading) {
    return <div>Loading Chart data...</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "20px",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderRadius: "5px",
        padding: "10px",
      }}
    >
      <div
        className="predictionValues"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            marginTop: "20px",
            width: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "5px",
            padding: "10px",
            margin: "10px",
          }}
        >
          {prediction}
        </div>
        <div
          style={{
            height: "3.5em",
            width: "100%",
            justifyContent: "space-around",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "5px",
            padding: "10px",
            margin: "10px",
          }}
        >
          <img
            src={chartData[0].logo}
            alt={chartData[0].team}
            style={{ width: "50px" }}
          />
          {chartData[0].team} Win Probability: {homeWinProb}%
        </div>
        <div
          style={{
            height: "3.5em",
            width: "100%",
            justifyContent: "space-around",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "5px",
            padding: "10px",
            margin: "10px",
          }}
        >
          <img
            src={chartData[1].logo}
            alt={chartData[1].team}
            style={{ width: "50px" }}
          />
          {chartData[1].team} Win Probability: {awayWinProb}%
        </div>
        {otPrediction && <div style={{ marginTop: "5px" }}>{otPrediction}</div>}
      </div>
      <svg
        ref={svgRef}
        style={{
          alignSelf: "center",
          marginTop: "20px",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "5px",
          padding: "10px",
          margin: "10px",
          width: "625px",
          height: "625px",
        }}
      ></svg>
    </div>
  );
};

export default PoissonDistributionChart;
