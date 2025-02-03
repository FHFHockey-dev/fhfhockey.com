////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\PlayerPPTOIPerGameChart\PPTOIChart.tsx

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import supabase from "lib/supabase";
import styles from "styles/PPTOIChart.module.scss";

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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"month" | "season">("month");
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
  }, [currentMonthIndex, selectedPlayers, monthData, viewMode]);

  const sanitizeName = (name: string) => {
    return name
      .replace(/\u001a©/g, "é") // Replace corrupted character sequences with correct characters
      .normalize("NFC"); // Normalize the string to ensure consistent encoding
  };

  const sanitizeForCss = (name: string) => {
    return name.replace(/[^a-zA-Z0-9\-_]/g, "-"); // Replace all non-alphanumeric characters with a hyphen
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
        // @ts-ignore
        fetchedRawData.push(...data);
        from += pageSize;
      }
    } while (data && data.length === pageSize);

    // console.log("Fetched raw data:", fetchedRawData);

    // Convert to player data with adjusted date parsing
    const sanitizedData: PlayerData[] = fetchedRawData.map((player) => {
      const dateParts = player.date.split("-");
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Convert 1-indexed month to 0-indexed
      const day = parseInt(dateParts[2], 10);
      return {
        ...player,
        player_name: sanitizeName(player.player_name),
        date: new Date(year, month, day), // Use the adjusted month here
      };
    });

    // console.log("Sanitized data:", sanitizedData);

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
          (d) =>
            `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(
              2,
              "0"
            )}`
        )
      )
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const monthDates = uniqueMonths.map((dateStr) => {
      const [year, month] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, 1); // Correct the month back to 0-indexed
    });

    setMonthData(monthDates);

    // Ensure setCurrentMonthIndex is called after setMonthData
    const defaultMonthIndex = monthDates.findIndex(
      (month) => month.getMonth() === 9 // Set October as default if it exists
    );
    setCurrentMonthIndex(defaultMonthIndex !== -1 ? defaultMonthIndex : 0);

    // Defer the chart update until after the state has been updated
    setTimeout(() => {
      updateChartForCurrentMonth(sanitizedData);
    }, 0); // Delay to ensure states are set

    // console.log("Unique Months: ", uniqueMonths);
    // console.log("Month Dates: ", monthDates); // Check if December is included here
    // console.log(
    //   "Sanitized data dates:",
    //   sanitizedData.map((d) => d.date)
    // ); // This should show you the correctly adjusted months
  };

  const updateChartForCurrentMonth = (data: PlayerData[]) => {
    if (monthData.length === 0 || currentMonthIndex < 0) return; // Guard against empty monthData or invalid index

    const currentMonth = monthData[currentMonthIndex];
    if (!currentMonth) return; // Ensure currentMonth is defined

    // console.log("Current Month Index:", currentMonthIndex);
    // console.log("Current Month:", currentMonth);

    if (viewMode === "month") {
      const filteredData = data.filter(
        (d) =>
          d.date.getFullYear() === currentMonth.getFullYear() &&
          d.date.getMonth() === currentMonth.getMonth()
      );

      // console.log("Filtered Data for Current Month:", filteredData);

      drawChart(filteredData);
    } else {
      // Group by month
      const filteredData = data.filter((d) =>
        monthData.some(
          (m) =>
            d.date.getFullYear() === m.getFullYear() &&
            d.date.getMonth() === m.getMonth()
        )
      );

      console.log("Filtered Data for Full Season:", filteredData);

      drawChart(filteredData, true);
    }
  };

  const drawChart = (data: PlayerData[], groupByMonth = false) => {
    // console.log("Drawing chart with data:", data);

    const svg = d3.select(chartRef.current);
    const tooltip = d3.select(tooltipRef.current);

    svg.selectAll("*").remove();

    const validData = data.filter(
      (d) =>
        !isNaN(d.pp_toi_pct_per_game) &&
        d.pp_toi_pct_per_game !== null &&
        d.pp_toi_pct_per_game !== undefined &&
        (selectedPlayers.length === 0 ||
          selectedPlayers.includes(d.player_name))
    );

    const playerDataMap = d3.group(validData, (d) => d.player_name);
    playerDataMap.forEach((values) => {
      values.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    let x: d3.ScaleTime<number, number>;
    const uniqueMonths = Array.from(
      new Set(
        data.map((d) => new Date(d.date.getFullYear(), d.date.getMonth(), 1))
      )
    );
    const uniqueDates = Array.from(new Set(validData.map((d) => d.date)));

    if (groupByMonth) {
      x = d3
        .scaleTime()
        .domain(d3.extent(uniqueMonths) as [Date, Date])
        .range([0, width - marginRight - marginLeft]);

      svg
        .append("g")
        .attr("transform", `translate(${marginLeft},${height - marginBottom})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues(uniqueMonths)
            .tickFormat((domainValue: Date | d3.NumberValue) => {
              if (domainValue instanceof Date) {
                return d3.timeFormat("%B")(domainValue);
              } else {
                return d3.timeFormat("%B")(new Date(domainValue.valueOf()));
              }
            })
        )
        .call((g) => g.selectAll(".tick line").attr("stroke", "#202020"))
        .call((g) => g.selectAll(".domain").attr("stroke", "white"))
        .call((g) => g.selectAll(".tick text").attr("fill", "white"));

      // Draw vertical grid lines for each unique month after the axis is drawn
      svg
        .append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${marginTop})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues(uniqueMonths)
            .tickSize(height - marginTop - marginBottom)
            .tickFormat(() => "")
        )
        .call((g) => g.selectAll(".tick line").attr("stroke", "#202020"))
        .call((g) => g.selectAll(".domain").attr("stroke", "none"));
    } else {
      x = d3
        .scaleTime()
        .domain(d3.extent(uniqueDates) as [Date, Date])
        .range([marginLeft, width - marginRight - marginLeft]);

      svg
        .append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues(uniqueDates)
            .tickFormat((domainValue: Date | d3.NumberValue) => {
              if (domainValue instanceof Date) {
                return d3.timeFormat("%d")(domainValue);
              } else {
                return d3.timeFormat("%d")(new Date(domainValue.valueOf()));
              }
            })
        )
        .call((g) => g.selectAll(".tick line").attr("stroke", "#FFFFFF"))
        .call((g) => g.selectAll(".domain").attr("stroke", "white"))
        .call((g) => g.selectAll(".tick text").attr("fill", "white"));

      // Draw vertical grid lines for each unique date after the axis is drawn
      svg
        .append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${marginTop})`) // Ensure the grid starts at the top of the chart
        .call(
          d3
            .axisBottom(x)
            .tickValues(groupByMonth ? uniqueMonths : uniqueDates) // Set the ticks to the unique dates or months
            .tickSize(height - marginTop - marginBottom) // Extend grid lines vertically across the chart
            .tickFormat(() => "") // Hide tick labels for grid
        )
        .call((g) => g.selectAll(".tick line").attr("stroke", "#202020")) // Set a visible stroke color for the grid lines
        .call((g) => g.selectAll(".domain").remove()); // Remove the X-axis domain line, so only grid lines are drawn
    }

    const y = d3
      .scaleLinear()
      .domain([0, 1])
      .nice()
      .range([height - marginBottom, marginTop]);

    // Function to draw line segments for each player's data
    const lineSegment = (
      d1: PlayerData,
      d2: PlayerData,
      color: string,
      player: string
    ) => {
      const sanitizedPlayer = sanitizeForCss(player);

      svg
        .append("line")
        .attr("class", `line-segment ${sanitizedPlayer}`)
        .attr("x1", x(d1.date))
        .attr("y1", y(d1.pp_toi_pct_per_game))
        .attr("x2", x(d2.date))
        .attr("y2", y(d2.pp_toi_pct_per_game))
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .on("mouseover", () => onHover(player))
        .on("mouseout", onLeave);
    };

    svg
      .append("g")
      .selectAll("circle")
      .data(validData)
      .enter()
      .append("circle")
      .attr("class", (d) => `player-dot ${sanitizeForCss(d.player_name)}`)
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.pp_toi_pct_per_game))
      .attr("r", 3)
      .attr("fill", (d) => {
        if (d.pp_toi_pct_per_game < 0.5) return "#e207aa";
        if (d.pp_toi_pct_per_game <= 0.75) return "#07aae2";
        return "#aae207";
      })
      .on("mouseover", (d) => onHover(d.player_name))
      .on("mouseout", onLeave);

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

    // Draw the y-axis directly on the chart SVG
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%")))
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#202020")
          .attr("x2", width - marginLeft - marginRight)
      )
      .call((g) => g.selectAll(".domain").attr("stroke", "white")) // Axis line color
      .call((g) => g.selectAll(".tick text").attr("fill", "white")); // Tick label color

    // Draw the grid lines for the y-axis (horizontal grid)
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(15)
          .tickSize(-width + marginLeft + marginRight)
          .tickFormat(() => "") // No tick labels, just grid lines
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "#202020")) // Grid line color
      .call((g) => g.selectAll(".domain").attr("stroke", "none")); // Remove the axis line

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
        .attr("x", x(lastValue.date) + 5)
        .attr("y", y(lastValue.pp_toi_pct_per_game))
        .attr("fill", "white")
        .style("font-size", "12px")
        .text(lastValue.player_name)
        .on("mouseover", function () {
          onHover(player); // Apply hover effect
        })
        .on("mouseout", function () {
          onLeave(); // Reset the styles when the mouse moves away
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
      .attr("r", 3)
      .attr("fill", (d) => {
        if (d.pp_toi_pct_per_game < 0.5) return "#e207aa";
        if (d.pp_toi_pct_per_game <= 0.75) return "#07aae2";
        return "#aae207";
      })
      .on("mouseover", function (event, d) {
        onHover(d.player_name); // Apply hover effect
      })
      .on("mouseout", onLeave); // Reset the styles when mouse out

    // Add Month/Year Label
    d3.select(`#${styles.monthYearLabel}`).text(
      viewMode === "month"
        ? d3.timeFormat("%B %Y")(monthData[currentMonthIndex])
        : "Full Season"
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
      .style("margin-left", "10px")
      .style("margin-right", "10px");

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

  const onHover = (player: string) => {
    const sanitizedPlayer = sanitizeForCss(player);

    d3.selectAll(".line-segment").style("opacity", 0.04);
    d3.selectAll(".player-dot").style("opacity", 0.04);
    d3.selectAll(".player-label").style("opacity", 0.04);

    d3.selectAll(`.line-segment.${sanitizedPlayer}`).style("opacity", 1);
    d3.selectAll(`.player-dot.${sanitizedPlayer}`).style("opacity", 1);
    d3.selectAll(`.player-label.${sanitizedPlayer}`).style("opacity", 1);
  };

  const onLeave = () => {
    d3.selectAll(".line-segment").style("opacity", 1);
    d3.selectAll(".player-dot").style("opacity", 1);
    d3.selectAll(".player-label").style("opacity", 1);
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
      // console.log("Next Month Button Clicked");
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
  };

  const handleViewModeToggle = () => {
    setViewMode((prevMode) => (prevMode === "month" ? "season" : "month"));
  };

  return (
    <div className={styles.chartWrapper}>
      {/* Player Selection Container */}
      <div className={styles.playerSelectContainer}>
        {/* Toggle Button for View Mode */}
        <button className={styles.toggleButton} onClick={handleViewModeToggle}>
          {viewMode === "month" ? "Season View" : "Month View"}
        </button>
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
            disabled={viewMode === "season" || currentMonthIndex === 0}
          >
            Previous
          </button>
          <div className={styles.paginationSpacer}>
            {/* Legend and Month/Year Label Container */}
            <div className={styles.legendAndLabel}>
              <span id={styles.monthYearLabel}></span>

              <div id={styles.legendContainer}></div>
            </div>
          </div>
          <button
            className={styles.paginationButton}
            onClick={handleNextMonth}
            disabled={
              viewMode === "season" || currentMonthIndex >= monthData.length - 1
            }
          >
            Next
          </button>
        </div>

        <div className={styles.chartAndYAxis}>
          {/* Chart Container */}
          <div className={styles.chartContainer}>
            <svg ref={chartRef} className={styles.chartSvg} />
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div ref={tooltipRef} className={styles.tooltip}></div>
    </div>
  );
};

export default PPTOIChart;
