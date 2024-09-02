import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import supabase from "web/lib/supabase";
import styles from "web/styles/PPTOIChart.module.scss";

interface RawPlayerData {
  player_id: number;
  player_name: string;
  date: string; // Raw data from Supabase is a string
  pp_toi_pct_per_game: number;
  position_code: string;
}

interface PlayerData {
  player_id: number;
  player_name: string;
  date: Date; // After conversion, this will be a Date object
  pp_toi_pct_per_game: number;
  position_code: string;
}

interface PPTOIChartProps {
  teamAbbreviation: string;
}

const PPTOIChart: React.FC<PPTOIChartProps> = ({ teamAbbreviation }) => {
  const chartRef = useRef<SVGSVGElement>(null);
  const yAxisRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [forwards, setForwards] = useState<string[]>([]);
  const [defensemen, setDefensemen] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [monthData, setMonthData] = useState<Date[]>([]); // Holds Date objects
  const [allData, setAllData] = useState<PlayerData[]>([]); // Store all data

  const width = 1000; // Hardcoded width
  const height = 500; // Hardcoded height
  const marginTop = 20;
  const marginRight = 50; // Increased right margin for labels
  const marginBottom = 30;
  const marginLeft = 40; // Adjusted margin

  useEffect(() => {
    if (teamAbbreviation) {
      fetchAllPlayerData(teamAbbreviation);
    }
  }, [teamAbbreviation]);

  useEffect(() => {
    if (monthData.length > 0) {
      updateChartForCurrentMonth(allData); // Update the chart whenever the month changes
    }
  }, [currentMonthIndex, selectedPlayers, monthData]);

  const sanitizeName = (name: string) => {
    return name
      .replace(/\u001a©/g, "é") // Replace corrupted character sequences with correct characters
      .normalize("NFC"); // Normalize the string to ensure consistent encoding
  };

  const fetchAllPlayerData = async (abbreviation: string) => {
    const fetchedRawData: RawPlayerData[] = [];
    let from = 0;
    const pageSize = 1000;
    let data, error;

    do {
      ({ data, error } = await supabase
        .from("sko_pp_stats")
        .select(
          "player_id, player_name, date, pp_toi_pct_per_game, position_code"
        )
        .eq("team_abbrev", abbreviation)
        .range(from, from + pageSize - 1));

      if (error) {
        console.error("Error fetching player data:", error);
        break;
      }

      if (data) {
        fetchedRawData.push(...data);
        from += pageSize;
      }
    } while (data && data.length === pageSize);

    console.log("Fetched raw data:", fetchedRawData);

    // Convert to PlayerData
    const sanitizedData: PlayerData[] = fetchedRawData.map((player) => ({
      ...player,
      player_name: sanitizeName(player.player_name),
      date: new Date(player.date), // Convert date string to Date object
    }));

    console.log("Sanitized data:", sanitizedData);

    setAllData(sanitizedData);

    // Separate players by position
    const uniqueForwards = new Set<string>();
    const uniqueDefensemen = new Set<string>();

    sanitizedData.forEach((player) => {
      if (["C", "L", "R"].includes(player.position_code)) {
        uniqueForwards.add(player.player_name);
      } else if (player.position_code === "D") {
        uniqueDefensemen.add(player.player_name);
      }
    });

    const forwardsList = Array.from(uniqueForwards).sort();
    const defensemenList = Array.from(uniqueDefensemen).sort();

    setForwards(forwardsList);
    setDefensemen(defensemenList);

    // Extract unique months (based on year and month)
    const uniqueMonths = Array.from(
      new Set(
        sanitizedData.map(
          (d) => `${d.date.getFullYear()}-${d.date.getMonth() + 1}`
        )
      )
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    setMonthData(uniqueMonths.map((dateStr) => new Date(dateStr)));

    setCurrentMonthIndex(0);

    updateChartForCurrentMonth(sanitizedData);
  };

  const updateChartForCurrentMonth = (data: PlayerData[]) => {
    if (monthData.length === 0) return; // Guard against empty monthData
    const currentMonth = monthData[currentMonthIndex];
    console.log("Current Month Index:", currentMonthIndex);
    console.log("Current Month:", currentMonth);

    const filteredData = data.filter(
      (d) =>
        d.date.getFullYear() === currentMonth.getFullYear() &&
        d.date.getMonth() === currentMonth.getMonth()
    );

    console.log("Filtered Data for Current Month:", filteredData);

    drawChart(filteredData);
  };

  const drawChart = (data: PlayerData[]) => {
    console.log("Drawing chart with data:", data);

    // Select the SVG elements for the chart and y-axis, and the tooltip div
    const svg = d3.select(chartRef.current);
    const yAxisSvg = d3.select(yAxisRef.current);
    const tooltip = d3.select(tooltipRef.current);

    // Clear any previous content from the chart and y-axis SVGs
    svg.selectAll("*").remove();
    yAxisSvg.selectAll("*").remove();

    // Filter out invalid data points and any players not selected (if applicable)
    const validData = data.filter(
      (d) =>
        !isNaN(d.pp_toi_pct_per_game) &&
        d.pp_toi_pct_per_game !== null &&
        d.pp_toi_pct_per_game !== undefined &&
        (selectedPlayers.length === 0 ||
          selectedPlayers.includes(d.player_name))
    );

    // Group the valid data by player name and sort each player's data by date
    const playerDataMap = d3.group(validData, (d) => d.player_name);
    playerDataMap.forEach((values) => {
      values.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    // Set up the x (time) and y (percentage) scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(validData, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([0, 1]) // y-axis always goes from 0 to 100% (1.0)
      .nice()
      .range([height + marginBottom, marginTop]);

    // Function to draw line segments for each player's data
    const lineSegment = (
      d1: PlayerData,
      d2: PlayerData,
      color: string,
      player: string
    ) => {
      svg
        .append("line")
        .attr("class", `line-segment ${player.replace(/\s+/g, "-")}`) // Assign a class based on player name for styling and interactivity
        .attr("x1", x(d1.date))
        .attr("y1", y(d1.pp_toi_pct_per_game))
        .attr("x2", x(d2.date))
        .attr("y2", y(d2.pp_toi_pct_per_game))
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .on("mouseover", function (event) {
          // Display tooltip on hover
          tooltip
            .html(
              `Player: ${d1.player_name}<br/>PP TOI %: ${(
                d1.pp_toi_pct_per_game * 100
              ).toFixed(2)}%`
            )
            .style("left", `${event.pageX + 5}px`)
            .style("top", `${event.pageY - 28}px`)
            .style("opacity", 1);

          // Dim all other elements and keep the hovered player's elements fully visible
          svg.selectAll(".line-segment").style("opacity", 0.05); // Dim all other lines
          svg.selectAll(".player-dot").style("opacity", 0.05); // Dim all other dots
          svg.selectAll(".player-label").style("opacity", 0.05); // Dim all other labels
          svg
            .selectAll(`.line-segment.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Keep hovered player's line fully visible
          svg
            .selectAll(`.player-dot.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Keep hovered player's dots fully visible
          svg
            .selectAll(`.player-label.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Keep hovered player's label fully visible
        })
        .on("mouseout", function () {
          // Reset the styles when the mouse moves away
          tooltip.style("opacity", 0);
          svg.selectAll(".line-segment").style("opacity", 1);
          svg.selectAll(".player-dot").style("opacity", 1);
          svg.selectAll(".player-label").style("opacity", 1); // Reset label opacity
        });
    };

    // Set up the SVG element's viewBox and dimensions
    svg
      .attr(
        "viewBox",
        `0 0 ${width + marginRight + marginLeft} ${
          height + marginBottom + marginTop
        }`
      )
      .attr("width", "100%")
      .attr("height", "100%");

    // Draw the grid lines for the y-axis (vertical grid)
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${marginLeft}, )`)
      .call(
        d3
          .axisLeft(y)
          .ticks(10)
          .tickSize(-width)
          .tickFormat(() => "") // No tick labels, just grid lines
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "#202020")) // Grid line color
      .call((g) => g.selectAll(".domain").attr("stroke", "none")); // Remove the axis line

    // Draw the x-axis (date axis)
    svg
      .append("g")
      .attr(
        "transform",
        `translate(0,${height + marginBottom + marginTop - 10})`
      )
      .call(
        d3
          .axisBottom(x)
          .ticks(width / 80)
          .tickSize(-height - marginTop)
          .tickSizeOuter(0)
          .tickFormat((domainValue: Date | d3.NumberValue) => {
            // Format the tick labels to show the day of the month
            if (domainValue instanceof Date) {
              return d3.timeFormat("%d")(domainValue);
            } else {
              return d3.timeFormat("%d")(new Date(domainValue.valueOf()));
            }
          })
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "#202020")) // Tick line color
      .call((g) => g.selectAll(".domain").attr("stroke", "white")) // Axis line color
      .call((g) => g.selectAll(".tick text").attr("fill", "white")); // Tick label color

    // Draw the y-axis (percentage axis)
    yAxisSvg
      .attr("viewBox", `0 0 ${marginLeft} ${height + marginBottom + marginTop}`)
      .attr("width", marginLeft)
      .attr("height", height - marginBottom - marginTop - 7.5);

    // Draw the y-axis (percentage axis)
    yAxisSvg
      .append("g")
      .attr("transform", `translate(${marginLeft - 1},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%"))) // Format the tick labels as percentages
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#202020")
          .attr("x2", width + marginLeft + marginRight)
      )
      .call((g) => g.selectAll(".domain").attr("stroke", "white")) // Axis line color
      .call((g) => g.selectAll(".tick text").attr("fill", "white")); // Tick label color

    // Iterate over each player's data to draw the lines and labels
    playerDataMap.forEach((values, player) => {
      // Draw line segments for each pair of data points
      for (let i = 1; i < values.length; i++) {
        const value = values[i - 1].pp_toi_pct_per_game;
        let color;
        if (value < 0.5) {
          color = "#e207aa"; // Color for low PP TOI percentage
        } else if (value <= 0.75) {
          color = "#07aae2"; // Color for medium PP TOI percentage
        } else {
          color = "#aae207"; // Color for high PP TOI percentage
        }
        lineSegment(values[i - 1], values[i], color, player);
      }

      // Add labels for each player at the end of their lines
      const lastValue = values[values.length - 1];
      svg
        .append("text")
        .attr("class", `player-label ${player.replace(/\s+/g, "-")}`)
        .attr("x", x(lastValue.date) + 5) // Position the label slightly to the right of the last point
        .attr("y", y(lastValue.pp_toi_pct_per_game))
        .attr("fill", "white")
        .style("font-size", "12px")
        .text(lastValue.player_name)
        .on("mouseover", function () {
          // Highlight the corresponding line and player label on hover
          svg.selectAll(".line-segment").style("opacity", 0.1); // Dim all other lines
          svg.selectAll(".player-dot").style("opacity", 0.1); // Dim all other dots
          svg.selectAll(".player-label").style("opacity", 0.1); // Dim all other labels
          svg
            .selectAll(`.line-segment.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Highlight the hovered player's line
          svg
            .selectAll(`.player-dot.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Highlight the hovered player's dots
          d3.select(this).style("font-weight", "bold").style("fill", "#aae207"); // Highlight the text
          svg
            .selectAll(`.player-label.${player.replace(/\s+/g, "-")}`)
            .style("opacity", 1); // Keep hovered player's label fully visible
        })
        .on("mouseout", function () {
          // Reset the styles when the mouse moves away
          svg.selectAll(".line-segment").style("opacity", 1);
          svg.selectAll(".player-dot").style("opacity", 1);
          svg.selectAll(".player-label").style("opacity", 1); // Reset label opacity
          d3.select(this).style("font-weight", "normal").style("fill", "white"); // Reset text highlight
        });
    });

    // Draw the data points (circles) for each player's data
    svg
      .append("g")
      .selectAll("circle")
      .data(validData)
      .enter()
      .append("circle")
      .attr("class", (d) => `player-dot ${d.player_name.replace(/\s+/g, "-")}`)
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.pp_toi_pct_per_game))
      .attr("r", 3) // Radius of the data points
      .attr("fill", (d) => {
        // Color based on the PP TOI percentage
        if (d.pp_toi_pct_per_game < 0.5) return "#e207aa";
        if (d.pp_toi_pct_per_game <= 0.75) return "#07aae2";
        return "#aae207";
      })
      .on("mouseover", function (event, d) {
        // Display tooltip on hover
        tooltip
          .html(
            `Player: ${d.player_name}<br/>PP TOI %: ${(
              d.pp_toi_pct_per_game * 100
            ).toFixed(2)}%`
          )
          .style("left", `${event.pageX + 5}px`)
          .style("top", `${event.pageY - 28}px`)
          .style("opacity", 1);

        // Highlight the line and corresponding player label on hover
        svg.selectAll(".line-segment").style("opacity", 0.2); // Dim all other lines
        svg.selectAll(".player-dot").style("opacity", 0.2); // Dim all other dots
        svg.selectAll(".player-label").style("opacity", 0.2); // Dim all other labels
        svg
          .selectAll(`.line-segment.${d.player_name.replace(/\s+/g, "-")}`)
          .style("opacity", 1); // Highlight the hovered player's line
        svg
          .selectAll(`.player-dot.${d.player_name.replace(/\s+/g, "-")}`)
          .style("opacity", 1); // Highlight the hovered player's dots
        svg
          .selectAll(`.player-label.${d.player_name.replace(/\s+/g, "-")}`)
          .style("opacity", 1); // Highlight the hovered player's label
      })
      .on("mouseout", function () {
        // Reset the styles when the mouse moves away
        tooltip.style("opacity", 0);
        svg.selectAll(".line-segment").style("opacity", 1);
        svg.selectAll(".player-dot").style("opacity", 1);
        svg.selectAll(".player-label").style("opacity", 1); // Reset label opacity
      });

    // Add Month/Year Label
    d3.select(`#${styles.monthYearLabel}`).text(
      d3.timeFormat("%B %Y")(monthData[currentMonthIndex])
    );

    // Add Legend
    const legend = d3
      .select(`#${styles.legendContainer}`)
      .selectAll(".legend-item")
      .data([
        { color: "#e207aa", label: "< 50% PP TOI" },
        { color: "#07aae2", label: "50% - 75% PP TOI" },
        { color: "#aae207", label: "> 75% PP TOI" },
      ])
      .enter()
      .append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center")
      .style("margin-right", "20px");

    legend
      .append("div")
      .style("width", "18px")
      .style("height", "18px")
      .style("background-color", (d) => d.color)
      .style("margin-right", "5px");

    legend
      .append("span")
      .style("color", "white")
      .text((d) => d.label);
  };

  const handlePlayerSelection = (player: string) => {
    setSelectedPlayers((prevSelectedPlayers) =>
      prevSelectedPlayers.includes(player)
        ? prevSelectedPlayers.filter((p) => p !== player)
        : [...prevSelectedPlayers, player]
    );
  };

  const handleSelectAllForwards = () => {
    setSelectedPlayers((prevSelectedPlayers) => {
      const allForwardsSelected = forwards.every((fwd) =>
        prevSelectedPlayers.includes(fwd)
      );
      return allForwardsSelected
        ? prevSelectedPlayers.filter((p) => !forwards.includes(p))
        : [
            ...prevSelectedPlayers,
            ...forwards.filter((fwd) => !prevSelectedPlayers.includes(fwd)),
          ];
    });
  };

  const handleSelectAllDefensemen = () => {
    setSelectedPlayers((prevSelectedPlayers) => {
      const allDefensemenSelected = defensemen.every((dman) =>
        prevSelectedPlayers.includes(dman)
      );
      return allDefensemenSelected
        ? prevSelectedPlayers.filter((p) => !defensemen.includes(p))
        : [
            ...prevSelectedPlayers,
            ...defensemen.filter((dman) => !prevSelectedPlayers.includes(dman)),
          ];
    });
  };

  const resetSelection = () => {
    setSelectedPlayers([]);
  };

  const handlePreviousMonth = () => {
    if (currentMonthIndex > 0) {
      console.log("Previous Month Button Clicked");
      setCurrentMonthIndex(currentMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex < monthData.length - 1) {
      console.log("Next Month Button Clicked");
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
  };

  return (
    <div className={styles.chartWrapper}>
      {/* Player Selection Container */}
      <div className={styles.playerSelectContainer}>
        <button
          className={styles.selectButton}
          onClick={handleSelectAllForwards}
        >
          {forwards.every((fwd) => selectedPlayers.includes(fwd))
            ? "Deselect All Forwards"
            : "Select All Forwards"}
        </button>
        <button
          className={styles.selectButton}
          onClick={handleSelectAllDefensemen}
        >
          {defensemen.every((dman) => selectedPlayers.includes(dman))
            ? "Deselect All Defensemen"
            : "Select All Defensemen"}
        </button>
        <div className={styles.scrollableMenu}>
          <h3>Forwards</h3>
          {forwards.map((player) => (
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
          <h3>Defensemen</h3>
          {defensemen.map((player) => (
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

      {/* Content Area */}
      <div className={styles.contentArea}>
        {/* Pagination Container */}
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationButton}
            onClick={handlePreviousMonth}
            disabled={currentMonthIndex === 0}
          >
            Previous
          </button>
          <div className={styles.paginationSpacer}></div>
          <button
            className={styles.paginationButton}
            onClick={handleNextMonth}
            disabled={currentMonthIndex >= monthData.length - 1}
          >
            Next
          </button>
        </div>

        <div className={styles.chartAndYAxis}>
          {/* Y-Axis Container */}
          <div className={styles.yAxisContainer}>
            <svg ref={yAxisRef} className={styles.yAxisSvg} />
          </div>

          {/* Chart Container */}
          <div className={styles.chartContainer}>
            <svg ref={chartRef} className={styles.chartSvg} />
          </div>
        </div>

        {/* Legend and Month/Year Label Container */}
        <div className={styles.legendAndLabel}>
          <span id={styles.monthYearLabel}></span>
          <div id={styles.legendContainer}></div>
        </div>
      </div>

      {/* Tooltip */}
      <div ref={tooltipRef} className={styles.tooltip}></div>
    </div>
  );
};

export default PPTOIChart;
