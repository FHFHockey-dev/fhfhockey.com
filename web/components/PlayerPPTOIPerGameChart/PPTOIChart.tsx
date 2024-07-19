import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import supabase from "web/lib/supabase";
import styles from "web/styles/teamStats.module.scss";

interface PlayerData {
  player_id: number;
  player_name: string;
  date: Date;
  pp_toi_pct_per_game: number;
}

interface PPTOIChartProps {
  teamAbbreviation: string;
}

const PPTOIChart: React.FC<PPTOIChartProps> = ({ teamAbbreviation }) => {
  const chartRef = useRef<SVGSVGElement>(null);
  const yAxisRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const width = 1000; // Hardcoded width
  const height = 500; // Hardcoded height
  const marginTop = 20;
  const marginRight = 100; // Increased right margin for labels
  const marginBottom = 30;
  const marginLeft = 40; // Adjusted margin

  useEffect(() => {
    if (teamAbbreviation) {
      fetchAllPlayerData(teamAbbreviation);
    }
  }, [teamAbbreviation]);

  useEffect(() => {
    if (teamAbbreviation) {
      fetchAllPlayerData(teamAbbreviation);
    }
  }, [selectedPlayers]);

  const fetchAllPlayerData = async (abbreviation: string) => {
    const allData: PlayerData[] = [];
    let from = 0;
    const pageSize = 1000;
    let data, error;

    do {
      ({ data, error } = await supabase
        .from("sko_pp_stats")
        .select("player_id, player_name, date, pp_toi_pct_per_game")
        .eq("current_team_abbreviation", abbreviation)
        .range(from, from + pageSize - 1));

      if (error) {
        console.error("Error fetching player data:", error);
        break;
      }

      if (data) {
        allData.push(...data);
        from += pageSize;
      }
    } while (data && data.length === pageSize);

    console.log("Fetched all data:", allData);
    setPlayers([...new Set(allData.map((d) => d.player_name))]); // Extract unique player names
    drawChart(allData);
  };

  const drawChart = (data: PlayerData[]) => {
    console.log("Drawing chart with data:", data);

    // Filter out invalid data points and selected players
    const validData = data.filter(
      (d) =>
        !isNaN(d.pp_toi_pct_per_game) &&
        d.pp_toi_pct_per_game !== null &&
        d.pp_toi_pct_per_game !== undefined &&
        (selectedPlayers.length === 0 ||
          selectedPlayers.includes(d.player_name))
    );

    // Group data by player and sort by date
    const playerDataMap = d3.group(validData, (d) => d.player_name);
    playerDataMap.forEach((values, key) => {
      values.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    const svg = d3.select(chartRef.current);
    const yAxisSvg = d3.select(yAxisRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove(); // Clear previous content
    yAxisSvg.selectAll("*").remove(); // Clear previous content

    const x = d3
      .scaleTime()
      .domain(d3.extent(validData, (d) => new Date(d.date)) as [Date, Date])
      .range([0, width - marginRight]); // Adjusted range to remove left margin

    const y = d3
      .scaleLinear()
      .domain([0, 1]) // Set domain to always scale from 0 to 1 (0% to 100%)
      .nice()
      .range([height - marginBottom, marginTop]);

    const lineSegment = (
      d1: PlayerData,
      d2: PlayerData,
      color: string,
      player: string
    ) => {
      svg
        .append("line")
        .attr("class", `line-segment ${player.replace(/\s+/g, "-")}`) // Add a class for each player's line
        .attr("x1", x(new Date(d1.date)))
        .attr("y1", y(d1.pp_toi_pct_per_game))
        .attr("x2", x(new Date(d2.date)))
        .attr("y2", y(d2.pp_toi_pct_per_game))
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .on("mouseover", function (event, d) {
          tooltip
            .html(
              `Player: ${d1.player_name}<br/>PP TOI %: ${(
                d1.pp_toi_pct_per_game * 100
              ).toFixed(2)}%`
            )
            .style("left", `${event.pageX + 5}px`)
            .style("top", `${event.pageY - 28}px`)
            .style("opacity", 1);
        })
        .on("mouseout", function () {
          tooltip.style("opacity", 0);
        });
    };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Add horizontal gridlines
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${marginTop})`)
      .call(
        d3
          .axisLeft(y)
          .ticks(10)
          .tickSize(-width + marginLeft + marginRight)
          .tickFormat(() => "")
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "#202020"));

    svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(width / 80)
          .tickSize(-height + marginTop + marginBottom)
          .tickSizeOuter(0)
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "#202020"))
      .call((g) => g.selectAll(".domain").attr("stroke", "white"))
      .call((g) => g.selectAll(".tick text").attr("fill", "white"));

    // Draw the y-axis in a separate group
    yAxisSvg
      .attr("viewBox", `0 0 ${marginLeft} ${height}`)
      .attr("width", marginLeft)
      .attr("height", height);

    yAxisSvg
      .append("g")
      .attr("transform", `translate(${marginLeft - 1},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%")))
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#202020")
          .attr("x2", width - marginLeft - marginRight)
      )
      .call((g) => g.selectAll(".domain").attr("stroke", "white"))
      .call((g) => g.selectAll(".tick text").attr("fill", "white"));

    playerDataMap.forEach((values, player) => {
      for (let i = 1; i < values.length; i++) {
        const value = values[i - 1].pp_toi_pct_per_game;
        let color;
        if (value < 0.5) {
          color = "#404040";
        } else if (value <= 0.75) {
          color = "#0f4358";
        } else {
          color = "#07aae2";
        }
        lineSegment(values[i - 1], values[i], color, player);
      }

      // Add labels for each player at the end of their lines
      const lastValue = values[values.length - 1];
      svg
        .append("text")
        .attr("class", `player-label ${player.replace(/\s+/g, "-")}`)
        .attr("x", x(new Date(lastValue.date)) + 5) // Adjust label position to the right
        .attr("y", y(lastValue.pp_toi_pct_per_game))
        .attr("fill", "white")
        .style("font-size", "12px")
        .text(lastValue.player_name)
        .on("mouseover", function () {
          svg.selectAll(".line-segment").style("opacity", 0.2);
          svg.selectAll(".player-dot").style("opacity", 0.2);
          svg
            .selectAll(`.line-segment.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1);
          svg
            .selectAll(`.player-dot.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1);
        })
        .on("mouseout", function () {
          svg.selectAll(".line-segment").style("opacity", 1);
          svg.selectAll(".player-dot").style("opacity", 1);
        });
    });

    svg
      .append("g")
      .selectAll("circle")
      .data(validData)
      .enter()
      .append("circle")
      .attr("class", (d) => `player-dot ${d.player_name.replace(/\s+/g, "-")}`)
      .attr("cx", (d) => x(new Date(d.date)))
      .attr("cy", (d) => y(d.pp_toi_pct_per_game))
      .attr("r", 3)
      .attr("fill", (d) => {
        if (d.pp_toi_pct_per_game < 0.5) return "#404040";
        if (d.pp_toi_pct_per_game <= 0.75) return "#116d8b";
        return "#07aae2";
      })
      .on("mouseover", function (event, d) {
        tooltip
          .html(
            `Player: ${d.player_name}<br/>PP TOI %: ${(
              d.pp_toi_pct_per_game * 100
            ).toFixed(2)}%`
          )
          .style("left", `${event.pageX + 5}px`)
          .style("top", `${event.pageY - 28}px`)
          .style("opacity", 1);
      })
      .on("mouseout", function () {
        tooltip.style("opacity", 0);
      });
  };

  const handlePlayerSelection = (player: string) => {
    setSelectedPlayers((prevSelectedPlayers) =>
      prevSelectedPlayers.includes(player)
        ? prevSelectedPlayers.filter((p) => p !== player)
        : [...prevSelectedPlayers, player]
    );
  };

  const resetSelection = () => {
    setSelectedPlayers([]);
  };

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.playerSelectContainer}>
        <div className={styles.scrollableMenu}>
          {players.map((player) => (
            <label key={player}>
              <input
                type="checkbox"
                checked={selectedPlayers.includes(player)}
                onChange={() => handlePlayerSelection(player)}
                onMouseOver={() => {
                  d3.selectAll(".line-segment").style("opacity", 0.2);
                  d3.selectAll(".player-dot").style("opacity", 0.2);
                  d3.selectAll(
                    `.line-segment.${player.replace(/\s+/g, "-")}`
                  ).style("opacity", 1);
                  d3.selectAll(
                    `.player-dot.${player.replace(/\s+/g, "-")}`
                  ).style("opacity", 1);
                }}
                onMouseOut={() => {
                  d3.selectAll(".line-segment").style("opacity", 1);
                  d3.selectAll(".player-dot").style("opacity", 1);
                }}
              />
              {player}
            </label>
          ))}
        </div>
        <button className={styles.resetButton} onClick={resetSelection}>
          Reset
        </button>
      </div>
      <div className={styles.yAxisContainer}>
        <svg ref={yAxisRef} className={styles.yAxisSvg} />
      </div>
      <div className={styles.chartContainer} style={{ overflowX: "auto" }}>
        <svg
          ref={chartRef}
          style={{ width: width + "px", height: height + "px" }}
        />
      </div>
      <div ref={tooltipRef} className={styles.tooltip}></div>
    </div>
  );
};

export default PPTOIChart;
